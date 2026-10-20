-- Reference PNG loader. Images stay in assets/reference/img copied locally
-- from node-runtime/client/public/img. Never silently replace absent sprites.
local A={}
local cache={}
local missing={}
local allowed={animals=true,weapons=true,hats=true,accessories=true,
  resources=true,icons=true}
function A.get(category,filename)
  if not allowed[category] then return nil end
  if type(filename)~="string" or not filename:match("^[%w_%-]+%.png$") then
    return nil
  end
  local path="assets/reference/img/"..category.."/"..filename
  if cache[path]~=nil then return cache[path] or nil end
  if not love.filesystem.getInfo(path,"file") then
    missing[path]=true
    cache[path]=false
    return nil
  end
  local ok,result=pcall(love.graphics.newImage,path)
  if not ok then
    missing[path]=true
    cache[path]=false
    return nil
  end
  result:setFilter("linear","linear")
  cache[path]=result
  return result
end
function A.draw(category,filename,x,y,w,h,angle)
  local image=A.get(category,filename)
  if not image then return false end
  love.graphics.setColor(1,1,1,1)
  love.graphics.draw(image,x,y,angle or 0,
    w/image:getWidth(),h/image:getHeight(),image:getWidth()/2,image:getHeight()/2)
  return true
end
function A.missing()
  local paths={}
  for p in pairs(missing) do paths[#paths+1]=p end
  table.sort(paths)
  return paths
end
function A.reset()
  cache={}
  missing={}
end
return A
