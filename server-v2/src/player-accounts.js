// Independently implemented persistent player accounts. Only the server
// writes gameplay snapshots: public clients cannot submit resources or XP.
import { randomUUID } from 'node:crypto';
import { passwordHash, passwordMatches } from './auth.js';

const USERNAME=/^[a-zA-Z0-9_]{3,20}$/;
export function validUsername(value){return typeof value==='string'&&USERNAME.test(value);}
export class PlayerAccounts{
  constructor(pool){this.pool=pool;this.pending=new Map();}
  async init(){
    await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_player_accounts(
      id UUID PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_clans (
      id UUID PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE CHECK (tag ~ '^[A-Za-z0-9]{1,7}$'),
      owner_account_id UUID NOT NULL REFERENCES mq_player_accounts(id)
        ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_clan_members (
      clan_id UUID NOT NULL REFERENCES mq_clans(id) ON DELETE CASCADE,
      account_id UUID PRIMARY KEY REFERENCES mq_player_accounts(id)
        ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    return this;
  }
  // Admin-only paginated metadata; never query or serialize password_hash/profile.
  async listRegistered({page=1,limit=25,search=''}={}){
    const safePage=Number.isSafeInteger(page)?Math.min(100000,Math.max(1,page)):1;
    const safeLimit=Number.isSafeInteger(limit)?Math.min(50,Math.max(1,limit)):25;
    const safeSearch=typeof search==='string'?search.trim().slice(0,40).toLowerCase():'';
    const where="WHERE ($1::text = '' OR position($1 in username_key)>0)";
    const count=await this.pool.query(
      `SELECT count(*)::integer AS total FROM mq_player_accounts ${where}`,[safeSearch]);
    const result=await this.pool.query(
      `SELECT id,username,created_at,saved_at FROM mq_player_accounts ${where}
       ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
      [safeSearch,safeLimit,(safePage-1)*safeLimit]);
    return {
      total:Number(count.rows[0]?.total||0),page:safePage,limit:safeLimit,
      accounts:result.rows.map(r=>({id:r.id,username:r.username,
        createdAt:r.created_at,savedAt:r.saved_at}))
    };
  }
  async listClanTags(){
    const result=await this.pool.query('SELECT tag FROM mq_clans');
    return result.rows.map(r=>r.tag);
  }
  async clanOf(accountId){
    const result=await this.pool.query(`SELECT c.tag,c.owner_account_id AS "ownerAccountId"
      FROM mq_clan_members m JOIN mq_clans c ON c.id=m.clan_id
      WHERE m.account_id=$1`,[accountId]);
    return result.rows[0]||null;
  }
  async createClan(ownerId,tag){
    if(typeof tag!=='string'||!/^[A-Za-z0-9]{1,7}$/.test(tag))
      throw Object.assign(new Error('invalid_clan_name'),{status:400});
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const clanId=randomUUID();
      await client.query('INSERT INTO mq_clans(id,tag,owner_account_id) VALUES($1,$2,$3)',
        [clanId,tag,ownerId]);
      await client.query('INSERT INTO mq_clan_members(clan_id,account_id) VALUES($1,$2)',
        [clanId,ownerId]);
      await client.query('COMMIT');
      return {tag,ownerAccountId:ownerId};
    }catch(err){
      await client.query('ROLLBACK');
      if(err.code==='23505')throw Object.assign(new Error('clan_taken_or_already_member'),{status:409});
      throw err;
    }finally{client.release();}
  }
  async joinClan(ownerId,memberId,tag){
    if(!ownerId||!memberId||ownerId===memberId)return false;
    try{
      const result=await this.pool.query(`INSERT INTO mq_clan_members(clan_id,account_id)
        SELECT id,$2 FROM mq_clans WHERE tag=$1 AND owner_account_id=$3
        RETURNING account_id`,[tag,memberId,ownerId]);
      return result.rowCount===1;
    }catch(err){
      if(err.code==='23505')return false;
      throw err;
    }
  }
  async leaveClan(accountId){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      const match=await client.query(`SELECT c.id,c.tag,c.owner_account_id
        FROM mq_clans c JOIN mq_clan_members m ON c.id=m.clan_id
        WHERE m.account_id=$1 FOR UPDATE OF c`,[accountId]);
      if(!match.rowCount){await client.query('ROLLBACK');return null;}
      const clan=match.rows[0],owner=clan.owner_account_id===accountId;
      if(owner)await client.query('DELETE FROM mq_clans WHERE id=$1',[clan.id]);
      else await client.query('DELETE FROM mq_clan_members WHERE account_id=$1',[accountId]);
      await client.query('COMMIT');
      return {tag:clan.tag,disbanded:owner};
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  async register(username,password){
    if(!validUsername(username))throw Object.assign(new Error('invalid_username'),{status:400});
    let encoded;
    try{encoded=passwordHash(password);}
    catch{throw Object.assign(new Error('invalid_password'),{status:400});}
    const id=randomUUID();
    try{
      await this.pool.query(
        'INSERT INTO mq_player_accounts(id,username,username_key,password_hash) VALUES($1,$2,$3,$4)',
        [id,username,username.toLowerCase(),encoded]);
    }catch(e){
      if(e.code==='23505')throw Object.assign(new Error('username_taken'),{status:409});
      throw e;
    }
    return {id,username};
  }
  async authenticate(username,password){
    if(!validUsername(username)||typeof password!=='string'||password.length>128)return null;
    const result=await this.pool.query(
      'SELECT id,username,password_hash FROM mq_player_accounts WHERE username_key=$1',
      [username.toLowerCase()]);
    const row=result.rows[0];
    if(!row||!passwordMatches(password,row.password_hash))return null;
    return {id:row.id,username:row.username};
  }
  async changePassword(id,currentPassword,nextPassword){
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))
      return false;
    if(typeof nextPassword!=='string'||nextPassword.length<12||nextPassword.length>128)
      throw Object.assign(new Error('invalid_new_password'),{status:400});
    // Compare-and-swap prevents overlapping requests from resurrecting
    // an old password or replacing a change made in another process.
    const found=await this.pool.query(
      'SELECT password_hash FROM mq_player_accounts WHERE id=$1',[id]);
    const previous=found.rows[0]?.password_hash;
    if(!previous||!passwordMatches(currentPassword,previous))return false;
    const next=passwordHash(nextPassword);
    const updated=await this.pool.query(
      'UPDATE mq_player_accounts SET password_hash=$1 WHERE id=$2 AND password_hash=$3',
      [next,id,previous]);
    return updated.rowCount===1;
  }
  async load(id){
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return null;
    // A reconnect must not load stale progress while an earlier socket's
    // save is still in flight.
    await this.pending.get(id);
    const result=await this.pool.query('SELECT id,username,profile FROM mq_player_accounts WHERE id=$1',[id]);
    const player=result.rows[0]||null;
    if(player)player.clan=await this.clanOf(id);
    return player;
  }
  save(id,profile){
    if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('invalid account id');
    const data=JSON.stringify(profile);
    if(data.length>16000)throw new Error('player profile too large');
    const prior=this.pending.get(id)||Promise.resolve();
    const task=prior.catch(()=>{}).then(async()=>{
      const result=await this.pool.query(
        'UPDATE mq_player_accounts SET profile=$2::jsonb,saved_at=now() WHERE id=$1',
        [id,data]);
      if(result.rowCount!==1)throw new Error('player account no longer exists');
    });
    this.pending.set(id,task);
    void task.finally(()=>{if(this.pending.get(id)===task)this.pending.delete(id);}).catch(()=>{});
    return task;
  }
  async flush(){await Promise.all([...this.pending.values()]);}
}
