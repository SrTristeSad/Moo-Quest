package.path="./?.lua;./?/init.lua;"..package.path
local Menu=require("src.game.reference_menu")
local C=require("src.game.config")
local m=Menu.new()
assert(m.tab=="Game" and m.name=="Jogador" and m.skin==0)
assert(m.world.objects[0] and m.world.objects[0].x==C.mapScale/2)
assert(m.world.objects[0].y==C.mapScale/2+200)
assert(m.world.objects[12].type==2)
assert(m.world.objects[10].id==10 and m.world.objects[11].id==10,
  "reference menu includes two original windmills")
local z,x,y=m:geometry(1280,720)
assert(z==1 and x==0 and y==0)
assert(m:click(395,341,1280,720)=="focus")
assert(m:isEditingText(), "editing the player name must block R shortcuts")
assert(m:keypressed("r")==nil)
m.name=""
m:textinput("LuaQuest")
assert(m.name=="LuaQuest")
assert(m:click(532,410,1280,720)=="skin" and m.skin==0)
assert(m:click(712,460,1280,720)=="skin" and m.skin==9)
assert(m:click(410,488,1280,720)=="play_unavailable")
assert(not m:isEditingText(), "leaving the name field re-enables R shortcuts")
assert(m:keypressed("return")=="play_unavailable")
local label,note,kind=m:connectionInfo("blocked","protocol-build.json nao encontrado")
assert(label=="Bloqueado" and kind=="error" and note:find("Build"))
assert(m:click(1135,318,1280,720)=="details" and m.showTechnical)
assert(m:click(1182,335,1280,720)=="details" and not m.showTechnical,
  "entire drawn Details button must be clickable")
assert(m:click(1135,318,1280,720)=="details" and m.showTechnical)
assert(m:click(1135,318,1280,720)=="details" and not m.showTechnical)
m:connectionInfo("keyed_transport","Handshake aceito.")
assert(m:click(410,488,1280,720)=="play")
assert(m.name=="LuaQuest")
assert(m:click(545,233,1280,720)=="tab" and m.tab=="Info")
assert(m:click(710,233,1280,720)=="tab" and m.tab=="Settings")
assert(m:click(435,320,1280,720)=="grid" and m.grid==false)
assert(m:click(408,233,1280,720)=="tab" and m.tab=="Game")
assert(m:keypressed("return")=="play")
assert(m:click(820,660,1280,720)==nil)
assert(m:click(395,341,1280,720)=="focus" and m.nameFocus)
assert(m:click(870,460,1280,720)=="auth_open")
assert(not m.nameFocus, "opening login must unfocus the player name")
assert(m:isEditingText(), "local login email/code must block R shortcuts")
assert(m.authMode=="login" and m.authStep=="email")
m:textinput("player@example.com")
assert(m.authEmail=="player@example.com")
assert(m:click(880,493,1280,720)=="auth_request")
m.authStep="code"
m:textinput("12a34-56")
assert(m.authCode=="123456")
assert(m:keypressed("return")=="auth_verify")
assert(m:click(1038,489,1280,720)=="auth_back")
assert(not m:isEditingText(), "closed login restores menu hotkeys")
assert(m.authMode==nil)
assert(m:click(1034,462,1280,720)=="auth_open")
assert(m.authMode=="register")
m.authMode=nil
m.accountEmail="player@example.com"
assert(m:click(963,487,1280,720)=="clan_open")
assert(m:click(1063,487,1280,720)=="auth_logout")
local v2=Menu.new()
v2.accountBackend="v2"
assert(v2:click(870,460,1280,720)=="auth_open")
v2:textinput("User_123!@foo")
assert(v2.authEmail=="User_123foo" and #v2.authEmail<=20)
v2.authStep="code"
v2.authCode=""
v2:textinput("Long Password 123!")
assert(v2.authCode=="Long Password 123!")
v2:keypressed("backspace")
assert(v2.authCode=="Long Password 123")
assert(v2:isEditingText())
local online=Menu.new()
online.accountBackend="v2"
online.onlineMode=true
local title,notice,kind=online:connectionInfo("auth_required",
  "Entre na conta V2 para conectar ao servidor remoto.")
assert(title=="Faca login" and kind=="working")
assert(notice:find("CONTA V2",1,true))
assert(not online:canPlay())
local offlineTitle,offlineNotice,offlineKind=online:connectionInfo("failed",
  "API V2 HTTP 401: invalid_player_token")
assert(offlineTitle=="Falha" and offlineKind=="error")
assert(offlineNotice:find("Detalhes",1,true))
assert(online.technicalMessage:find("invalid_player_token",1,true))
online.registrationEnabled=false
online.guestEnabled=false
online.accountEmail=nil
assert(online:click(1055,460,1280,720)=="registration_closed")
assert(online.authMode==nil,"disabled registration cannot open account form")
assert(online:click(870,460,1280,720)=="auth_open")
assert(online.authMode=="login","login remains available when registration is disabled")
online.authMode=nil
online.registrationEnabled=true
assert(online:click(1055,460,1280,720)=="auth_open")
assert(online.authMode=="register","enabling registration exposes the form again")
online.authMode=nil
local loginTitle,loginHint=online:connectionInfo("auth_required","")
assert(loginTitle=="Faca login" and loginHint:find("CONTA V2"))
online.accountEmail="TestAccount"
online:connectionInfo("keyed_transport","Acesso autenticado")
assert(online:canPlay())
print("legacy and V2 menu credential input tests passed")
