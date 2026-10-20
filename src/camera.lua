local Camera={}
Camera.__index=Camera
function Camera.new()
  local w,h=love.graphics.getDimensions()
  return setmetatable({x=0,y=0,width=w,height=h,zoom=1},Camera)
end
function Camera:resize(w,h) self.width=w self.height=h end
function Camera:worldToScreen(x,y)
  return (x-self.x)*self.zoom+self.width/2,(y-self.y)*self.zoom+self.height/2
end
function Camera:screenToWorld(x,y)
  return (x-self.width/2)/self.zoom+self.x,(y-self.height/2)/self.zoom+self.y
end
function Camera:follow(x,y) self.x=x self.y=y end
return Camera
