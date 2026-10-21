-- Automated E2E against a REAL running original Node server.
-- Only enabled by MOOQUEST_INTEGRATION=guest|account in headless CI.
-- Never fabricates a world; waits for actual server C and D packets.
local Original=require("src.net.original_client")
local Auth=require("src.net.local_auth")
local World=require("src.game.world_state")
local Panels=require("src.game.reference_panels")
local I={}
I.__index=I
function I.new(mode)
  if mode~="guest" and mode~="account" and mode~="store_tribe" then
    error("unknown Node integration mode")
  end
  local token=nil
  if mode=="account" then
    local challenge,err=Auth.requestCode("ci-test@localhost.invalid")
    if not challenge then error("account /auth/code: "..tostring(err)) end
    local verified,reason=Auth.verifyCode(challenge.flow,"123456")
    if not verified then error("account /auth/verify: "..tostring(reason)) end
    token=verified.token
    print("E2E: local Node account emulator issued auth token; never logging token")
  end
  local client=Original.new({
    host="127.0.0.1",port=8080,server="LC",
    autoSpawn=false,authToken=token
  })
  local ok,err=client:connect()
  if not ok then error("Node connection: "..tostring(err)) end
  return setmetatable({
    client=client,world=World.new(),mode=mode,
    elapsed=0,spawned=false,hasC=false,hasD=false,done=false,
    panels=Panels.new(),stage=nil
  },I)
end
function I:stop(ok,reason)
  if self.done then return end
  self.done=true
  print((ok and "E2E PASS: " or "E2E FAIL: ")..reason)
  self.client:close()
  love.event.quit(ok and 0 or 1)
end
function I:update(dt)
  if self.done then return end
  self.elapsed=self.elapsed+dt
  if self.elapsed>24 then
    return self:stop(false,"timeout after 24s; state="..
      tostring(self.client.state).." status="..tostring(self.client.status))
  end
  self.client:update()
  if self.client.state=="blocked" or self.client.state=="failed"
    or self.client.state=="closed" then
    return self:stop(false,"Node client "..tostring(self.client.state)..
      ": "..tostring(self.client.error or self.client.status))
  end
  if self.client.state=="keyed_transport" and not self.spawned then
    local ok,err=self.client:spawn({name="Lua CI",skin=0})
    if not ok then return self:stop(false,"M not sent: "..tostring(err)) end
    self.spawned=true
    print("E2E: real Lua client signed and sent M packet")
  end
  for _,event in ipairs(self.client:drain()) do
    if event.kind=="game_packet" then
      local p=event.data
      self.world:apply(p.name,p.args)
      if p.name=="C" then
        self.hasC=true
        print("E2E: original server confirmed spawn C")
      elseif p.name=="D" then
        local player=self.world:localPlayer()
        if player and type(player.x)=="number" and type(player.y)=="number" then
          self.hasD=true
          print("E2E: authentic local player position D "..player.x..","..player.y)
        end
      end
    end
  end
  if self.hasC and self.hasD then
    return self:stop(true,"Lua "..self.mode..
      " account /api/join -> WebSocket -> io-init -> M -> C -> D")
  end
end
return I
