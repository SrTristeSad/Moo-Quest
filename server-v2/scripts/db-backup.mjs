#!/usr/bin/env node
// Moo-Quest V2 database backup/verification and deliberate offline restore.
// This runs locally in aaPanel with pg_dump/pg_restore from PostgreSQL 17+.
// No external packages, shell interpolation, plaintext URL command arguments,
// or access to the application's Redis/session credentials.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Also protects the dump while pg_dump is still writing it.
process.umask(0o077);
const FORMAT='mooquest-postgres-backup-v1';
const TABLES=['mq_admin_state','mq_player_accounts','mq_clans','mq_clan_members'];
const USAGE='Use: node scripts/db-backup.mjs backup | verify <file.dump> | restore <file.dump>';

function target(){
  const value=process.env.MOO_DATABASE_URL;
  if(!value)throw new Error('MOO_DATABASE_URL is required');
  let url;
  try{url=new URL(value);}catch{throw new Error('Invalid MOO_DATABASE_URL');}
  if(!['postgresql:','postgres:'].includes(url.protocol)||!url.hostname)
    throw new Error('MOO_DATABASE_URL must use a PostgreSQL connection');
  const db=decodeURIComponent(url.pathname.slice(1));
  if(!db||db.includes('/'))throw new Error('Invalid PostgreSQL database name');
  const port=url.port||'5432';
  const env={...process.env,PGHOST:url.hostname,PGPORT:port,
    PGUSER:decodeURIComponent(url.username)||'postgres',
    PGPASSWORD:decodeURIComponent(url.password),
    PGDATABASE:db,PGCONNECT_TIMEOUT:'5'};
  delete env.MOO_DATABASE_URL; // Never pass a plaintext URL to child argv.
  const mode=url.searchParams.get('sslmode');
  if(mode){
    if(!['disable','allow','prefer','require','verify-ca','verify-full'].includes(mode))
      throw new Error('Invalid PostgreSQL sslmode');
    env.PGSSLMODE=mode;
  }
  return {db,env};
}
function run(executable,args,env){
  const result=spawnSync(executable,args,{env,encoding:'utf8',
    stdio:['ignore','pipe','pipe'],timeout:120000,maxBuffer:1024*1024});
  if(result.error)throw new Error(executable+' unavailable or timed out');
  if(result.status!==0)throw new Error(executable+' exited with '+result.status);
  return result.stdout||'';
}
function digest(filename){
  const h=createHash('sha256');
  const bytes=fs.readFileSync(filename);
  h.update(bytes);
  return h.digest('hex');
}
function safeFile(filename){
  if(typeof filename!=='string'||!filename.endsWith('.dump'))
    throw new Error('Expected a .dump backup archive');
  const name=path.resolve(filename);
  const stat=fs.lstatSync(name);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<5)
    throw new Error('Invalid backup archive');
  const head=Buffer.alloc(5);
  const handle=fs.openSync(name,'r');
  try{fs.readSync(handle,head,0,5,0);}finally{fs.closeSync(handle);}
  if(head.toString()!=='PGDMP')throw new Error('Not a PostgreSQL custom dump');
  return {name,stat};
}
function checkBackup(filename){
  const {name,stat}=safeFile(filename);
  const sidecar=name+'.json';
  if(!fs.lstatSync(sidecar).isFile())throw new Error('Missing backup manifest');
  const meta=JSON.parse(fs.readFileSync(sidecar,'utf8'));
  if(meta.format!==FORMAT||meta.file!==path.basename(name)||
    !/^[a-f0-9]{64}$/.test(meta.sha256||'')||
    !Number.isSafeInteger(meta.size)||meta.size!==stat.size)
    throw new Error('Invalid backup manifest');
  if(digest(name)!==meta.sha256)throw new Error('Backup SHA256 verification failed');
  const list=run('pg_restore',['--list',name],process.env);
  for(const table of TABLES){
    const escaped=table.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const rx=new RegExp('(?:^|\\n)[^\\n]*\\bTABLE\\s+[^\\s]+\\s+'+escaped+'(?:\\s|$)');
    if(!rx.test(list))throw new Error('Required PostgreSQL table missing: '+table);
  }
  return {name,meta};
}
function backup(){
  const {db,env}=target();
  const dir=path.resolve(process.env.MOO_BACKUP_DIR||path.join(root,'var','backups'));
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  fs.chmodSync(dir,0o700);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const basename='mooquest-'+stamp+'-'+randomBytes(5).toString('hex')+'.dump';
  const file=path.join(dir,basename),tmp=file+'.partial';
  try{
    run('pg_dump',['--format=custom','--no-owner','--no-acl',
      '--file='+tmp],env);
    // pg_restore verifies the archive directory before publication.
    const items=run('pg_restore',['--list',tmp],env);
    for(const table of TABLES){
      const rx=new RegExp('\\bTABLE\\s+[^\\s]+\\s+'+table+'(?:\\s|$)');
      if(!rx.test(items))throw new Error('Required table missing: '+table);
    }
    const stat=fs.statSync(tmp);
    if(!stat.isFile()||stat.size<5)throw new Error('pg_dump created an empty archive');
    fs.chmodSync(tmp,0o600);
    const archiveHeader=Buffer.alloc(5);
    const fd=fs.openSync(tmp,'r');
    try{fs.readSync(fd,archiveHeader,0,5,0);}finally{fs.closeSync(fd);}
    if(archiveHeader.toString()!=='PGDMP')throw new Error('Not a custom PostgreSQL dump');
    const meta={format:FORMAT,file:basename,createdAt:new Date().toISOString(),
      database:db,size:stat.size,sha256:digest(tmp)};
    fs.writeFileSync(file+'.json',JSON.stringify(meta,null,2)+'\n',{flag:'wx',mode:0o600});
    fs.renameSync(tmp,file);
    console.log('BACKUP_OK '+file);
  }catch(error){
    try{fs.unlinkSync(tmp);}catch{}
    try{fs.unlinkSync(file+'.json');}catch{}
    throw error;
  }
}
async function restore(file){
  const {db,env}=target();
  const {name,meta}=checkBackup(file);
  if(meta.database!==db)throw new Error('Backup belongs to another database');
  if(process.env.MOO_CONFIRM_RESTORE!=='RESTORE '+db||
    process.env.MOO_SERVER_STOPPED!=='YES')
    throw new Error('Restore requires MOO_CONFIRM_RESTORE="RESTORE '+db+
      '" and MOO_SERVER_STOPPED=YES (stop Node first)');
  // Refuse to restore if any HTTP process still responds on the local app
  // port. An explicit operator confirmation is also required.
  const port=Number(process.env.MOO_PORT||8100);
  if(!Number.isSafeInteger(port)||port<1||port>65535)
    throw new Error('Invalid MOO_PORT');
  try{
    const response=await fetch('http://127.0.0.1:'+port+'/health',
      {signal:AbortSignal.timeout(800),redirect:'manual'});
    if(response)throw new Error('Stop the Node.js service before restoring');
  }catch(error){
    if(error.message==='Stop the Node.js service before restoring')throw error;
    // Connection refusal/timeout is expected when aaPanel has stopped Node.
  }
  run('pg_restore',['--clean','--if-exists','--no-owner','--no-acl',
    '--single-transaction','--dbname='+db,name],env);
  console.log('RESTORE_OK '+db+' (restart Node only after checking /ready)');
}
async function main(){
  const [command,file,extra]=process.argv.slice(2);
  if(extra||!['backup','verify','restore'].includes(command)||
    (command==='backup'&&file)||(!file&&command!=='backup'))
    throw new Error(USAGE);
  if(command==='backup')backup();
  else if(command==='verify'){
    const {name}=checkBackup(file);
    console.log('VERIFY_OK '+name);
  }else await restore(file);
}
main().catch(error=>{
  console.error('DB_BACKUP_ERROR: '+error.message);
  process.exitCode=1;
});
