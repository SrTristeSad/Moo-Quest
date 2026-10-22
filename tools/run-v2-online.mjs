// Moo-Quest V2: straightforward launcher using Node's standard library.
// Does not change Windows execution policy, modify registry/firewall,
// download files, run PowerShell, elevate privileges, or hide a process.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSecureRelay } from './v2-https-relay.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

export function findLove({rootDir=root,env=process.env,exists=existsSync}={}){
  const paths=[
    join(rootDir,'love.exe'),
    env.ProgramFiles?join(env.ProgramFiles,'LOVE','love.exe'):null,
    env['ProgramFiles(x86)']?join(env['ProgramFiles(x86)'],'LOVE','love.exe'):null
  ].filter(Boolean);
  for(const filepath of paths)if(exists(filepath))return filepath;
  // Only use PATH's ordinary executable discovery, without a shell.
  return 'love.exe';
}

export async function launchOnlineClient({
  createRelay=createSecureRelay,
  spawnProcess=spawn,
  httpFetch=fetch,
  env=process.env,
  executable=findLove({env})
}={}){
  if(Number(process.versions.node.split('.')[0])<22)
    throw new Error('Node.js 22 ou superior necessario.');
  const relay=createRelay();
  let child=null;
  try{
    await relay.listen(); // refuses to take over any existing localhost port
    const reply=await httpFetch('http://127.0.0.1:8080/ping',{
      signal:AbortSignal.timeout(10000),
      redirect:'error',
      cache:'no-store'
    });
    if(reply.status!==200)throw new Error('O servidor nao respondeu a /ping: HTTP '+reply.status);
    const ping=await reply.json();
    if(ping?.build!=='mqv2native')
      throw new Error('Servidor remoto inesperado: nao e a API V2.');
    console.log('[Moo-Quest] app.snusnu.com.br confirmado por HTTPS verificado.');
    console.log('[Moo-Quest] Iniciando LÖVE 2D com conta V2 online...');
    const loveEnv={...env,MOOQUEST_REQUIRE_V2:'1',MOOQUEST_V2_ONLINE:'1'};
    // Command + argument array; never run through cmd/PowerShell or a shell.
    child=spawnProcess(executable,[root],{
      cwd:root,env:loveEnv,stdio:'inherit',shell:false,
      windowsHide:false
    });
    return await new Promise((resolve,reject)=>{
      child.once('error',error=>reject(new Error('Nao foi possivel abrir LÖVE 2D: '+error.message)));
      child.once('exit',(code,signal)=>resolve(code===null?(signal?1:0):code));
    });
  }finally{
    if(child&&child.exitCode===null&&!child.killed)child.kill();
    await relay.close();
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  launchOnlineClient().then(code=>{process.exitCode=code;}).catch(error=>{
    console.error('[Moo-Quest] '+error.message);
    process.exitCode=1;
  });
}
