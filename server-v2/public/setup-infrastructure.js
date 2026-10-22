'use strict';
const el=id=>document.getElementById(id);
const fields=['code','pgHost','pgPort','pgDatabase','pgUser','pgPassword','pgTls',
  'redisHost','redisPort','redisDatabase','redisUsername','redisPassword','redisTls',
  'adminUsername','adminPassword','adminPasswordConfirm'];
function collect(){
  const data={};
  for(const field of fields){
    const input=el(field);
    data[field]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;
  }
  return data;
}
async function post(route,body){
  const response=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(body),credentials:'same-origin'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Serviço não disponível');
  return data;
}
async function check(buttonId,statusId,route){
  const button=el(buttonId),status=el(statusId);
  button.disabled=true;status.className='status';status.textContent='Testando...';
  try{
    const value=await post(route,collect());
    status.textContent=route.includes('postgres')?'PostgreSQL conectado: '+value.database:'Redis conectado';
  }catch(error){
    status.className='status error';status.textContent=error.message;
  }finally{button.disabled=false;}
}
el('testPg').onclick=()=>check('testPg','pgStatus','/setup/test-postgres');
el('testRedis').onclick=()=>check('testRedis','redisStatus','/setup/test-redis');
el('setup').onsubmit=async event=>{
  event.preventDefault();
  const data=collect(),status=el('result'),button=el('install');
  if(data.adminPassword!==data.adminPasswordConfirm){
    status.className='error';status.textContent='As senhas de administrador são diferentes';return;
  }
  button.disabled=true;status.className='';status.textContent='Validando serviços e preparando o banco...';
  try{
    await post('/setup/install',data);
    status.textContent='Instalação concluída. O servidor está reiniciando; acesse /admin/login.';
    el('adminPassword').value='';
    el('adminPasswordConfirm').value='';
    el('pgPassword').value='';
    el('redisPassword').value='';
    setTimeout(()=>{window.location.href='/admin/login'},3500);
  }catch(error){
    status.className='error';status.textContent=error.message;
    button.disabled=false;
  }
};