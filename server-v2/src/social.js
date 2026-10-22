// Port of the friendship, whisper, clan-chat and invite logic from
// al007ex/moomoo-clone/server/src/api/{social,chat,store}.js (Apache-2.0).
// PostgreSQL replaces the upstream JSON files. Authentication comes from V2.
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {isRude} from './vendor/al007ex/nameFilter.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid=(name,status=400)=>Object.assign(new Error(name),{status});
const pair=(a,b)=>[a,b].sort();
const check=id=>typeof id==='string'&&UUID.test(id);
export class SocialService {
 constructor(pool,{clock=()=>Date.now(),redis=null}={}){
  this.pool=pool;this.clock=clock;this.sent=new Map();this.redis=redis;
 }
 async init(){
  await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_friend_requests (
   id UUID PRIMARY KEY,sender_id UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   recipient_id UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   UNIQUE(sender_id,recipient_id),CHECK(sender_id<>recipient_id))`);
  await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_friendships (
   user_a UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   user_b UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   PRIMARY KEY(user_a,user_b),CHECK(user_a<user_b))`);
  await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_social_messages (
   id UUID PRIMARY KEY,sender_id UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   recipient_id UUID REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   clan_tag TEXT,kind TEXT NOT NULL CHECK(kind IN ('whisper','clan')),
   text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 200),
   created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await this.pool.query(`CREATE INDEX IF NOT EXISTS mq_social_to_idx
   ON mq_social_messages(recipient_id,created_at DESC)`);
  await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_social_invites (
   id UUID PRIMARY KEY,sender_id UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   recipient_id UUID NOT NULL REFERENCES mq_player_accounts(id) ON DELETE CASCADE,
   server_key TEXT NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   CHECK(sender_id<>recipient_id))`);
  return this;
 }
 async account(id){
  if(!check(id))return null;
  return (await this.pool.query('SELECT id,username FROM mq_player_accounts WHERE id=$1',[id])).rows[0]||null;
 }
 async byName(name){
  if(typeof name!=='string'||!/^[A-Za-z0-9_]{3,20}$/.test(name))return null;
  return (await this.pool.query('SELECT id,username FROM mq_player_accounts WHERE username_key=$1',[name.toLowerCase()])).rows[0]||null;
 }
 async friendsOf(id){
  const r=await this.pool.query(`SELECT u.id,u.username,f.created_at AS "createdAt"
   FROM mq_friendships f JOIN mq_player_accounts u
   ON u.id=CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END
   WHERE f.user_a=$1 OR f.user_b=$1 ORDER BY f.created_at DESC`,[id]);
  return r.rows;
 }
 async areFriends(a,b){
  if(!check(a)||!check(b)||a===b)return false;
  const [x,y]=pair(a,b);
  return (await this.pool.query('SELECT 1 FROM mq_friendships WHERE user_a=$1 AND user_b=$2',[x,y])).rowCount>0;
 }
 async requests(id,outgoing=false){
  const field=outgoing?'sender_id':'recipient_id';
  const r=await this.pool.query(`SELECT id,sender_id AS "senderId",
   recipient_id AS "recipientId",created_at AS "createdAt"
   FROM mq_friend_requests WHERE ${field}=$1 ORDER BY created_at DESC LIMIT 100`,[id]);
  return r.rows;
 }
 async request(from,to){
  if(!check(to)||from===to)throw invalid('invalid_recipient');
  if(!await this.account(to))throw invalid('user_not_found',404);
  if(await this.areFriends(from,to))throw invalid('already_friends',409);
  const reverse=await this.pool.query(
   'SELECT id FROM mq_friend_requests WHERE sender_id=$1 AND recipient_id=$2',[to,from]);
  if(reverse.rowCount){await this.answer(from,reverse.rows[0].id,true);return {friends:true};}
  try{
   const r=await this.pool.query(`INSERT INTO mq_friend_requests(id,sender_id,recipient_id)
    VALUES($1,$2,$3) RETURNING id,sender_id AS "senderId",
    recipient_id AS "recipientId",created_at AS "createdAt"`,[randomUUID(),from,to]);
   return {request:r.rows[0]};
  }catch(e){if(e.code==='23505')throw invalid('request_exists',409);throw e;}
 }
 async answer(accountId,requestId,accept){
  if(!check(requestId))throw invalid('invalid_request');
  const client=await this.pool.connect();
  let active=false;
  try{
   await client.query('BEGIN');active=true;
   const found=await client.query(`SELECT sender_id,recipient_id
     FROM mq_friend_requests WHERE id=$1 AND recipient_id=$2 FOR UPDATE`,
     [requestId,accountId]);
   if(!found.rowCount)throw invalid('request_not_found',404);
   const {sender_id:from,recipient_id:to}=found.rows[0];
   if(accept){
    const [a,b]=pair(from,to);
    await client.query(`INSERT INTO mq_friendships(user_a,user_b)
      VALUES($1,$2) ON CONFLICT DO NOTHING`,[a,b]);
   }
   await client.query('DELETE FROM mq_friend_requests WHERE id=$1',[requestId]);
   if(accept)await client.query('DELETE FROM mq_friend_requests WHERE sender_id=$1 AND recipient_id=$2',[to,from]);
   await client.query('COMMIT');active=false;
   return {accepted:Boolean(accept)};
  }catch(e){if(active)await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async cancel(from,requestId){
  if(!check(requestId))throw invalid('invalid_request');
  const r=await this.pool.query('DELETE FROM mq_friend_requests WHERE id=$1 AND sender_id=$2',[requestId,from]);
  if(!r.rowCount)throw invalid('request_not_found',404);
  return {ok:true};
 }
 async remove(from,to){
  if(!check(to)||from===to)throw invalid('invalid_friend');
  const [a,b]=pair(from,to);
  const r=await this.pool.query('DELETE FROM mq_friendships WHERE user_a=$1 AND user_b=$2',[a,b]);
  if(!r.rowCount)throw invalid('friend_not_found',404);
  return {ok:true};
 }
 clean(raw){
  if(typeof raw!=='string')throw invalid('invalid_text');
  const text=raw.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,200);
  if(!text)throw invalid('empty');
  if(isRude(text)||text.split(' ').some(word=>isRude(word)))throw invalid('unclean');
  return text;
 }
 rate(id){
  const now=this.clock(),list=(this.sent.get(id)||[]).filter(t=>now-t<10000);
  if(list.length>=5){this.sent.set(id,list);throw invalid('slow_down',429);}
  list.push(now);this.sent.set(id,list);
 }
 async sameClan(a,b){
  const r=await this.pool.query(`SELECT 1 FROM mq_clan_members a
    JOIN mq_clan_members b ON a.clan_id=b.clan_id
    WHERE a.account_id=$1 AND b.account_id=$2`,[a,b]);
  return r.rowCount>0;
 }
 async whisper(from,toName,raw){
  const target=await this.byName(toName);
  if(!target||target.id===from)throw invalid('not_found',404);
  if(!await this.areFriends(from,target.id)&&!await this.sameClan(from,target.id))
   throw invalid('not_friends',403);
  const text=this.clean(raw);this.rate(from);
  const r=await this.pool.query(`INSERT INTO mq_social_messages
   (id,sender_id,recipient_id,kind,text) VALUES($1,$2,$3,'whisper',$4)
   RETURNING id`,[randomUUID(),from,target.id,text]);
  return {id:r.rows[0].id,to:target.username};
 }
 async clanTag(accountId){
  const r=await this.pool.query(`SELECT c.tag FROM mq_clan_members m JOIN mq_clans c
    ON m.clan_id=c.id WHERE m.account_id=$1`,[accountId]);
  return r.rows[0]?.tag||null;
 }
 async clanSay(from,raw){
  const tag=await this.clanTag(from);
  if(!tag)throw invalid('no_clan',403);
  const text=this.clean(raw);this.rate(from);
  const r=await this.pool.query(`INSERT INTO mq_social_messages
   (id,sender_id,clan_tag,kind,text) VALUES($1,$2,$3,'clan',$4)
   RETURNING id`,[randomUUID(),from,tag,text]);
  return {id:r.rows[0].id};
 }
 async history(from,kind,withName){
  if(kind==='whisper'){
   const target=await this.byName(withName);
   if(!target)throw invalid('not_found',404);
   const r=await this.pool.query(`SELECT m.id,m.text,m.created_at AS "at",
     a.username AS "from",b.username AS "to"
    FROM mq_social_messages m JOIN mq_player_accounts a ON a.id=m.sender_id
    JOIN mq_player_accounts b ON b.id=m.recipient_id
    WHERE m.kind='whisper' AND
    ((m.sender_id=$1 AND m.recipient_id=$2) OR
     (m.sender_id=$2 AND m.recipient_id=$1))
    ORDER BY m.created_at DESC LIMIT 100`,[from,target.id]);
   return {messages:r.rows.reverse()};
  }
  if(kind==='clan'){
   const tag=await this.clanTag(from);
   if(!tag)throw invalid('no_clan',403);
   const r=await this.pool.query(`SELECT m.id,m.text,m.created_at AS "at",
    a.username AS "from" FROM mq_social_messages m
    JOIN mq_player_accounts a ON a.id=m.sender_id
    WHERE m.kind='clan' AND m.clan_tag=$1
    ORDER BY m.created_at DESC LIMIT 100`,[tag]);
   return {messages:r.rows.reverse()};
  }
  throw invalid('invalid_kind');
 }
 async inviteId(from,to){
  if(!check(to)||to===from||!await this.areFriends(from,to))
   throw invalid('not_friends',403);
  this.rate(from);
  const r=await this.pool.query(`INSERT INTO mq_social_invites
    (id,sender_id,recipient_id,server_key) VALUES($1,$2,$3,'LC')
    RETURNING id`,[randomUUID(),from,to]);
  return {id:r.rows[0].id,server:'LC'};
 }
 async invite(from,toName){
  const target=await this.byName(toName);
  if(!target||target.id===from)throw invalid('not_found',404);
  return {...await this.inviteId(from,target.id),to:target.username};
 }
 async issueSocketTicket(accountId){
  if(!this.redis||!check(accountId))throw invalid('social_ws_unavailable',503);
  const ticket=randomBytes(24).toString('hex');
  const key='mq:v2:social:ticket:'+createHash('sha256').update(ticket).digest('hex');
  // Match the single-use game tickets' account revision: a logout,
  // password change or refresh invalidates unconsumed social WS tickets.
  const revision=String(await this.redis.get('mq:v2:ticket-revision:'+accountId)||'0');
  await this.redis.set(key,JSON.stringify({accountId,revision}),{EX:30,NX:true});
  return {ticket,expiresIn:30};
 }
 async consumeSocketTicket(ticket){
  if(!this.redis||typeof ticket!=='string'||!/^[a-f0-9]{48}$/.test(ticket))
    return null;
  const key='mq:v2:social:ticket:'+createHash('sha256').update(ticket).digest('hex');
  const raw=await this.redis.getDel(key);
  let value;
  try{value=JSON.parse(raw);}catch{return null;}
  if(!check(value?.accountId)||typeof value?.revision!=='string')return null;
  const current=String(await this.redis.get(
    'mq:v2:ticket-revision:'+value.accountId)||'0');
  if(current!==value.revision)return null;
  return await this.account(value.accountId)?value.accountId:null;
 }
 async inbox(accountId){
  const r=await this.pool.query(`SELECT i.id,a.username AS "from",
    i.server_key AS server,i.created_at AS "at"
    FROM mq_social_invites i JOIN mq_player_accounts a ON a.id=i.sender_id
    WHERE i.recipient_id=$1 AND i.created_at>now()-interval '7 days'
    ORDER BY i.created_at DESC LIMIT 50`,[accountId]);
  return {invites:r.rows};
 }
}
