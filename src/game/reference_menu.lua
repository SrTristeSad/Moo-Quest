-- Port of the ORIGINAL JavaScript client opening screen.
-- Layout/fields based on client/public/html/play.html and css/main.css.
-- Unlike the former auto-spawn, the player chooses Play before sending M.
local World=require("src.game.world_state")
local C=require("src.game.config")
local Shapes=require("src.game.reference_primitives")
local Menu={}
Menu.__index=Menu

local colors={"#bf8f54","#cbb091","#896c4b","#fadadc","#ececec",
  "#c37373","#4c4c4c","#ecaff7","#738cc3","#8bc373"}
local function rect(x,y,w,h,r,g,b,a,radius)
  love.graphics.setColor(r,g,b,a or 1)
  love.graphics.rectangle("fill",x,y,w,h,radius or 5,radius or 5)
end
local function font(s)
  Menu.fonts=Menu.fonts or {}
  if not Menu.fonts[s] then Menu.fonts[s]=love.graphics.newFont(s) end
  love.graphics.setFont(Menu.fonts[s])
end
local function text(str,x,y,s,color)
  font(s or 18)
  local h=love.graphics.getFont():getHeight()
  local rgb=color or {0.18,0.18,0.18}
  love.graphics.setColor(rgb[1],rgb[2],rgb[3],rgb[4] or 1)
  love.graphics.print(tostring(str),x,y)
  return h
end
local function center(str,x,y,w,s,color)
  font(s or 18)
  local rgb=color or {0.18,0.18,0.18}
  love.graphics.setColor(rgb[1],rgb[2],rgb[3],rgb[4] or 1)
  love.graphics.printf(tostring(str),x,y,w,"center")
end
local function hot(x,y,px,py,w,h)
  -- x/y = pointer, px/py = element origin (same order as Menu:click).
  return x>=px and y>=py and x<px+w and y<py+h
end
local function menuView()
  local world=World.new()
  local mid=C.mapScale/2
  local trees={
    {0,mid,mid+200,4},{1,mid,mid-480,4},{2,mid+300,mid+450,4},
    {3,mid-950,mid-130,3},{4,mid-750,mid-400,4},
    {5,mid-700,mid+400,3},{6,mid+800,mid-200,4}
  }
  for _,e in ipairs(trees) do
    world.objects[e[1]]={sid=e[1],x=e[2],y=e[3],
      dir=0,scale=C.treeScales[e[4]],type=0}
  end
  local bushes={
    {7,mid-260,mid+340},{8,mid+760,mid+310},
    {9,mid-800,mid+100}
  }
  for _,e in ipairs(bushes) do
    world.objects[e[1]]={sid=e[1],x=e[2],y=e[3],
      dir=0,scale=C.bushScales[#C.bushScales],type=1}
  end
  -- The two windmills are the original prepareMenuBackground() entries
  -- using items.list[4].scale and items.list[10] as sprite data.
  world.objects[10]={sid=10,x=mid-800,y=mid+300,
    dir=0,scale=50,type=4,id=10}
  world.objects[11]={sid=11,x=mid+650,y=mid-390,
    dir=0,scale=50,type=4,id=10}
  world.objects[12]={sid=12,x=mid-400,y=mid-450,
    dir=0,scale=C.rockScales[3],type=2}
  return world
end
function Menu.new()
  return setmetatable({name="Jogador",skin=0,tab="Game",
    nameFocus=false,grid=true,world=menuView(),
    startPending=false,status=""},Menu)
end
function Menu:geometry(w,h)
  local scale=math.min(w/1280,h/720)
  return scale,(w-1280*scale)/2,(h-720*scale)/2
end
function Menu:mapInput(sx,sy,w,h)
  local scale,offX,offY=self:geometry(w,h)
  return (sx-offX)/scale,(sy-offY)/scale
end
function Menu:click(sx,sy,w,h)
  local x,y=self:mapInput(sx,sy,w,h)
  if hot(x,y,385,219,134,43) then self.tab="Game";return "tab" end
  if hot(x,y,519,219,133,43) then self.tab="Info";return "tab" end
  if hot(x,y,652,219,131,43) then self.tab="Settings";return "tab" end
  if self.tab=="Game" then
    if hot(x,y,393,326,370,42) then
      self.nameFocus=true
      return "focus"
    end
    if hot(x,y,396,469,112,48) then
      self.nameFocus=false
      return "play"
    end
    for i=0,9 do
      local col,row=i%5,math.floor(i/5)
      if hot(x,y,529+col*45,403+row*45,34,34) then
        self.skin=i
        self.nameFocus=false
        return "skin"
      end
    end
  elseif self.tab=="Settings" then
    if hot(x,y,403,306,359,48) then
      self.grid=not self.grid
      return "grid"
    end
  end
  self.nameFocus=false
  return nil
end
function Menu:keypressed(key)
  if key=="backspace" and self.nameFocus then
    local pos=#self.name
    while pos>1 and self.name:byte(pos)>=128 and self.name:byte(pos)<192 do
      pos=pos-1
    end
    self.name=self.name:sub(1,pos-1)
  elseif (key=="return" or key=="kpenter") and self.tab=="Game" then
    self.nameFocus=false
    return "play"
  end
end
function Menu:textinput(chars)
  if not self.nameFocus or type(chars)~="string" then return end
  local name=self.name..chars
  local count=0
  for i=1,#name do
    local byte=name:byte(i)
    if byte<128 or byte>=192 then
      count=count+1
      if count>15 then name=name:sub(1,i-1);break end
    end
  end
  self.name=name
end
function Menu:draw(connectionState,status)
  local w,h=love.graphics.getDimensions()
  local scale,offX,offY=self:geometry(w,h)
  local previous=love.graphics.getFont()
  love.graphics.push("all")
  love.graphics.translate(offX,offY)
  love.graphics.scale(scale)
  rect(0,0,1280,720,0,0,0,0.5,0)
  center("MOOMOO.io",0,72,1280,64,{1,1,1})
  -- Three-column game menu is copied from the HTML/CSS layout, not
  -- a fabricated HUD displayed during gameplay.
  rect(68,205,285,335,1,1,1,0.97,9)
  rect(370,205,429,335,1,1,1,0.97,9)
  rect(816,205,396,335,1,1,1,0.97,9)
  text("TOP PLAYERS",86,228,18)
  text("Leaderboard disponível",87,282,14,{0.4,0.4,0.4})
  text("quando receber dados",87,304,14,{0.4,0.4,0.4})
  text("da partida.",87,326,14,{0.4,0.4,0.4})
  -- These tabs correspond to the original Game / Info / Settings HTML tabs.
  local tabs={{"Game",385,134},{"Info",519,133},{"Settings",652,131}}
  for _,entry in ipairs(tabs) do
    local selected=self.tab==entry[1]
    rect(entry[2],219,entry[3],43,selected and 1 or 0.95,
      selected and 1 or 0.95,selected and 1 or 0.95,1,1)
    if selected then rect(entry[2],258,entry[3],4,0.49,0.9,0.35,1,0) end
    center(entry[1],entry[2],230,entry[3],16)
  end
  if self.tab=="Game" then
    text("ENTER GAME",397,278,19)
    rect(393,326,370,42,0.94,0.94,0.94,1,5)
    text(self.name..(self.nameFocus and "|" or ""),407,336,19)
    rect(393,382,370,141,0.96,0.96,0.96,1,8)
    rect(397,391,112,72,1,1,1,1,6)
    -- Character preview uses the original Canvas body + arms primitives.
    local color=colors[self.skin+1]
    love.graphics.push()
    love.graphics.translate(453,423)
    love.graphics.rotate(-math.pi/4)
    Shapes.circle(20*math.cos(math.pi/4),20*math.sin(math.pi/4),7,color,"#525252",2)
    Shapes.circle(20*math.cos(-math.pi/4),20*math.sin(-math.pi/4),7,color,"#525252",2)
    Shapes.circle(0,0,21,color,"#525252",2)
    love.graphics.pop()
    rect(396,469,112,48,0.49,0.90,0.35,1,6)
    center("Play",396,482,112,23,{0.1,0.22,0.11})
    text("SKIN COLOR",530,383,14)
    for i=0,9 do
      local col,row=i%5,math.floor(i/5)
      local x,y=529+col*45,403+row*45
      if i==self.skin then
        rect(x-3,y-3,40,40,0.19,0.19,0.19,1,7)
      end
      Shapes.color(colors[i+1])
      love.graphics.circle("fill",x+17,y+17,14)
    end
  elseif self.tab=="Info" then
    text("WELCOME",395,286,20)
    text("Build your village, gather resources,",395,324,16)
    text("and defend against other players.",395,348,16)
    text("CONTROLS",395,390,19)
    text("WASD  Move       Mouse  Aim",395,427,16)
    text("Click / Space  Gather and attack",395,453,15)
    text("Q  Food       E  Auto attack",395,479,15)
  else
    text("GAME SETTINGS",395,281,20)
    rect(403,306,359,48,0.95,0.95,0.95,1,5)
    text("Show Grid",416,318,17)
    text(self.grid and "ON" or "OFF",692,318,17)
  end
  text("LOCAL SERVER",839,229,19)
  text("LC  -  127.0.0.1:8080",839,281,18)
  local ready=connectionState=="keyed_transport" or
    connectionState=="spawn_confirmed"
  local state=ready and "Ready" or (connectionState or "Connecting")
  text("Connection: "..state,839,333,16,
    ready and {0.2,0.55,0.2} or {0.46,0.36,0.2})
  font(14)
  love.graphics.setColor(0.3,0.3,0.3)
  love.graphics.printf(status or self.status or "",839,378,340,"left")
  center("WASD - Movement       Click / Space - Gather / Attack",
    0,635,1280,18,{1,1,1})
  love.graphics.pop()
  love.graphics.setFont(previous)
end
return Menu
