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

export class RedisPlayerTokens{
  constructor(client,{prefix='mq:v2:'}={}){
    this.client=client;this.prefix=prefix;
  }
  key(token){return this.prefix+'player-session:'+hash(token);}
  async issue(accountId){
    const token=randomBytes(32).toString('hex');
    await this.client.set(this.key(token),accountId,{EX:8*3600});
    return {token,expiresIn:8*3600};
  }
  async get(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    return await this.client.get(this.key(token));
  }
  async revoke(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return;
    const accountId=await this.get(token);
    if(!accountId)return;
    // Epoch prevents a pre-logout admission ticket being redeemed later.
    // The epoch expires after all prior 30s tickets have necessarily expired.
    const revisionKey=this.prefix+'ticket-revision:'+accountId;
    await this.client.multi().incr(revisionKey).expire(revisionKey,90)
      .del(this.key(token)).exec();
  }
}
