let csrf = '';
const $ = id => document.getElementById(id);
const notice = message => { const n=$('notice');n.textContent=message;n.classList.add('visible'); };
async function api(path, body) {
  const options = { credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.headers['X-CSRF-Token'] = csrf;
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}
async function uploadReleaseZip(){
  const file=$('updateZipFile').files?.[0];
  if(!file)throw new Error('Escolha um ZIP do servidor V2.');
  if(!/\.zip$/i.test(file.name)||file.size<22||file.size>16*1024*1024)
    throw new Error('O arquivo deve ser .zip, com tamanho máximo de 16 MB.');
  if(!$('updateZipConsent').checked)
    throw new Error('Confirme que confia na origem do ZIP antes de enviar.');
  const control=$('uploadUpdateZip');
  control.disabled=true;
  $('zipUpdateInfo').textContent='Enviando e verificando ZIP...';
  try{
    const response=await fetch('/api/admin/updates/upload-zip',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/zip','X-CSRF-Token':csrf},
      body:file
    });
    const type=response.headers.get('content-type')||'';
    if(!type.startsWith('application/json'))
      throw new Error('A API retornou uma página em vez de JSON (HTTP '+response.status+'). Verifique o Cloudflare/aaPanel.');
    const value=await response.json();
    if(!response.ok)throw new Error(value.error||'HTTP '+response.status);
    $('zipUpdateInfo').textContent='ZIP conferido: '+value.upload.files+
      ' arquivos · SHA-256: '+value.upload.sha256;
    $('updateZipConsent').checked=false;
    notice('ZIP preparado. Clique em Ativar versão preparada e reinicie o Node pelo aaPanel.');
    await refreshStatus();
  }finally{control.disabled=false;}
}
async function safe(action) { try { return await action(); } catch (error) { notice('Erro: ' + error.message); } }
async function refreshStatus() {
  const s=await api('/api/admin/status');
  $('online').textContent=s.players;
  $('capacity').textContent=s.maxPlayers;
  $('uptime').textContent=Math.floor(s.uptimeSeconds/60)+' min';
  $('version').textContent=s.version;
  $('greeting').textContent=s.title;
  $('statusPill').textContent=s.maintenance ? 'Manutenção' : 'Servidor ativo';
  $('activeRelease').textContent=s.updates.active;
  $('stagedRelease').textContent=s.updates.staged || 'Nenhuma';
}
async function refreshPlayers() {
  const players=await api('/api/admin/players');
  const tbody=$('playersRows');tbody.replaceChildren();
  if(!players.length) {const tr=tbody.insertRow();const td=tr.insertCell();td.colSpan=4;td.textContent='Nenhum jogador conectado.';return;}
  for(const p of players){
    const row=tbody.insertRow();
    [p.name,p.hp+' HP',p.x+', '+p.y].forEach(value=>{ const td=row.insertCell();td.textContent=value; });
    const td=row.insertCell();
    const kick=document.createElement('button');kick.className='secondary';kick.textContent='Expulsar';
    kick.addEventListener('click',()=>safe(async()=>{await api('/api/admin/players/kick',{id:p.id});notice('Jogador expulso.');await refreshPlayers();}));
    td.append(kick);
    const ban=document.createElement('button');ban.className='secondary';ban.textContent='Bloquear';
    ban.addEventListener('click',()=>safe(async()=>{if(!confirm('Bloquear este jogador?'))return;await api('/api/admin/players/ban',{id:p.id,reason:'moderação'});notice('Origem do jogador bloqueada e salva.');await refreshPlayers();}));
    td.append(ban);
  }
}
let accountPage=1,accountTotal=0,accountLimit=25;
async function refreshAccounts(){
  const query=new URLSearchParams({page:String(accountPage),search:$('accountsSearch').value.trim()});
  const data=await api('/api/admin/accounts?'+query.toString());
  accountTotal=data.total;accountLimit=data.limit;
  $('accountsCount').textContent=data.total+' conta(s) cadastrada(s)';
  $('accountsPage').textContent='Página '+data.page+' de '+Math.max(1,Math.ceil(data.total/data.limit));
  $('accountsPrev').disabled=accountPage<=1;
  $('accountsNext').disabled=accountPage*data.limit>=data.total;
  const tbody=$('accountsRows');tbody.replaceChildren();
  if(!data.accounts.length){
    const td=tbody.insertRow().insertCell();td.colSpan=4;td.textContent='Nenhuma conta encontrada.';
    return;
  }
  const dateValue=value=>value?new Date(value).toLocaleString('pt-BR'):'—';
  for(const account of data.accounts){
    const tr=tbody.insertRow();
    [account.username,dateValue(account.createdAt),dateValue(account.savedAt),
      account.online?'Online':'Offline'].forEach(value=>{
      const td=tr.insertCell();td.textContent=value;
    });
  }
}
async function refreshSettings() {
  const s=await api('/api/admin/settings');
  $('title').value=s.title;$('motd').value=s.motd;$('maxPlayers').value=s.maxPlayers;$('maintenance').checked=s.maintenance;
  $('allowGuests').checked=s.allowGuests!==false;
  $('publicRegistration').checked=s.publicRegistration===true;
}
async function refreshAudit(){const s=await api('/api/admin/audit');$('auditLog').textContent=s.map(e=>`${e.at} · ${e.kind} · ${e.owner||e.playerId||e.version||''}`).join('\n')||'Nenhuma operação registrada.';}
function openView(id){
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===id));
  document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===id));
  $('sectionTitle').textContent=document.querySelector(`.nav-link[data-view="${id}"]`).textContent;
  if(id==='players')safe(refreshPlayers);
  if(id==='accounts')safe(refreshAccounts);
  if(id==='settings')safe(refreshSettings);
  if(id==='audit')safe(refreshAudit);
  if(id==='updates')safe(refreshStatus);
}
async function init(){
  const s=await api('/api/admin/session');csrf=s.csrf;
  document.querySelectorAll('.nav-link').forEach(button=>button.addEventListener('click',()=>openView(button.dataset.view)));
  $('refreshPlayers').addEventListener('click',()=>safe(refreshPlayers));
  $('refreshAccounts').addEventListener('click',()=>safe(refreshAccounts));
  $('searchAccounts').addEventListener('click',()=>safe(async()=>{accountPage=1;await refreshAccounts();}));
  $('accountsSearch').addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();safe(async()=>{accountPage=1;await refreshAccounts();});}
  });
  $('accountsPrev').addEventListener('click',()=>safe(async()=>{
    if(accountPage>1){accountPage--;await refreshAccounts();}
  }));
  $('accountsNext').addEventListener('click',()=>safe(async()=>{
    if(accountPage*accountLimit<accountTotal){accountPage++;await refreshAccounts();}
  }));
  $('refreshAudit').addEventListener('click',()=>safe(refreshAudit));
  $('settingsForm').addEventListener('submit',e=>{e.preventDefault();safe(async()=>{
    await api('/api/admin/settings',{title:$('title').value,motd:$('motd').value,maxPlayers:Number($('maxPlayers').value),maintenance:$('maintenance').checked,
      allowGuests:$('allowGuests').checked,publicRegistration:$('publicRegistration').checked});
    notice('Configurações salvas.');await refreshStatus();});});
  $('noticeForm').addEventListener('submit',e=>{e.preventDefault();safe(async()=>{
    await api('/api/admin/announce',{message:$('announcement').value});$('announcement').value='';notice('Anúncio enviado.');});});
  $('uploadUpdateZip').addEventListener('click',()=>safe(uploadReleaseZip));
  $('discardUpdate').addEventListener('click',()=>safe(async()=>{
    await api('/api/admin/updates/discard',{});
    $('zipUpdateInfo').textContent='Atualização preparada descartada.';
    notice('Atualização pendente descartada.');await refreshStatus();
  }));
  const updateButtons={checkUpdate:'check',stageUpdate:'stage',activateUpdate:'activate',rollbackUpdate:'rollback'};
  for(const [id,action] of Object.entries(updateButtons))$(id).addEventListener('click',()=>safe(async()=>{
    const result=await api('/api/admin/updates/'+action,{});
    notice(action==='check'?'Release verificado: '+result.version : action==='stage'?'Pacote validado e armazenado.':'Preparado. Reinicie o projeto no aaPanel.');
    await refreshStatus();
  }));
  $('logout').addEventListener('click',()=>safe(async()=>{await api('/admin/logout',{});location.assign('/admin/login');}));
  await refreshStatus();
  setInterval(()=>safe(refreshStatus),10_000);
}
init().catch(()=>{location.assign('/admin/login');});
