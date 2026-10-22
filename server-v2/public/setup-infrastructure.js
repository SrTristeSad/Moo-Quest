'use strict';
const el=id=>document.getElementById(id);
const fields=['code','pgHost','pgPort','pgDatabase','pgUser','pgPassword','pgTls',
  'redisHost','redisPort','redisDatabase','redisUsername','redisPassword','redisTls',
  'adminUsername','adminPassword','adminPasswordConfirm'];
function collect(){
  const data={};
  for(const field of fields){
    const input=el(field);
    data[field]=input.type==='checkbox'?input.checked:
      input.type==='number'?Number(input.value):input.value;
  }
  return data;
}
async function post(route,body){
  const response=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Serviço não disponível');
  return data;
}
function validCode(){
  const code=el('code');
  if(code.reportValidity())return true;
  code.focus();return false;
}
async function check(buttonId,statusId,route){
  if(!validCode())return;
  const button=el(buttonId),status=el(statusId);
  button.disabled=true;
  status.className='status';
  status.textContent='Verificando conexão...';
  try{
    const value=await post(route,collect());
    status.textContent=route.includes('postgres')?
      '✓ PostgreSQL conectado — '+value.database:'✓ Redis respondeu corretamente';
  }catch(error){
    status.className='status error';
    status.textContent='✕ '+error.message;
  }finally{button.disabled=false;}
}
el('testPg').addEventListener('click',()=>check('testPg','pgStatus','/setup/test-postgres'));
el('testRedis').addEventListener('click',()=>check('testRedis','redisStatus','/setup/test-redis'));
el('setup').addEventListener('submit',async event=>{
  event.preventDefault();
  const data=collect(),status=el('result'),button=el('install');
  if(data.adminPassword!==data.adminPasswordConfirm){
    status.className='error';
    status.textContent='As senhas administrativas não conferem.';
    el('adminPasswordConfirm').focus();
    return;
  }
  button.disabled=true;
  status.className='';
  status.textContent='Testando os serviços e configurando a instalação...';
  try{
    await post('/setup/install',data);
    status.textContent='✓ Instalação concluída. Abrindo o painel administrativo...';
    for(const id of ['adminPassword','adminPasswordConfirm','pgPassword','redisPassword'])
      el(id).value='';
    window.setTimeout(()=>window.location.assign('/admin/login'),3200);
  }catch(error){
    status.className='error';status.textContent='✕ '+error.message;
    button.disabled=false;
  }
});