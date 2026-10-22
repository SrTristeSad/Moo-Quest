// First-run infrastructure installer for Moo-Quest V2. This is independent
// of the legacy reference game's code and never simulates working services.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomInt, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import { createClient } from 'redis';
import { dataDirectory, atomicJSON, loadJSON } from './src/storage.js';
import { passwordHash } from './src/auth.js';
import { PostgresStorage } from './src/database.js';
import { PlayerAccounts } from './src/player-accounts.js';
import { requestIdentity } from './src/request-identity.js';

const CONFIG='infrastructure.json';
export function savedInfrastructure(root){
  const filename=path.join(dataDirectory(root),CONFIG);
  const result=loadJSON(filename,null);
  if(result===null)return null;
  if(result.schema!==1||typeof result.databaseURL!=='string'||
    typeof result.redisURL!=='string')throw new Error('Invalid private infrastructure configuration');
  const stat=fs.statSync(filename);
  if((stat.mode&0o077)!==0)
    throw new Error('Unsafe infrastructure file permissions: chmod 600 '+filename);
  return result;
}
function boundedPort(value,defaultPort){
  const number=Number(value===undefined||value===''?defaultPort:value);
  if(!Number.isSafeInteger(number)||number<1||number>65535)
    throw new Error('Porta invalida');
  return number;
}
function endpoint(value,kind){
  const pgMode=kind==='postgres';
  const prefix=pgMode?'pg':'redis';
  const host=String(value[prefix+'Host']||'').trim();
  if(!/^[a-z0-9.-]{1,253}$/i.test(host))throw new Error('Host de '+kind+' invalido');
  const port=boundedPort(value[prefix+'Port'],pgMode?5432:6379);
  const tls=value[prefix+'Tls']===true;
  const local=['localhost','127.0.0.1'].includes(host.toLowerCase());
  if(!local&&!tls)throw new Error(kind+' remoto exige TLS');
  const u=new URL((pgMode?'postgresql:':tls?'rediss:':'redis:')+'//localhost');
  u.hostname=host;u.port=String(port);
  if(pgMode){
    const db=String(value.pgDatabase||'').trim();
    const user=String(value.pgUser||'').trim();
    if(!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(db)||!user||
       user.length>63||/[\r\n]/.test(user))throw new Error('Banco ou usuario PostgreSQL invalido');
    if(typeof value.pgPassword!=='string'||value.pgPassword.length===0)
      throw new Error('Senha PostgreSQL obrigatoria');
    u.username=user;u.password=value.pgPassword;u.pathname='/'+db;
    u.searchParams.set('sslmode',tls?'require':'disable');
  }else{
    const user=String(value.redisUsername||'').trim();
    const redisDB=Number(value.redisDatabase===undefined?0:value.redisDatabase);
    if(!Number.isInteger(redisDB)||redisDB<0||redisDB>15)
      throw new Error('Database Redis fora de 0 a 15');
    if(user)u.username=user;
    if(value.redisPassword)u.password=String(value.redisPassword);
    u.pathname='/'+redisDB;
  }
  return u.toString();
}
export function normalizeSetup(body){
  if(!body||typeof body!=='object'||Array.isArray(body))
    throw new Error('Formulario invalido');
  return {
    databaseURL:endpoint(body,'postgres'),
    redisURL:endpoint(body,'redis')
  };
}
async function checkPg(url){
  const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:4000,
    idleTimeoutMillis:1000});
  try{
    const result=await pool.query('SELECT current_database() AS database, version() AS version');
    return {database:result.rows[0].database,version:String(result.rows[0].version).slice(0,85)};
  }finally{await pool.end();}
}
async function checkRedis(url){
  const client=createClient({url,socket:{connectTimeout:4000,reconnectStrategy:false}});
  client.on('error',()=>{});
  try{
    await client.connect();
    if(await client.ping()!=='PONG')throw new Error('Redis nao respondeu PONG');
    return {connected:true};
  }finally{if(client.isOpen)await client.disconnect();}
}
async function initialize(root,urls,owner){
  const storage=new PostgresStorage(root,{connectionString:urls.databaseURL});
  try{
    await storage.init();
    await new PlayerAccounts(storage.pool).init();
    if(!storage.data.owner){
      if(!/^[a-zA-Z0-9_-]{3,24}$/.test(owner.username||''))
        throw new Error('Usuario administrativo invalido');
      const hashed=passwordHash(owner.password);
      storage.data.owner={username:owner.username,password:hashed,
        createdAt:new Date().toISOString()};
      await storage.audit('installation',{owner:owner.username});
    }
    // Preserve an existing owner and all prior database data.
    const privateFile=path.join(dataDirectory(root),CONFIG);
    if(fs.existsSync(privateFile))throw new Error('Infrastructure already configured');
    atomicJSON(privateFile,{schema:1,...urls});
    fs.chmodSync(privateFile,0o600);
    return {configured:true,existingOwner:storage.data.owner.username!==owner.username};
  }finally{await storage.close();}
}
function json(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store'});
  res.end(JSON.stringify(body));
}
async function bodyJSON(req){
  if(!req.headers['content-type']?.startsWith('application/json'))
    throw Object.assign(new Error('Somente application/json'),{status:415});
  const chunks=[];let total=0;
  for await(const chunk of req){
    total+=chunk.length;
    if(total>12000)throw Object.assign(new Error('Formulario muito grande'),{status:413});
    chunks.push(chunk);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Object.assign(new Error('JSON invalido'),{status:400});}
}
export function createInfrastructureInstaller({root,
  code=String(randomInt(100000,1000000)),onInstalled=()=>{},
  drivers={postgres:checkPg,redis:checkRedis,initialize}
}={}){
  if(!root)throw new Error('Installer root required');
  const folder=path.join(root,'public');
  const attempts=new Map();let totalFailures=0,installing=false,completed=false;
  const allowed=(req,payload)=>{
    const ip=requestIdentity(req).address,now=Date.now();
    const old=attempts.get(ip);
    const item=old&&old.until>now?old:{count:0,until:now+15*60_000};
    const supplied=String(payload?.code||'');
    const a=Buffer.from(supplied),b=Buffer.from(code);
    if(item.count>=5||totalFailures>=25)
      throw Object.assign(new Error('Muitas tentativas: reinicie a instalacao com seguranca'),{status:429});
    if(a.length!==b.length||!timingSafeEqual(a,b)){
      item.count++;totalFailures++;attempts.set(ip,item);
      throw Object.assign(new Error('Codigo de instalacao incorreto'),{status:403});
    }
  };
  const server=http.createServer(async(req,res)=>{
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('x-frame-options','DENY');
    res.setHeader('cache-control','no-store');
    res.setHeader('content-security-policy',
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    const pathname=new URL(req.url,'http://localhost').pathname;
    try{
      if(completed)return json(res,503,{error:'Instalacao em finalizacao'});
      if(req.method==='GET'&&(pathname==='/'||pathname==='/setup')){
        res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
        return res.end(fs.readFileSync(path.join(folder,'setup-infrastructure.html')));
      }
      if(req.method==='GET'&&pathname==='/setup/infrastructure.js'){
        res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});
        return res.end(fs.readFileSync(path.join(folder,'setup-infrastructure.js')));
      }
      if(req.method==='GET'&&pathname==='/health')
        return json(res,200,{status:'setup',installed:false,requires:['postgresql','redis']});
      if(req.method==='POST'&&['/setup/test-postgres','/setup/test-redis','/setup/install'].includes(pathname)){
        const data=await bodyJSON(req);
        allowed(req,data);
        const urls=normalizeSetup(data);
        if(pathname==='/setup/test-postgres')
          return json(res,200,{ok:true,...await drivers.postgres(urls.databaseURL)});
        if(pathname==='/setup/test-redis')
          return json(res,200,{ok:true,...await drivers.redis(urls.redisURL)});
        if(installing) return json(res,409,{error:'Instalacao em andamento'});
        installing=true;
        try{
          await Promise.all([drivers.postgres(urls.databaseURL),drivers.redis(urls.redisURL)]);
          const result=await drivers.initialize(root,urls,{
            username:data.adminUsername,password:data.adminPassword
          });
          completed=true;
          json(res,200,{ok:true,...result});
          setImmediate(()=>server.close(()=>onInstalled(urls)));
        }finally{installing=false;}
        return;
      }
      return json(res,404,{error:'not_found'});
    }catch(err){
      const status=err.status|| (err.message?.includes('already configured')?409:400);
      console.error('[MooQuest setup] '+String(err.message).slice(0,180));
      return json(res,status,{error:status===400?'Verifique as credenciais e se os bancos estao ativos':err.message});
    }
  });
  return {server,code,listen:(port,host='127.0.0.1')=>new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>{server.off('error',reject);resolve(server.address());});
  })};
}
