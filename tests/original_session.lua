package.path="./?.lua;./?/init.lua;"..package.path
local C=require("src.protocol.original_crypto")
local Build=require("src.protocol.original_build")
local Session=require("src.protocol.original_session")
local MP=require("src.protocol.msgpack")
local tables=C.buildTables(12345,12345678)
assert(tables.c2s.enc.M==7 and tables.c2s.enc.D==19)
assert(tables.c2s.enc["9"]==1 and tables.c2s.enc["0"]==4)
assert(tables.c2s.enc.T==8 and tables.c2s.enc.I==17)
assert(tables.s2c.enc.A==22 and tables.s2c.enc.C==28)
assert(tables.s2c.enc.D==2 and tables.s2c.enc.a==12)
assert(tables.s2c.enc.H==34 and tables.s2c.enc.p==32)
assert(tables.s2c.enc.q==115 and tables.s2c.enc.r==73 and tables.s2c.enc.m==74)
local params={buildId="test",salt=12345678,rounds=5,tapA=1,tapB=3,
  rotA=11,rotB=19,mult=16777619,constants={11,22,33,44,55,66,77,88}}
local key=C.mixKey(C.hexToBinary("000102030405060708090a0b0c0d0e0f"),12345,params)
local got=key:gsub(".",function(char) return string.format("%02x",char:byte()) end)
assert(got=="87d47bd127115eadd3ef7e57eb88fcc366a7235987d11dfabc6ee973f840ca8a","original mixKey vector mismatch "..got)
local json='{"buildId":"test","salt":12345678,"rounds":5,"tapA":1,"tapB":3,"rotA":11,"rotB":19,"mult":16777619,"constants":[11,22,33,44,55,66,77,88]}'
local parsed=assert(Build.parse(json))
assert(parsed.buildId==params.buildId and parsed.salt==params.salt)
local h={rawKeyHex="000102030405060708090a0b0c0d0e0f",mode=1,pinned=true,sealMode=0,seed=12345}
local function dummySha(s) return string.rep(string.char(#s%256),32) end
local session=assert(Session.new(h,params,dummySha))
local frame=assert(session:encode("9",{math.pi/4}))
assert(#frame>6)
local masked=frame:sub(7)
local body=C.mask(masked,C.clientMaskSeed(session.masks.c2s,frame:sub(1,6)))
local msg=MP.decode(body)
assert(msg[1]==1 and msg[2][1]==math.pi/4 and msg[3]==1)
local id=tables.s2c.enc.A
local incoming=MP.encode({id,{{name="test"}}})
local r=assert(session:decode(C.mask(incoming,C.serverMaskSeed(session.masks.s2c,1))))
assert(r.name=="A" and r.args[1].name=="test")
assert(session.received==1)
-- Authentic original T reply reports pre-telemetry send sequence + ledger,
-- with nil seal represented as MessagePack null in sealMode 0.
local beforeSeq,beforeLedger=session.sent,session.ledger
local saltProbe=3901234567
local telemetry=assert(session:encode("T",{0,0,0,MP.null,saltProbe,beforeSeq,beforeLedger}))
local teleBody=C.mask(telemetry:sub(7),C.clientMaskSeed(session.masks.c2s,telemetry:sub(1,6)))
local teleDecoded=MP.decode(teleBody)
assert(teleDecoded[1]==tables.c2s.enc.T)
assert(teleDecoded[2][4]==MP.null)
assert(teleDecoded[2][5]==saltProbe)
assert(teleDecoded[2][6]==beforeSeq and teleDecoded[2][7]==beforeLedger)
h.sealMode=2
local blocked,reason=Session.new(h,params,dummySha)
assert(blocked==nil and reason:find("seal"))
print("Original keyed protocol crypto and session vectors passed")
