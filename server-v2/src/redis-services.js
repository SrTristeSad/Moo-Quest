// Ephemeral Redis services: eight-hour admin sessions, login throttling,
// and short-lived single-use native-client tickets. Never store passwords.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { createClient } from 'redis';
import { Auth } from './auth.js';
const hash=v=>createHash('sha256').update(String(v)).digest('hex');
export async function connectRedis(url=process.env.MOO_REDIS_URL){
  if(!url)throw new Error('Set MOO_REDIS_URL to enable Redis');
  const client=createClient({url,socket:{connectTimeout:5000,
    reconnectStrategy:retries=>Math.min(retries*250+100,2000)}});
  client.on('error',error=>console.error('[MooQuest] Redis connection error:',error.message));
  await client.connect();
  await client.ping();
  return client;
}
export class RedisAuth extends Auth {
  constructor(client,{prefix='mq:v2:'}={}){
    super();
    this.client=client;this.prefix=prefix;
  }
  key(type,value){return this.prefix+type+':'+hash(value);}
  async issue(){
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
    await this.client.set(this.key('session',token),csrf,{EX:8*3600});
    return {token,csrf};
  }
  async get(token){
    if(!/^[0-9a-f]{64}$/.test(token||''))return null;
    const csrf=await this.client.get(this.key('session',token));
    return csrf?{csrf}:null;
  }
  async revoke(token){
    if(/^[0-9a-f]{64}$/.test(token||''))await this.client.del(this.key('session',token));
  }
  async loginBlocked(key){
    const count=Number(await this.client.get(this.key('failed-login',key)))||0;
    return count>=5;
  }
  async recordFailure(key){
    const k=this.key('failed-login',key);
    const count=await this.client.incr(k);
    if(count===1)await this.client.expire(k,600);
  }
  async clearFailure(key){await this.client.del(this.key('failed-login',key));}
}
export class RedisTickets{
  constructor(client,{prefix='mq:v2:'}={}){
    this.client=client;this.prefix=prefix;
  }
  async issue(ipHash){
    const key=this.prefix+'ticket-rate:'+hash(ipHash);
    const count=await this.client.incr(key);
    if(count===1)await this.client.expire(key,10);
    if(count>8)return null;
    const token=randomBytes(18).toString('hex');
    await this.client.set(this.prefix+'ticket:'+token,ipHash,{EX:30,NX:true});
    return token;
  }
  async consume(token,ipHash){
    if(!/^[a-f0-9]{36}$/.test(token||''))return false;
    // GETDEL is atomic: one ticket can authenticate only one connection.
    const match=await this.client.getDel(this.prefix+'ticket:'+token);
    return match!==null&&match===ipHash;
  }
}
