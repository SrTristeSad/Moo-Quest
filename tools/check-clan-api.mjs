// End-to-end verification against ACTUAL Node server account/clan HTTP routes.
// Runs only on loopback and creates disposable CI accounts with randomized names.
// The local login simulator accepts any six digits; NEVER use for public hosting.
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
const base=process.env.MOOQUEST_HTTP_BASE||"http://127.0.0.1:8080";
const parsed=new URL(base);
if(!["127.0.0.1","localhost"].includes(parsed.hostname)){
  throw Error("Clan tests are restricted to loopback servers");
}
async function post(route,data) {
  const response=await fetch(base+"/api/"+route,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(data),
    signal:AbortSignal.timeout(6000)
  });
  const body=await response.json();
  if(!response.ok)throw Error(route+": HTTP "+response.status+": "+
    String(body.error||body.type||"unknown"));
  return body;
}
async function account(prefix){
  const email="ci-clan-"+prefix+"-"+randomBytes(4).toString("hex")+"@localhost.invalid";
  const {flow}=await post("auth/code",{email});
  assert.match(flow,/^[a-f0-9]{24}$/);
  const {token}=await post("auth/verify",{flow,code:"123456"});
  assert.equal(typeof token,"string");
  assert.ok(token.length>=12);
  const name="CI"+randomBytes(5).toString("hex");
  const named=await post("name",{auth:token,name});
  assert.equal(named.name,name);
  const check=await post("account",{auth:token});
  assert.equal(check.name,name);
  return {name,token};
}
const owner=await account("owner");
const guest=await account("member");
const applicant=await account("request");
const clan="Q"+randomBytes(2).toString("hex").slice(0,3).toUpperCase();
async function act(who,action,data={}){
  return post("clan/"+action,{auth:who.token,...data});
}
assert.equal((await act(owner,"mine")).clan,null);
await act(owner,"create",{name:clan});
let mine=await act(owner,"mine");
assert.equal(mine.clan.name,clan);
assert.equal(mine.role,"owner");
assert.equal(mine.clan.members[0].name,owner.name);
assert.equal(mine.clan.members[0].role,"owner");
console.log("PASS: real registered account created permanent clan "+clan);
await act(owner,"invite",{name:guest.name});
let invited=await act(guest,"mine");
assert.equal(invited.invites[0].clan,clan);
await act(guest,"answer",{clan,accept:true});
mine=await act(owner,"mine");
assert.equal(mine.clan.members.length,2);
assert.equal((await act(guest,"mine")).role,"member");
console.log("PASS: server delivered an invite and persisted accepted membership");
await act(owner,"role",{name:guest.name,role:"officer"});
assert.equal((await act(guest,"mine")).role,"officer");
await act(applicant,"request",{clan});
mine=await act(owner,"mine");
assert.ok(mine.requests.includes(applicant.name));
await act(owner,"decide",{name:applicant.name,accept:true});
assert.equal((await act(applicant,"mine")).role,"member");
console.log("PASS: officer role, join request and owner approval validated on Node");
await act(owner,"kick",{name:applicant.name});
assert.equal((await act(applicant,"mine")).clan,null);
await act(owner,"requests",{open:false});
assert.equal((await act(owner,"mine")).clan.closed,true);
await act(owner,"requests",{open:true});
assert.equal((await act(owner,"mine")).clan.closed,false);
await act(owner,"disband");
assert.equal((await act(owner,"mine")).clan,null);
assert.equal((await act(guest,"mine")).clan,null);
console.log("PASS: kick, open/close requests and authoritative disband confirmed");
