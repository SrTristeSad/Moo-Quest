import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script=path.join(root,'scripts','db-backup.mjs');
const fakePg=`#!/bin/sh
# This fake validates the safe CLI contract; a real restore must be verified
# separately in an isolated PostgreSQL instance before use on a VPS.
for arg in "$@"; do
  case "$arg" in *safe-secret*) exit 88 ;; esac
done
if [ "$PGPASSWORD" != "safe-secret" ]; then exit 87; fi
if [ "$PGDATABASE" != "mooquest" ]; then exit 86; fi
if [ "${0##*/}" = "pg_dump" ]; then
  for arg in "$@"; do
    case "$arg" in --file=*) file="${arg#--file=}" ;; esac
  done
  [ -n "$file" ] || exit 85
  printf 'PGDMPmock-archive-content' > "$file"
  exit 0
fi
if [ "$1" = "--list" ]; then
  printf '1; 1259 1 TABLE public mq_admin_state mooquest\\n'
  printf '2; 1259 2 TABLE public mq_player_accounts mooquest\\n'
  printf '3; 1259 3 TABLE public mq_clans mooquest\\n'
  printf '4; 1259 4 TABLE public mq_clan_members mooquest\\n'
  exit 0
fi
printf '%s\\n' "$*" > "$MOO_MOCK_LOG"
exit 0
`;
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mq-backup-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const bin=path.join(dir,'bin');
  fs.mkdirSync(bin);
  for(const name of ['pg_dump','pg_restore'])
    fs.writeFileSync(path.join(bin,name),fakePg,{mode:0o700});
  const dest=path.join(dir,'backup'),log=path.join(dir,'mock.log');
  const env={...process.env,
    PATH:bin+path.delimiter+process.env.PATH,
    MOO_DATABASE_URL:'postgresql://mooquest:safe-secret@127.0.0.1:5432/mooquest',
    MOO_BACKUP_DIR:dest,MOO_MOCK_LOG:log,MOO_PORT:'65530'};
  const cmd=(args,changes={})=>spawnSync(process.execPath,[script,...args],
    {env:{...env,...changes},encoding:'utf8',timeout:7000});
  return {cmd,dir,dest,log};
}

test('PostgreSQL backup writes restrictive dump+checksum, supports offline verification',t=>{
  const {cmd,dest}=fixture(t);
  const result=cmd(['backup']);
  assert.equal(result.status,0,result.stderr);
  const file=result.stdout.trim().slice('BACKUP_OK '.length);
  assert.ok(file.startsWith(dest));
  assert.ok(file.endsWith('.dump'));
  assert.equal(fs.readFileSync(file).subarray(0,5).toString(),'PGDMP');
  const manifest=JSON.parse(fs.readFileSync(file+'.json','utf8'));
  assert.equal(manifest.format,'mooquest-postgres-backup-v1');
  assert.equal(manifest.database,'mooquest');
  assert.equal(manifest.file,path.basename(file));
  assert.equal(manifest.sha256.length,64);
  assert.equal(fs.statSync(dest).mode&0o077,0,'backup directory is private');
  assert.equal(fs.statSync(file).mode&0o077,0,'SQL backup is private');
  assert.equal(fs.statSync(file+'.json').mode&0o077,0,'manifest is private');
  const check=cmd(['verify',file],{MOO_DATABASE_URL:''});
  assert.equal(check.status,0,check.stderr);
  assert.match(check.stdout,/VERIFY_OK/);
  fs.appendFileSync(file,'corruption');
  const bad=cmd(['verify',file],{MOO_DATABASE_URL:''});
  assert.notEqual(bad.status,0);
  assert.match(bad.stderr,/Backup SHA256 verification failed/);
});

test('PostgreSQL restore defaults to refusal and requires explicit offline approval',t=>{
  const {cmd,log}=fixture(t);
  const created=cmd(['backup']);
  assert.equal(created.status,0,created.stderr);
  const file=created.stdout.trim().slice('BACKUP_OK '.length);
  const denied=cmd(['restore',file]);
  assert.notEqual(denied.status,0);
  assert.match(denied.stderr,/MOO_CONFIRM_RESTORE/);
  assert.equal(fs.existsSync(log),false,'no destructive command before approval');
  const confirmed=cmd(['restore',file],{
    MOO_CONFIRM_RESTORE:'RESTORE mooquest',MOO_SERVER_STOPPED:'YES'});
  assert.equal(confirmed.status,0,confirmed.stderr);
  assert.match(confirmed.stdout,/RESTORE_OK mooquest/);
  const command=fs.readFileSync(log,'utf8');
  assert.ok(command.includes('--clean'));
  assert.ok(command.includes('--if-exists'));
  assert.ok(command.includes('--single-transaction'));
  assert.ok(command.includes('--dbname=mooquest'));
  assert.ok(!command.includes('safe-secret'),'password must not be in argv');
});

test('PostgreSQL backup never accepts dangerous DB URLs or invalid CLI arguments',t=>{
  const {cmd}=fixture(t);
  const invalid=cmd(['backup'],{MOO_DATABASE_URL:'https://example.com/mooquest'});
  assert.notEqual(invalid.status,0);
  assert.match(invalid.stderr,/PostgreSQL connection/);
  const wrongArgs=cmd(['restore']);
  assert.notEqual(wrongArgs.status,0);
  assert.match(wrongArgs.stderr,/Use:/);
});
