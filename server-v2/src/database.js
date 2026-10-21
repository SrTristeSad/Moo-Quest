// PostgreSQL is authoritative for persistent V2 administration data.
// No writes to the old JSON config during normal server operation.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { dataDirectory, loadJSON } from './storage.js';

export const freshState=()=>({
  schema:1,owner:null,settings:{title:'MooQuest',motd:'Bem-vindo ao mundo!',
    maxPlayers:60,maintenance:false,publicRegistration:false},
  bans:{},announcements:[],audit:[]
});
function validate(data){
  if(!data||data.schema!==1||!data.settings||
    !data.bans||!Array.isArray(data.audit)||!Array.isArray(data.announcements))
    throw new Error('Unsupported or damaged MooQuest PostgreSQL state schema');
  return data;
}
export class PostgresStorage{
  constructor(root,{pool=null,connectionString=process.env.MOO_DATABASE_URL,
    importLegacy=process.env.MOO_IMPORT_JSON==='1'}={}){
    if(!pool&&!connectionString)throw new Error('Set MOO_DATABASE_URL to enable PostgreSQL');
    this.dir=dataDirectory(root);
    this.ownsPool=!pool;
    this.pool=pool||new pg.Pool({connectionString,
      max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
    this.importLegacy=importLegacy;
    this.data=null;
    this.pending=Promise.resolve();
  }
  async init(){
    // Startup fails closed on connection or schema errors. Only one row holds
    // the admin settings while the first-party game's state remains in RAM.
    await this.pool.query(`CREATE TABLE IF NOT EXISTS mq_admin_state (
      id SMALLINT PRIMARY KEY CHECK (id=1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    let initial=freshState();
    if(this.importLegacy){
      const legacy=path.join(this.dir,'config.json');
      if(fs.existsSync(legacy))initial=validate(loadJSON(legacy,initial));
    }
    await this.pool.query('INSERT INTO mq_admin_state(id,payload) VALUES(1,$1::jsonb) ON CONFLICT (id) DO NOTHING',
      [JSON.stringify(initial)]);
    const rows=await this.pool.query('SELECT payload FROM mq_admin_state WHERE id=1');
    if(rows.rowCount!==1)throw new Error('PostgreSQL admin state unavailable');
    this.data=validate(rows.rows[0].payload);
    return this;
  }
  save(){
    if(!this.data)throw new Error('PostgreSQL storage not initialized');
    const snapshot=JSON.stringify(validate(this.data));
    const operation=this.pending.then(()=>this.pool.query(
      'UPDATE mq_admin_state SET payload=$1::jsonb, updated_at=now() WHERE id=1',
      [snapshot])).then(result=>{
      if(result.rowCount!==1)throw new Error('PostgreSQL state update affected no rows');
    });
    // Preserve ordering even after a failed query; never ignore the error
    // returned to the HTTP request that initiated the write.
    this.pending=operation.catch(()=>{});
    return operation;
  }
  audit(kind,extra={}){
    this.data.audit.push({at:new Date().toISOString(),kind,...extra});
    if(this.data.audit.length>500)this.data.audit.splice(0,this.data.audit.length-500);
    return this.save();
  }
  async close(){
    await this.pending;
    if(this.ownsPool)await this.pool.end();
  }
}
