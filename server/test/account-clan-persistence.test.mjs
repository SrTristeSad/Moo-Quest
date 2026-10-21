import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {AccountStore} from "../src/api/store.js";

test("registered account names and clan ownership survive new server process store",async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"moo-clan-"));
  try{
    const first=new AccountStore(dir);
    const account=first.accountForEmail("persist-ci@localhost.invalid");
    assert.ok(account && account.id);
    assert.equal(first.claimName(account,"LuaTester").status,200);
    assert.equal(first.clanAction(account,"create",{name:"QZX"}).status,200);
    const before=first.myClan(account);
    assert.equal(before.clan.name,"QZX");
    assert.equal(before.role,"owner");
    // The author's original backend coalesces writes for 250 ms, so wait
    // until the write has actually reached disk before making a new store.
    await new Promise(resolve=>setTimeout(resolve,450));
    assert.ok(fs.existsSync(path.join(dir,"accounts.json")));
    const second=new AccountStore(dir);
    const restored=second.accountForEmail("persist-ci@localhost.invalid");
    assert.equal(restored.id,account.id);
    assert.equal(restored.name,"LuaTester");
    assert.equal(restored.clan,"QZX");
    assert.equal(second.myClan(restored).role,"owner");
    assert.equal(second.myClan(restored).clan.members[0].name,"LuaTester");
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
