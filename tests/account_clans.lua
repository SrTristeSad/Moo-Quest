package.path="./?.lua;./?/init.lua;"..package.path
local Json=require("src.net.json")
local Clans=require("src.game.account_clans")
local saved={name="",role="owner",clan=Json.null,invites={{clan="XYZ",by="Buddy"}},
  requests={},members={},closed=false,events={}}
local fake={}
function fake.getAccount(token)
  assert(token=="fake-token")
  return {name=saved.name}
end
function fake.claimName(token,name)
  assert(token=="fake-token")
  saved.name=name
  return name
end
function fake.clanMine(token)
  assert(token=="fake-token")
  if saved.clan==Json.null then return {clan=Json.null,invites=saved.invites} end
  return {clan=saved.clan,role=saved.role,
    requests=saved.requests,invited={}}
end
function fake.clanAction(token,action,body)
  assert(token=="fake-token")
  saved.events[#saved.events+1]={action=action,body=body}
  if action=="create" then
    if saved.clan~=Json.null then return nil,"in a clan" end
    saved.clan={name=body.name,members={{name=saved.name,role="owner"}},closed=false}
    saved.role="owner"
  elseif action=="answer" then
    assert(type(body.accept)=="boolean")
    if body.accept then
      saved.clan={name=body.clan,members={{name=saved.name,role="member"}},closed=false}
      saved.role="member"
    end
    saved.invites={}
  elseif action=="invite" then
    assert(body.name=="Friend")
  elseif action=="decide" then
    assert(type(body.accept)=="boolean")
    saved.requests={}
  elseif action=="requests" then
    saved.clan.closed=not body.open
  elseif action=="role" then
    assert(body.role=="officer" or body.role=="owner" or body.role=="member")
  elseif action=="kick" then
    assert(body.name=="Friend")
  elseif action=="leave" or action=="disband" then
    saved.clan=Json.null
  elseif action=="request" then
    assert(body.clan=="XYZ")
  end
  return {}
end
local clan=Clans.new({api=fake})
local x,y,w,h=clan:buttonRect(1280)
assert(x==819 and y==22 and w==59 and h==58)
assert(not clan:isOpen())
assert(clan:open(nil)==false and clan:isOpen())
assert(not clan:claim())
clan:close()
assert(not clan:open("fake-token") and clan.field=="name")
assert(clan:textinput("Player_One"))
assert(clan.inputs.name=="Player_One")
assert(clan:claim() and clan.accountName=="Player_One")
assert(clan:selectTab("invites") and #clan:rows()==1)
assert(clan:answerInvite("XYZ",false) and #saved.invites==0)
assert(clan:selectTab("find"))
clan.inputs.clan="XYZ"
assert(clan:request())
clan:selectTab("create")
assert(clan:textinput("a")==true)
clan.inputs.clan="ABC"
assert(clan:create() and clan:clan().name=="ABC")
assert(clan.tab=="members" and clan:leader())
saved.clan.members[#saved.clan.members+1]={name="Friend",role="member"}
saved.requests={"NewUser"}
assert(clan:refresh())
assert(clan:changeRole("Friend","officer"))
assert(clan:selectTab("requests") and #clan:rows()==1)
assert(clan:decide("NewUser",true))
assert(#clan:rows()==0)
assert(clan:selectTab("manage"))
clan.inputs.target="Friend"
assert(clan:invite())
assert(clan:toggleRequests() and saved.clan.closed)
assert(clan:toggleRequests() and not saved.clan.closed)
assert(not clan:disband() and saved.clan~=Json.null)
assert(clan.confirmDisband)
assert(clan:disband() and clan:clan()==nil)
assert(clan.tab=="create")
assert(clan:selectTab("invites"))
saved.invites={{clan="XYZ",by="Buddy"}}
assert(clan:refresh())
assert(clan:answerInvite("XYZ",true))
assert(clan:clan().name=="XYZ" and clan:role()=="member")
assert(clan:leave() and clan:clan()==nil)
assert(#saved.events>=11)
clan:close()
assert(not clan:isOpen())
print("permanent account clan controller: name, create, requests, invites, roles, leave, disband passed")
