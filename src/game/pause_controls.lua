-- Stop input on the server when UI overlays take focus.
-- A local key reset alone is insufficient: V2 keeps the last direction.
-- Do not touch the independent K(1) automatic-attack toggle.
local M={}
function M.stop(client,msgpackNull)
  if not client or client.state~="spawn_confirmed" then return false end
  client:send("9",{msgpackNull})
  client:send("e",{})
  client:send("F",{0,msgpackNull})
  return true
end
return M
