-- Run the repository's self-contained Lua checks inside official LÖVE/LuaJIT.
-- No shell Lua installation or network connection required.
local M={}
M.paths={
  "tests/handshake.lua",
  "tests/msgpack.lua",
  "tests/msgpack_gameplay.lua",
  "tests/bootstrap.lua",
  "tests/upgrade.lua",
  "tests/websocket_frames.lua",
  "tests/websocket_client.lua",
  "tests/original_client.lua",
  "tests/original_join.lua",
  "tests/original_session.lua",
  "tests/catalog.lua",
  "tests/world_state.lua",
  "tests/reference_render.lua",
  "tests/reference_animation.lua",
  "tests/reference_upgrades.lua",
  "tests/reference_hud.lua",
  "tests/reference_camera.lua",
  "tests/reference_menu.lua"
}
function M.run()
  local results={passed=0,failed=0,rows={}}
  for _,path in ipairs(M.paths) do
    local script,errorText=love.filesystem.load(path)
    local success,errorMessage=false,nil
    if script then
      success,errorMessage=pcall(script)
    else
      errorMessage=errorText or "unable to load"
    end
    if success then
      results.passed=results.passed+1
    else
      results.failed=results.failed+1
    end
    results.rows[#results.rows+1]={
      path=path,pass=success,error=success and nil or tostring(errorMessage)
    }
    print((success and "[PASS] " or "[FAIL] ")..path..
      (success and "" or (" : "..tostring(errorMessage))))
  end
  local summary=("Moo-Quest LÖVE tests: %d passed; %d failed"):format(
    results.passed,results.failed)
  print(summary)
  local text={summary}
  for _,r in ipairs(results.rows) do
    text[#text+1]=(r.pass and "PASS " or "FAIL ")..r.path..
      (r.error and ("\n"..r.error) or "")
  end
  local ok,writeError=love.filesystem.write("test-results.txt",table.concat(text,"\n").."\n")
  if ok then results.reportPath=love.filesystem.getSaveDirectory().."/test-results.txt"
  else results.reportError=writeError end
  return results
end
return M
