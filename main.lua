local Camera = require("src.camera")
local Input = require("src.input")
local Protocol = require("src.protocol")
local camera, input
local status = "Sem conexao - protocolo em auditoria"
local elapsed = 0

function love.load()
  love.graphics.setDefaultFilter("nearest", "nearest")
  camera = Camera.new()
  input = Input.new()
end

function love.resize(w,h) camera:resize(w,h) end
function love.update(dt)
  elapsed = elapsed + dt
  input:update(dt)
  -- Do not simulate server-authoritative movement or pretend a connection exists.
end

function love.draw()
  local w,h=love.graphics.getDimensions()
  love.graphics.clear(0.085,0.11,0.14)
  love.graphics.setColor(0.17,0.23,0.28)
  love.graphics.rectangle("fill",0,0,w,h)
  love.graphics.setColor(0.29,0.38,0.44,0.35)
  local grid=64
  for x=0,w,grid do love.graphics.line(x,0,x,h) end
  for y=0,h,grid do love.graphics.line(0,y,w,y) end
  love.graphics.setColor(1,1,1)
  love.graphics.print("MOO-QUEST | Cliente desktop Lua + LOVE",24,22,0,1.4)
  love.graphics.print(status,24,64)
  love.graphics.print("Resolucao: "..w.."x"..h,24,92)
  love.graphics.print("Entrada: "..input:describe(),24,120)
  love.graphics.print("Pacotes implementados: "..Protocol.implementedCount(),24,148)
  love.graphics.print("Proxima etapa: compatibilidade com servidor al007ex",24,190)
  love.graphics.print("Nenhum asset ou codigo do cliente oficial FRVR foi incluido.",24,h-42)
end
function love.keypressed(key)
  if key=="escape" then love.event.quit() end
  input:keypressed(key)
end
function love.keyreleased(key) input:keyreleased(key) end
function love.mousepressed(x,y,button) input:mousepressed(x,y,button) end
function love.mousereleased(x,y,button) input:mousereleased(x,y,button) end
