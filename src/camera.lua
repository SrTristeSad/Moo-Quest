local Camera={}
Camera.__index=Camera
function Camera.new()
  local w,h=love.graphics.getDimensions()
  return setmetatable({x=0,y=0,width=w,height=h,zoom=1,hasTarget=false},Camera)
end
function Camera:resize(w,h) self.width=w self.height=h end
function Camera:worldToScreen(x,y)
  return (x-self.x)*self.zoom+self.width/2,(y-self.y)*self.zoom+self.height/2
end
function Camera:screenToWorld(x,y)
  return (x-self.width/2)/self.zoom+self.x,(y-self.height/2)/self.zoom+self.y
end
function Camera:follow(x,y) self.x=x self.y=y self.hasTarget=true end
-- Client reference updateGame(): camSpd = min(dist * 0.01 * deltaMs, dist).
function Camera:followReference(x,y,dt)
  if not self.hasTarget then
    self:follow(x,y)
    return
  end
  local dx,dy=x-self.x,y-self.y
  local distance=math.sqrt(dx*dx+dy*dy)
  if distance<=0.05 then
    self.x=x;self.y=y
    return
  end
  local speed=math.min(distance*0.01*math.max(0,dt or 0)*1000,distance)
  self.x=self.x+dx*(speed/distance)
  self.y=self.y+dy*(speed/distance)
end
return Camera
