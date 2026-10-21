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
    return this;
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
  async load(id){
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return null;
    // A reconnect must not load stale progress while an earlier socket's
    // save is still in flight.
    await this.pending.get(id);
    const result=await this.pool.query('SELECT id,username,profile FROM mq_player_accounts WHERE id=$1',[id]);
    return result.rows[0]||null;
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
