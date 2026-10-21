// Ephemeral Redis services: eight-hour admin sessions, login throttling,
// and short-lived single-use native-client tickets. Never store passwords.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { createClient } from 'redis';
import { Auth } from './auth.js';
const hash=v=>createHash('sha256').update(String(v)).digest('hex');
// Increment and install the TTL in one Redis operation: a connection loss
// cannot leave a permanent registration/login/ticket throttle key behind.
const INCREMENT_TTL=`
local n=redis.call('INCR',KEYS[1])
if n==1 then redis.call('EXPIRE',KEYS[1],tonumber(ARGV[1])) end
return n
`;
async function incrementWithTTL(client,key,seconds){
  return Number(await client.eval(INCREMENT_TTL,{keys:[key],arguments:[String(seconds)]}));
}
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
  isHealthy(){return this.client.isReady===true;}
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
  async allowRegistration(key){
    const count=await incrementWithTTL(this.client,this.key('registration',key),60);
    return count<=3;
  }
  async loginBlocked(key){
    const count=Number(await this.client.get(this.key('failed-login',key)))||0;
    return count>=5;
  }
  async recordFailure(key){
    const k=this.key('failed-login',key);
    await incrementWithTTL(this.client,k,600);
  }
  async clearFailure(key){await this.client.del(this.key('failed-login',key));}
}
export class RedisTickets{
  constructor(client,{prefix='mq:v2:'}={}){
    this.client=client;this.prefix=prefix;
  }
  async issue(ipHash,accountId=null){
    const key=this.prefix+'ticket-rate:'+hash(ipHash);
    const count=await incrementWithTTL(this.client,key,10);
    if(count>8)return null;
    const token=randomBytes(18).toString('hex');
    const revision=accountId?
      String(await this.client.get(this.prefix+'ticket-revision:'+accountId)||'0'):null;
    await this.client.set(this.prefix+'ticket:'+token,
      JSON.stringify({ipHash,accountId,revision}),{EX:30,NX:true});
    return token;
  }
  async consumeDetails(token,ipHash){
    if(!/^[a-f0-9]{36}$/.test(token||''))return null;
    // GETDEL is atomic and burns a token even on identity mismatch.
    const payload=await this.client.getDel(this.prefix+'ticket:'+token);
    if(!payload)return null;
    const claim=JSON.parse(payload);
    if(claim.ipHash!==ipHash)return null;
    if(claim.accountId){
      const revision=String(await this.client.get(
        this.prefix+'ticket-revision:'+claim.accountId)||'0');
      if(revision!==claim.revision)return null;
    }
    return {accountId:claim.accountId||null};
  }
  async consume(token,ipHash){
    return Boolean(await this.consumeDetails(token,ipHash));
  }
}

// Player sessions: 8h access tokens + 30d rotating refresh tokens.
// Redis receives hashes only; raw session credentials are returned once.
// A per-account generation invalidates all devices without scanning Redis.
export class RedisPlayerTokens{
  constructor(client,{prefix='mq:v2:'}={}){
    this.client=client;this.prefix=prefix;
  }
  key(token){return this.prefix+'player-session:'+hash(token);}
  refreshKey(token){return this.prefix+'player-refresh:'+hash(token);}
  generationKey(accountId){return this.prefix+'player-generation:'+accountId;}
  ticketRevisionKey(accountId){return this.prefix+'ticket-revision:'+accountId;}
  async generation(accountId){
    return String(await this.client.get(this.generationKey(accountId))||'0');
  }
  async issue(accountId){
    if(typeof accountId!=='string'||!/^[a-f0-9-]{36}$/i.test(accountId))
      throw new Error('Invalid player account');
    const token=randomBytes(32).toString('hex');
    const refreshToken=randomBytes(32).toString('hex');
    const generation=await this.generation(accountId);
    const refreshHash=hash(refreshToken),accessHash=hash(token);
    const session={accountId,generation,refreshHash};
    const refresh={accountId,generation,accessHash};
    await this.client.multi()
      .set(this.key(token),JSON.stringify(session),{EX:8*3600})
      .set(this.refreshKey(refreshToken),JSON.stringify(refresh),{EX:30*24*3600})
      .exec();
    return {token,refreshToken,tokenType:'Bearer',
      expiresIn:8*3600,refreshExpiresIn:30*24*3600};
  }
  async get(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    const raw=await this.client.get(this.key(token));
    if(!raw)return null;
    let record;
    try{record=JSON.parse(raw);}catch{return null;}
    if(typeof record?.accountId!=='string'||typeof record?.generation!=='string')
      return null;
    return record.generation===await this.generation(record.accountId)?
      record.accountId:null;
  }
  async revoke(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    const raw=await this.client.get(this.key(token));
    if(!raw)return null;
    let record;
    try{record=JSON.parse(raw);}catch{return null;}
    if(!record?.accountId)return null;
    await this.client.multi()
      .del(this.key(token))
      .del(this.prefix+'player-refresh:'+record.refreshHash)
      .exec();
    await this.invalidateTickets(record.accountId);
    return record.accountId;
  }
  async revokeRefresh(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    const raw=await this.client.getDel(this.refreshKey(token));
    if(!raw)return null;
    let record;
    try{record=JSON.parse(raw);}catch{return null;}
    if(!record?.accountId||typeof record.accessHash!=='string')return null;
    await this.client.del(this.prefix+'player-session:'+record.accessHash);
    await this.invalidateTickets(record.accountId);
    return record.accountId;
  }
  async refresh(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    // GETDEL enforces single-use rotation even across parallel API instances.
    const raw=await this.client.getDel(this.refreshKey(token));
    if(!raw)return null;
    let record;
    try{record=JSON.parse(raw);}catch{return null;}
    if(typeof record?.accountId!=='string'||typeof record?.generation!=='string'||
      typeof record?.accessHash!=='string')return null;
    await this.client.del(this.prefix+'player-session:'+record.accessHash);
    if(record.generation!==await this.generation(record.accountId))return null;
    return this.issue(record.accountId);
  }
  async invalidateTickets(accountId){
    // A 90s revision covers the complete 30s join-ticket lifetime.
    const key=this.ticketRevisionKey(accountId);
    await this.client.multi().incr(key).expire(key,90).exec();
  }
  async revokeAll(accountId){
    if(typeof accountId!=='string')return;
    // Generation must outlive the longest outstanding refresh token.
    await this.client.multi()
      .incr(this.generationKey(accountId))
      .expire(this.generationKey(accountId),31*24*3600)
      .exec();
    await this.invalidateTickets(accountId);
  }
}
