// First-party Moo-Quest V2 server. Binary interop with the EXISTING LÖVE
// client is enabled on /s/LC; JSON /play remains disabled by default and
// is retained only for internal development tests.
// Does not import legacy gameplay/server modules.
import { WebSocketServer } from 'ws';
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { requestIdentity } from './request-identity.js';
import { World } from './world.js';
import { NativeSession } from './native-protocol.js';
import { filter_chat } from './vendor/al007ex/filterchat.js';
export class GameServer {
  constructor(httpServer, storage, ticketStore=null, {accounts=null,reservedClanTags=[]}={}) {
    this.ticketStore=ticketStore;
    this.accounts=accounts;
    this.activeAccounts=new Set();
    this.profileWrites=new Set();
    this.unsavedProfiles=new Map();
    this.profileRecoveries=new Map();
    this.storage = storage;
    const keyFile = path.join(storage.dir, 'mod-secret.key');
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
    this.banKey = fs.readFileSync(keyFile);
    this.room = new World({ maxPlayers: storage.data.settings.maxPlayers });
    this.room.reservedTribeTags=new Set(reservedClanTags);
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
    this.nativeWss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
    this.nativeClients = new Map();
    this.tickets = new Map();
    this.ticketRate = new Map();
    this.online = new Map();
    this.loop = null;
    this.counter = 0;
    httpServer.on('upgrade', async (req, socket, head) => {
      try {
      let location;
      try { location = new URL(req.url, 'http://localhost'); }
      catch { socket.destroy(); return; }
      if (!['/play','/s/LC'].includes(location.pathname) ||
          (location.pathname==='/play' &&
            (process.env.MOO_DEV_JSON!=='1'||process.env.MOO_PUBLIC_MODE==='1'||
              this.storage.data.settings.allowGuests===false)) ||
          this.storage.data.settings.maintenance ||
          this.room.players.size >= this.room.maxPlayers) { socket.destroy(); return; }
      const origin = req.headers.origin;
      if (origin) {
        try { if (new URL(origin).host !== req.headers.host) { socket.destroy(); return; } }
        catch { socket.destroy(); return; }
      }
      const {address,trustedOrigin}=requestIdentity(req);
      const ipHash = createHmac('sha256', this.banKey).update(address).digest('hex');
      if (this.storage.data.bans[ipHash]) { socket.destroy(); return; }
      if (location.pathname === '/s/LC') {
        if (location.searchParams.get('b') !== 'mqv2native') { socket.destroy(); return; }
        const ticket=location.searchParams.get('token');
        let claim=null;
        if(ticket&&ticket.startsWith('tk:')){
          claim=this.ticketStore?.consumeDetails?
            await this.ticketStore.consumeDetails(ticket.slice(3),ipHash):
            await this.consumeTicket(ticket.slice(3),ipHash)?{accountId:null}:null;
        }
        if(!claim||(!claim.accountId&&this.storage.data.settings.allowGuests===false)) {
          socket.destroy();return;
        }
        this.nativeWss.handleUpgrade(req,socket,head,
          ws=>this.connectNative(ws,ipHash,trustedOrigin,claim.accountId));
        return;
      }
      this.wss.handleUpgrade(req, socket, head, ws => this.connect(ws, ipHash, trustedOrigin));
      } catch(error) {
        console.error('[MooQuest] WebSocket ingress unavailable:',error.message);
        socket.destroy();
      }
    });
  }
  async issueTicket(req, body, accountId=null) {
    if (this.storage.data.settings.maintenance || this.room.players.size >= this.room.maxPlayers ||
        (!accountId&&this.storage.data.settings.allowGuests===false))
      return null;
    if (!body || (!accountId && body.captcha !== true) || typeof body.host !== 'string' ||
        !/\/s\/LC\/?$/.test(body.host)) return null;
    // Browser auto-verification is not claimed here: this is an explicit
    // development guest ingress with independent IP rate limiting.
    const ipHash=createHmac('sha256',this.banKey).update(requestIdentity(req).address).digest('hex');
    if(this.ticketStore){
      const ticket=await this.ticketStore.issue(ipHash,accountId);
      if(!ticket)return null;
      const did=(typeof body.did==='string'&&/^[a-f0-9]{16,64}$/.test(body.did))?
        body.did:randomBytes(16).toString('hex');
      return {ticket,did};
    }
    if(accountId)return null; // Registered sessions require Redis-bound tickets.
    const now=Date.now(), previous=this.ticketRate.get(ipHash)||[];
    const recent=previous.filter(ts=>now-ts<10000);
    if(recent.length>=8) {this.ticketRate.set(ipHash,recent);return null;}
    recent.push(now);this.ticketRate.set(ipHash,recent);
    const ticket=randomBytes(18).toString('hex');
    const did=(typeof body.did==='string'&&/^[a-f0-9]{16,64}$/.test(body.did))?body.did:randomBytes(16).toString('hex');
    this.tickets.set(ticket,{at:now,ipHash});
    if(this.tickets.size>1024){for(const [t,x] of this.tickets)if(now-x.at>30000)this.tickets.delete(t);}
    return {ticket,did};
  }
  async consumeTicket(token,ipHash){
    if(this.ticketStore)return this.ticketStore.consume(token,ipHash);
    const grant=this.tickets.get(token);this.tickets.delete(token);
    return !!grant && Date.now()-grant.at<30000 && grant.ipHash===ipHash;
  }
  connectNative(ws,ipHash,trustedOrigin,accountId=null) {
    const session=new NativeSession();
    const state={ws,session,p:null,held:false,lastSnapshotAt:0,spawning:false,
      accountId:null,grantedAccountId:accountId,clanBusy:false,
      autoAttack:false,lockDir:false,watchSid:null,
      lastChatAt:0,lastMapPingAt:0,
      supportsBossWarnings:false};
    this.nativeClients.set(ws,state);
    ws.send(session.handshake());
    const send=(name,args=[])=>{
      if(ws.readyState!==ws.OPEN)return;
      try{ws.send(session.encode(name,args),{binary:true});}
      catch{ws.close(1008,'packet_error');}
    };
    state.send=send;
    let count=0,windowAt=Date.now();
    ws.on('message',async (raw,isBinary)=>{
      if(!isBinary){ws.close(1003,'binary_only');return;}
      const now=Date.now();if(now-windowAt>=1000){windowAt=now;count=0;}
      if(++count>32){ws.close(1008,'rate_limit');return;}
      let request;
      try{request=session.decode(raw);}catch{ws.close(1008,'invalid_packet');return;}
      const {name,args}=request;
      if(state.spawning)return;
      if(name==='Y'){
        // Presentation-only, opt-in extension. Never grants account rights,
        // inventory, damage, movement, or any gameplay authority.
        if(args.length===1&&args[0]===1)state.supportsBossWarnings=true;
        return;
      }
      if(name==='M'){
        if(!state.p){
          if(!accountId&&this.storage.data.settings.allowGuests===false){
            ws.close(1008,'guests_disabled');return;
          }
          const profile=args[0];
          if(!profile||typeof profile.name!=='string'){ws.close(1008,'bad_spawn');return;}
          state.spawning=true;
          try{
            let saved=null;
            if(accountId){
              // Existing online sessions always retain exclusive ownership,
              // even if an earlier periodic save temporarily failed.
              if([...this.room.players.values()].some(p=>p.accountId===accountId)){
                ws.close(1008,'account_in_use');return;
              }
              if(this.unsavedProfiles.has(accountId))await Promise.all([...this.profileWrites]);
              // Recover the latest authoritative snapshot before allowing
              // login after a previous database write failure.
              if(this.unsavedProfiles.has(accountId)){
                let retry=this.profileRecoveries.get(accountId);
                if(!retry){
                  retry=this.accounts.save(accountId,this.unsavedProfiles.get(accountId))
                    .then(()=>{this.unsavedProfiles.delete(accountId);this.activeAccounts.delete(accountId);})
                    .finally(()=>this.profileRecoveries.delete(accountId));
                  this.profileRecoveries.set(accountId,retry);
                }
                await retry;
              }
              if(!this.accounts||this.activeAccounts.has(accountId)){
                ws.close(1008,'account_in_use');return;
              }
              this.activeAccounts.add(accountId);state.accountId=accountId;
              saved=await this.accounts.load(accountId);
              if(!saved){ws.close(1008,'unknown_account');return;}
            }
            if(ws.readyState!==ws.OPEN)return;
            if(!accountId&&this.storage.data.settings.allowGuests===false){
              ws.close(1008,'guests_disabled');return;
            }
            state.p=this.room.join(ws,saved?.username||profile.name,saved?.profile,state.accountId);
            if(saved?.clan&&!this.room.restoreClan(state.p,saved.clan)){
              throw new Error('Persisted clan conflicts with existing online clan tag');
            }
            state.p.native=true;
            if(!saved)state.p.skinColor=Number.isInteger(profile.skin)?
              Math.max(0,Math.min(9,profile.skin)):0;
            state.p.ipHash=ipHash;state.p.trustedOrigin=trustedOrigin;
            this.online.set(state.p.id,ws);
          }catch(error){
            console.error('[MooQuest] player entry failure:',error.message);
            send('B',['server unavailable']);ws.close(1011,'spawn_error');return;
          }finally{
            state.spawning=false;
            if(!state.p&&state.accountId){
              this.activeAccounts.delete(state.accountId);state.accountId=null;
            }
          }
        }else if(!this.room.respawn(state.p.id))return;
        // Actual Lua client requires C before its own D on EVERY spawn.
        for(const [packet,values] of this.room.initialPackets(state.p))send(packet,values);
        // Restore the catalog unlock flags already owned by an authenticated
        // player. This uses only existing '5' Lua protocol messages.
        if(state.accountId){
          for(const id of state.p.ownedHats)if(id!==0)send('5',[0,id,0]);
          for(const id of state.p.ownedAccessories)if(id!==0)send('5',[0,id,1]);
          if(state.p.hat)send('5',[1,state.p.hat,0]);
          if(state.p.tail)send('5',[1,state.p.tail,1]);
        }
        for(const other of this.nativeClients.values()) {
          if(other!==state&&other.p){
            other.send('D',[this.room.playerData(state.p),false]);
            const owned=[...this.room.structures.values()].filter(o=>o.owner===state.p.sid);
            if(owned.length)other.send('H',[owned.flatMap(o=>[
              o.sid,o.x,o.y,0,o.scale,o.type,o.id,o.owner])]);
          }
        }
        if(state.p.team)this._syncTribes();
        return;
      }
      const p=state.p;if(!p)return;
      if(name==='9')this.room.direction(p.id,args[0]);
      else if(name==='D'){
        if(!state.lockDir)this.room.aim(p.id,args[0]);
      }
      else if(name==='K'){
        // Original Lua key E toggles auto-hit; X toggles locked direction.
        // Both are server-owned states and cannot bypass the attack cooldown.
        if(args[0]===1)state.autoAttack=!state.autoAttack;
        else if(args[0]===0)state.lockDir=!state.lockDir;
      }
      else if(name==='V'){
        // Profile/card data: this is an outgoing request, not the
        // similarly named inventory packet sent FROM the server.
        const sid=args[0];
        if(sid===-1)state.watchSid=null;
        else if(Number.isSafeInteger(sid)&&sid>=0&&
            [...this.room.players.values()].some(other=>other.sid===sid)){
          state.watchSid=sid;
          this._sendNativeProfile(state,sid);
          this._sendNativeStats(state,sid);
        }
      }
      else if(name==='e'){p.vx=0;p.vy=0;}
      else if(name==='F'){
        state.held=args[0]===1;
        if(Number.isFinite(args[1]))this.room.aim(p.id,args[1]);
        if(state.held && this.room.attack(p.id) && p.buildIndex<0)
          this._nativeBroadcast('K',[p.sid,1,p.weaponIndex]);
        if(p.buildIndex>=0)state.held=false; // placement is a single action
      }
      else if(name==='z')this.room.select(p.id,args[0],args[1]===true);
      else if(name==='c'){
        // The Lua shop REQUEST uses 0=equipment and 1=purchase, but its
        // incoming packet 5 uses 0=unlocked purchase and 1=equipped item.
        // That mapping is intentionally inverted by the client's contract.
        if(this.room.shop(p.id,args[0],args[1],args[2]===1)){
          send('5',[args[0]===1?0:1,args[1],args[2]===1?1:0]);
          if(args[0]===1)send('N',['points',p.resources.points,1]);
        }
      }
      else if(name==='H')this.room.upgrade(p.id,args[0]);
      else if(name==='L'){
        const tag=args[0];
        if(p.accountId&&this.accounts){
          if(state.clanBusy||p.team||this.room.tribes.has(tag)||
            this.room.reservedTribeTags.has(tag))return;
          state.clanBusy=true;
          try{
            const clan=await this.accounts.createClan(p.accountId,tag);
            this.room.reservedTribeTags.add(tag);
            if(this.room.players.has(p.id)&&this.room.restoreClan(p,clan))
              this._syncTribes();
          }catch(error){console.error('[MooQuest] clan create rejected:',error.message);}
          finally{state.clanBusy=false;}
        }else if(this.room.createTribe(p.id,tag))this._syncTribes();
      }
      else if(name==='N'){
        if(state.clanBusy)return;
        const tribe=p.team&&this.room.tribes.get(p.team);
        if(tribe?.persistent){
          if(!p.accountId||!this.accounts)return;
          state.clanBusy=true;
          try{
            const result=await this.accounts.leaveClan(p.accountId);
            if(result?.disbanded)this.room.disbandTribe(result.tag);
            else if(result)this.room.leaveTribe(p.id);
            if(result)this._syncTribes();
          }catch(error){console.error('[MooQuest] clan leave failed:',error.message);}
          finally{state.clanBusy=false;}
        }else if(this.room.leaveTribe(p.id))this._syncTribes();
      }
      else if(name==='Q'){
        // Native client Tribe/Kick button: only the active owner can remove
        // an existing member, and persistent membership must change in SQL.
        const memberSid=args[0];
        const member=[...this.room.players.values()].find(x=>x.sid===memberSid);
        const tribe=p.team&&this.room.tribes.get(p.team);
        if(!member||!tribe||tribe.owner!==p.id||member.id===p.id||
          member.team!==p.team||state.clanBusy)return;
        if(tribe.persistent){
          if(!p.accountId||!member.accountId||!this.accounts)return;
          state.clanBusy=true;
          try{
            if(await this.accounts.kickClanMember(p.accountId,member.accountId,p.team))
              this.room.kickTribe(p.id,memberSid)&&this._syncTribes();
          }catch(error){console.error('[MooQuest] clan kick failed:',error.message);}
          finally{state.clanBusy=false;}
        }else if(this.room.kickTribe(p.id,memberSid))this._syncTribes();
      }
      else if(name==='b'){
        const target=this.room.tribes.get(args[0]);
        if(!target?.persistent||p.accountId)this.room.requestTribe(p.id,args[0]);
      }
      else if(name==='P'){
        if(state.clanBusy)return;
        const requestedSid=args[0],allow=args[1]===true;
        const tribe=p.team&&this.room.tribes.get(p.team);
        if(allow&&tribe?.persistent){
          const applicant=[...this.room.players.values()].find(x=>x.sid===requestedSid);
          if(!p.accountId||!applicant?.accountId||
            tribe.owner!==p.id||!tribe.requests.has(applicant.id))return;
          state.clanBusy=true;
          try{
            if(await this.accounts.joinClan(p.accountId,applicant.accountId,p.team)&&
              this.room.answerTribe(p.id,requestedSid,true))this._syncTribes();
          }catch(error){console.error('[MooQuest] clan invitation failed:',error.message);}
          finally{state.clanBusy=false;}
        }else if(this.room.answerTribe(p.id,requestedSid,allow))this._syncTribes();
      }
      else if(name==='6'&&typeof args[0]==='string'){
        // Original filter_chat() is vendored under the upstream license;
        // a per-connection cooldown prevents flooding the native broadcast.
        if(now-state.lastChatAt<700)return;
        const txt=filter_chat(args[0].replace(/[\x00-\x1f\x7f]/g,''));
        if(txt){
          state.lastChatAt=now;
          this._nativeBroadcast('6',[p.sid,txt]);
        }
      }
      else if(name==='S'){
        // The upstream map ping is private to the sender and their team.
        if(p.hp<=0||now-state.lastMapPingAt<3000)return;
        state.lastMapPingAt=now;
        for(const client of this.nativeClients.values()){
          if(client.p&&(client.p===p||(p.team&&client.p.team===p.team)))
            client.send('9',[Math.round(p.x),Math.round(p.y)]);
        }
      }
      else if(name==='0')send('0',[]);
    });
    ws.on('close',()=>{
      this.nativeClients.delete(ws);
      if(state.p){
        // Capture before leave removes the player and their temporary
        // structures. A reconnect cannot race the queued save.
        const save=this.persistPlayer(state.p);
        this.online.delete(state.p.id);this.room.leave(state.p.id);
        this._nativeBroadcast('E',[state.p.id]);this._nativeBroadcast('R',[state.p.sid]);this._syncTribes();
        if(state.accountId){
          if(save)void save.then(ok=>{
            if(ok)this.activeAccounts.delete(state.accountId);
            else console.error('[MooQuest] Account remains locked until PostgreSQL recovery');
          });
          else this.activeAccounts.delete(state.accountId);
        }
      }
    });
    ws.on('error',()=>{});
  }
  persistPlayer(p){
    if(!this.accounts||!p.accountId)return null;
    const snapshot=this.room.persistentProfile(p);
    let task;
    task=Promise.resolve().then(()=>this.accounts.save(p.accountId,snapshot))
      .then(()=>{
        this.unsavedProfiles.delete(p.accountId);
        return true;
      },error=>{
        this.unsavedProfiles.set(p.accountId,snapshot);
        console.error('[MooQuest] player save failed:',error.message);
        return false;
      }).finally(()=>this.profileWrites.delete(task));
    this.profileWrites.add(task);
    return task;
  }
  _sendNativeProfile(state,sid){
    const target=[...this.room.players.values()].find(p=>p.sid===sid);
    if(!target||!state.p)return;
    // Public display information only. Never disclose account IDs, tokens,
    // hashes, addresses, DB snapshots or moderator-private identifiers.
    const profile={name:target.name,guest:!target.accountId,anon:false};
    if(target.team)profile.clan={name:target.team};
    state.send('p',[sid,JSON.stringify(profile)]);
  }
  _sendNativeStats(state,sid){
    const target=[...this.room.players.values()].find(p=>p.sid===sid);
    if(!target||!state.p)return;
    const x=target.lifeStats||{};
    const safe=k=>Math.max(0,Math.round(Number(x[k])||0));
    state.send('F',[sid,safe('kills'),safe('wood'),safe('food'),
      safe('stone'),safe('gold'),safe('damage'),
      safe('animalDamage'),safe('healing'),safe('animals'),
      safe('bosses'),null,Math.max(0,Math.round(target.score||0))]);
  }
  _nativeBroadcast(name,args){
    for(const state of this.nativeClients.values())if(state.p)state.send(name,args);
  }
  _syncTribes(){
    for(const state of this.nativeClients.values()) {
      if(!state.p)continue;
      const p=state.p;
      const tribe=p.team&&this.room.tribes.get(p.team);
      state.send('3',[p.team,tribe?tribe.owner===p.id:false]);
      if(tribe)state.send('4',[[...tribe.members].flatMap(id=>{
        const member=this.room.players.get(id);return member?[member.sid,member.name]:[];
      })]);
    }
  }
  _nativeEvents(events) {
    for(const evt of events){
      if(evt.kind==='gather'){
        const p=this.room.players.get(evt.player);
        const state=[...this.nativeClients.values()].find(s=>s.p===p);
        if(state){state.send('N',[evt.key,p.resources[evt.key],1]);state.send('N',['points',p.resources.points,1]);}
        this._nativeBroadcast('L',[p.angle,evt.sid]);
      }else if(evt.kind==='boss_telegraph'){
        const args=[evt.effectKind,evt.x,evt.y,evt.radius,evt.duration];
        if(evt.x2!==undefined)args.push(evt.x2,evt.y2);
        for(const client of this.nativeClients.values())
          if(client.p&&client.supportsBossWarnings)client.send('W',args);
      }else if(evt.kind==='boss_attack'){
        this._nativeBroadcast('J',[evt.sid]);
      }else if(evt.kind==='animal_hit'){
        this._nativeBroadcast('8',[evt.x,evt.y,-evt.damage,1]);
      }else if(evt.kind==='animal_down'){
        const state=[...this.nativeClients.values()].find(s=>s.p?.id===evt.player);
        if(state){state.send('N',['food',state.p.resources.food,1]);state.send('N',['points',state.p.resources.points,1]);}
        this._nativeBroadcast('I',this.room.animalPacket());
      }else if(evt.kind==='animal_attack'){
        const victim=this.room.players.get(evt.to);
        this._nativeBroadcast('J',[evt.sid]);
        if(victim)this._nativeBroadcast('O',[victim.sid,victim.hp]);
        this._nativeBroadcast('8',[evt.x,evt.y,-evt.damage,1]);
      }else if(evt.kind==='steal'){
        // Both inventories change in a server-approved melee transfer.
        const taker=[...this.nativeClients.values()].find(st=>st.p?.id===evt.from);
        const victim=[...this.nativeClients.values()].find(st=>st.p?.id===evt.to);
        taker?.send('N',[evt.key,taker.p.resources[evt.key],1]);
        victim?.send('N',[evt.key,victim.p.resources[evt.key],1]);
      }else if(evt.kind==='hit'){
        const p=this.room.players.get(evt.to);
        if(p)this._nativeBroadcast('O',[p.sid,p.hp]);
        this._nativeBroadcast('8',[evt.x,evt.y,-evt.damage,1]);
      }else if(evt.kind==='death'){
        const state=[...this.nativeClients.values()].find(s=>s.p?.id===evt.id);
        state?.send('P',[]);
        const player=this.room.players.get(evt.id);
        if(player)this._nativeBroadcast('E',[player.id]);
        if(evt.killer){
          const killer=[...this.nativeClients.values()].find(s=>s.p?.id===evt.killer);
          killer?.send('N',['kills',killer.p.resources.kills,1]);
        }
      }else if(evt.kind==='structure_hit'){
        this._nativeBroadcast('L',[evt.dir,evt.sid]);
        this._nativeBroadcast('8',[evt.x,evt.y,-evt.damage,1]);
      }else if(evt.kind==='heal'){
        const owner=[...this.nativeClients.values()].find(s=>s.p?.id===evt.player);
        owner?.send('N',['food',owner.p.resources.food,1]);
        this._nativeBroadcast('O',[evt.sid,evt.hp]);
        this._nativeBroadcast('8',[evt.x,evt.y,evt.amount,2]);
      }else if(evt.kind==='progress'){
        const owner=[...this.nativeClients.values()].find(s=>s.p?.id===evt.player);
        owner?.send('T',[evt.xp,evt.maxXp,evt.age]);
        owner?.send('U',[evt.points,evt.upgradeAge]);
      }else if(evt.kind==='upgrade'){
        const owner=[...this.nativeClients.values()].find(s=>s.p?.id===evt.player);
        if(owner){
          owner.send('V',[evt.equipmentKind==='weapon'?owner.p.inventory.weapons:owner.p.inventory.items,
            evt.equipmentKind==='weapon'?1:0]);
          owner.send('U',[evt.points,evt.upgradeAge]);
        }
      }else if(evt.kind==='resource_return'||evt.kind==='bush_empty'||evt.kind==='bush_ready'){
        // Updating an existing object SID preserves the bush on the map.
        const obj=this.room.resources.get(evt.sid);
        if(obj)this._nativeBroadcast('H',[[obj.sid,obj.x,obj.y,0,obj.scale,obj.type,null,null]]);
      }else if(evt.kind==='destroy'){
        this._nativeBroadcast('Q',[evt.sid]);
        // Counters must update on destruction and one-use spawn pads,
        // including the zero case; otherwise the Lua HUD stays stale.
        if(Number.isInteger(evt.id)&&Number.isInteger(evt.owner)){
          const count=this.room.structureCount(evt.owner,evt.id);
          const owner=[...this.nativeClients.values()].find(s=>s.p?.sid===evt.owner);
          if(count)owner?.send('S',[count.group,count.count]);
        }
      }else if(evt.kind==='teleport'){
        const p=this.room.players.get(evt.player);
        if(p)this._nativeBroadcast('D',[this.room.playerData(p),false]);
      }
      else if(evt.kind==='build'){
        const obj=this.room.structures.get(evt.sid);
        if(obj)this._nativeBroadcast('H',[[obj.sid,obj.x,obj.y,0,obj.scale,obj.type,obj.id,obj.owner]]);
        const state=[...this.nativeClients.values()].find(s=>s.p?.sid===evt.owner);
        if(state){
          for(const key of ['wood','stone','food'])state.send('N',[key,state.p.resources[key],1]);
          // S addresses the shared Lua item GROUP, not the concrete item ID:
          // e.g. every grade of wall shares group 1; mills share group 3.
          const total=this.room.structureCount(state.p.sid,evt.id);
          if(total)state.send('S',[total.group,total.count]);
        }
      }else if(evt.kind==='income'){
        const state=[...this.nativeClients.values()].find(s=>s.p?.id===evt.player);
        state?.send('N',['points',state.p.resources.points,1]);
      }else if(evt.kind==='turret_shot'){
        // Native Lua's M event rotates and recoils an existing structure.
        this._nativeBroadcast('M',[evt.sid,evt.dir]);
      }else if(evt.kind==='projectile_spawn'){
        // X is the existing Lua renderer's projectile creation message.
        // The client never chooses its speed, range, position or damage.
        this._nativeBroadcast('X',[evt.x,evt.y,evt.dir,evt.range,evt.speed,
          evt.type,evt.layer,evt.sid]);
        const state=[...this.nativeClients.values()].find(s=>s.p?.id===evt.player);
        if(state)for(const key of Object.keys(evt.ammo))state.send('N',[key,state.p.resources[key],1]);
      }else if(evt.kind==='projectile_end'){
        // Y sets the remaining range to zero, allowing the LÖVE state
        // updater to discard the sprite after an actual server collision.
        this._nativeBroadcast('Y',[evt.sid,0]);
      }else if(evt.kind==='tribe_created') {
        this._nativeBroadcast('g',[{sid:evt.name,owner:evt.sid,clan:false}]);
      }else if(evt.kind==='tribe_deleted')this._nativeBroadcast('1',[evt.name]);
      else if(evt.kind==='tribe_request'){
        const target=[...this.nativeClients.values()].find(s=>s.p?.id===evt.to);
        const applicant=[...this.room.players.values()].find(p=>p.sid===evt.from);
        target?.send('2',[evt.from,applicant?.name||'unknown']);
      }
    }
  }
  connect(ws, ipHash, trustedOrigin) {
    let me = null;
    let messages = 0;
    let bucketAt = Date.now();
    ws.send(JSON.stringify({ kind: 'hello', protocol: 'mq-v2-alpha', tickRate: 30 }));
    ws.on('message', raw => {
      const now = Date.now();
      if (now - bucketAt > 1000) { bucketAt = now; messages = 0; }
      if (++messages > 30) { ws.close(1008, 'rate_limited'); return; }
      let payload;
      try { payload = JSON.parse(String(raw)); }
      catch { ws.close(1003, 'invalid_json'); return; }
      if (!payload || typeof payload !== 'object') return;
      if (payload.kind === 'join' && !me) {
        if(this.storage.data.settings.allowGuests===false){
          ws.close(1008,'guests_disabled');return;
        }
        try {
          me = this.room.join(ws, payload.name);
          me.ipHash = ipHash;
          me.trustedOrigin = trustedOrigin;
          this.online.set(me.id, ws);
          ws.send(JSON.stringify({ kind: 'joined', id: me.id, x: me.x, y: me.y }));
        } catch { ws.close(1008, 'server_full'); }
      } else if (me && payload.kind === 'input') this.room.input(me.id, payload);
      else if (me && payload.kind === 'attack') this.room.attack(me.id);
    });
    ws.on('close', () => { if (me) { this.online.delete(me.id); this.room.leave(me.id); } });
    ws.on('error', () => {});
  }
  start() {
    if (this.loop) return;
    let last = Date.now();
    this.loop = setInterval(() => {
      const now = Date.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      // The original client sends F(1) on mouse-down and F(0) on release.
      // Sustained gathering/firing must be driven by the authoritative
      // server cooldown; no repeated Lua F frames are required.
      for(const state of this.nativeClients.values()){
        if(!(state.held||state.autoAttack)||!state.p||state.p.hp<=0)continue;
        if(this.room.attack(state.p.id)&&state.p.buildIndex<0)
          this._nativeBroadcast('K',[state.p.sid,1,state.p.weaponIndex]);
        if(state.p.buildIndex>=0)state.held=false;
      }
      this.room.tick(dt);
      this.counter++;
      if(this.counter%900===0)
        for(const p of this.room.players.values())this.persistPlayer(p);
      if (this.counter % 3 !== 0) return;
      if(this.counter%60===0){
        for(const state of this.nativeClients.values())if(state.watchSid!==null)
          this._sendNativeStats(state,state.watchSid);
      }
      const world = JSON.stringify(this.room.snapshot());
      const allEvents=this.room.takeEvents();
      const events = JSON.stringify({ kind: 'events', list: allEvents });
      this._nativeEvents(allEvents);
      // Binary native transport sends Lua-compatible logical packet records.
      const positions=this.room.playerUpdates(),board=this.room.leaderboard();
      for(const state of this.nativeClients.values())if(state.p && state.ws.readyState===state.ws.OPEN){
        if(state.ws.bufferedAmount>512_000){state.ws.terminate();continue;}
        state.send('a',positions);
        state.send('I',this.room.animalPacket());
        if(this.counter%30===0){
          state.send('G',[board]);
          // The pre-V2 minimap uses packet 7 for teammates, not guesses
          // drawn by the client from potentially stale world positions.
          const team=state.p.team;
          const visible=team?[...this.room.players.values()]
            .filter(p=>p!==state.p&&p.hp>0&&p.team===team)
            .flatMap(p=>[Math.round(p.x),Math.round(p.y)]):[];
          state.send('7',[visible]);
        }
      }
      // A connection tracked for admin moderation may use either protocol.
      // Native Lua clients accept ONLY authenticated binary game packets.
      for (const ws of this.online.values()) {
        if (this.nativeClients.has(ws)) continue;
        if (ws.readyState !== ws.OPEN) continue;
        if (ws.bufferedAmount > 512_000) { ws.terminate(); continue; }
        ws.send(world); ws.send(events);
      }
    }, 1000 / 30);
  }
  announce(message) {
    const text = JSON.stringify({ kind: 'announcement', message: String(message).slice(0, 240) });
    for (const ws of this.online.values()) {
      if (this.nativeClients.has(ws)) continue;
      if (ws.readyState === ws.OPEN) ws.send(text);
    }
  }
  kick(id, reason = 'admin') { const ws = this.online.get(id); if (!ws) return false; ws.close(1008, String(reason).slice(0, 100)); return true; }
  disconnectGuests(reason='guests_disabled'){
    // Closing anonymous sessions includes pending handshakes and JSON/dev
    // clients; authenticated sessions are explicitly exempt.
    for(const [ws,state] of this.nativeClients)
      if(!state.grantedAccountId && ws.readyState===ws.OPEN)
        ws.close(1008,String(reason).slice(0,100));
    for(const ws of this.wss.clients)
      if(ws.readyState===ws.OPEN)ws.close(1008,String(reason).slice(0,100));
  }
  disconnectAccount(accountId) {
    if(!accountId)return;
    for(const state of this.nativeClients.values()){
      if(state.grantedAccountId===accountId)
        state.ws.close(1008,'session_revoked');
    }
  }
  async stop() {
    clearInterval(this.loop);this.loop=null;
    for(const server of [this.wss,this.nativeWss]) {
      for(const ws of server.clients)ws.terminate();
      await new Promise(resolve=>server.close(()=>resolve()));
    }
    await Promise.all([...this.profileWrites]);
    if(this.unsavedProfiles.size)throw new Error(
      'Unpersisted player profiles: '+this.unsavedProfiles.size+
      '. Do not treat this shutdown as clean.');
  }
}
