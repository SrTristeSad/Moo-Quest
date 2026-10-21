package.path="./?.lua;./?/init.lua;"..package.path
local Store=require("src.game.store_catalog")
local World=require("src.game.world_state")
local Panels=require("src.game.reference_panels")
assert(#Store.hats==49 and #Store.accessories==21)
assert(Store.byId(51,false).name=="Moo Cap")
assert(Store.byId(2,false).price==500)
assert(Store.byId(53,false).topSprite==true)
assert(Store.byId(9,true).price==1000)
assert(#Store.list(false)==47) -- Shame and Crab Shell are not for sale
assert(#Store.list(true)==21)
local w=World.new()
local p=Panels.new()
local shopX,tribeX,top,size=p:buttons(1280)
assert(shopX==885 and tribeX==952 and top==22 and size==58)
local click=p:click(w,shopX+5,top+5,1280,720)
assert(click and click.consumed and p.opened=="store")
assert(p:storeButtonLabel(w,Store.byId(51,false))=="Equip")
local equipped=p:storeAction(w,Store.byId(51,false))
assert(equipped.packet=="c" and equipped.args[1]==0 and equipped.args[2]==51 and equipped.args[3]==0)
assert(w:apply("5",{1,51,0}) and w.store.hatIndex==51)
assert(p:storeButtonLabel(w,Store.byId(51,false))=="Unequip")
assert(w:apply("5",{1,0,0}) and w.store.hatIndex==0)
assert(p:storeButtonLabel(w,Store.byId(51,false))=="Equip")
assert(p:storeButtonLabel(w,Store.byId(2,false))=="No gold")
assert(p:storeAction(w,Store.byId(2,false))==nil)
w.resources.points=600
local buy=p:storeAction(w,Store.byId(2,false))
assert(buy and buy.packet=="c" and buy.args[1]==1 and buy.args[2]==2 and buy.args[3]==0)
assert(w.store.hats[2]==nil, "A click must never grant an item without Node response")
assert(w:apply("5",{0,2,0}) and w.store.hats[2]==true)
assert(p:storeButtonLabel(w,Store.byId(2,false))=="Equip")
p.tab=1
assert(p:storeButtonLabel(w,Store.byId(9,true))=="No gold")
w.resources.points=1001
assert(p:storeAction(w,Store.byId(9,true)).args[3]==1)
assert(w:apply("5",{0,9,1}) and w.store.accessories[9])
assert(w:apply("5",{1,9,1}) and w.store.accessoryIndex==9)
assert(p:storeButtonLabel(w,Store.byId(9,true))=="Unequip")
-- All 47 sale hats and 21 accessories must be reachable, with no
-- hidden-but-clickable fifth store row at the default 1280x720 viewport.
p.tab=0
p.scroll=0
assert(p:visibleRows(720)==4, "420px panel fits only FOUR full store rows")
assert(p:visibleRows(420)==2, "smaller windows must shorten the list")
assert(p:scrollLimit(w,720)==#Store.list(false)-4)
local px,py,pw,ph=p:position(1280,720)
local invisible=p:click(w,px+350,py+107+4*52+20,1280,720)
assert(invisible and invisible.consumed and not invisible.packet,
  "a clipped fifth row must never buy an invisible item")
local nextPage=p:click(w,px+402,py+ph-58,1280,720)
assert(nextPage.consumed and p.scroll==4, "Next shows four new complete rows")
local previousPage=p:click(w,px+330,py+ph-58,1280,720)
assert(previousPage.consumed and p.scroll==0, "Prev returns to first page")
assert(p:keypressed("pagedown",w,720) and p.scroll==4)
assert(p:keypressed("pageup",w,720) and p.scroll==0)
assert(p:scrollBy(10000,w,720) and p.scroll==43)
w.resources.points=10000000
local lastHat=Store.list(false)[#Store.list(false)]
local lastAction=p:click(w,px+350,py+107+3*52+20,1280,720)
assert(lastAction and lastAction.packet=="c" and lastAction.args[2]==lastHat.id,
  "last hat must have a visible and clickable purchase/equip button")
assert(p:storeButtonLabel(w,lastHat)~="No gold")
assert(p:scrollBy(1,w,720) and p.scroll==43,"cannot scroll beyond last hat")
p.tab=1
p.scroll=0
assert(p:scrollBy(10000,w,720) and p.scroll==#Store.list(true)-4)
local lastAccessory=Store.list(true)[#Store.list(true)]
local lastAccAction=p:click(w,px+350,py+107+3*52+20,1280,720)
assert(lastAccAction and lastAccAction.packet=="c" and
  lastAccAction.args[2]==lastAccessory.id and lastAccAction.args[3]==1,
  "last accessory must be reachable with the correct Node packet")
assert(p:visibleRows(720)==4)
p:toggle("tribe")
assert(p:visibleRows(720)==5,"Tribe has its own tighter row spacing")
assert(p.opened=="tribe")
assert(w:apply("A",{{animals={},teams={{sid="ABC",owner=12},{sid="CLAN",owner=7,clan=true}}}}))
assert(#w.teams==2 and w.teams[1].sid=="ABC")
assert(p:clanJoinAvailable(w,w.teams[1]))
assert(not p:clanJoinAvailable(w,w.teams[2]))
assert(p:click(w,620,360,1280,720).consumed,"tribe panel should capture clicks")
local px,py,pw,ph=p:position(1280,720)
local join=p:click(w,px+358,py+110,1280,720)
assert(join.packet=="b" and join.args[1]=="ABC")
assert(not Panels.nameAllowed("solo"))
assert(not Panels.nameAllowed("too-long"))
assert(Panels.nameAllowed("AB 123"))
local edit=p:click(w,px+35,py+ph-51,1280,720)
assert(edit.consumed and p.editing)
assert(p:textinput("Clan1234"))
assert(p.tribeName=="Clan123")
local created=p:click(w,px+295,py+ph-51,1280,720)
assert(created and created.packet=="L" and created.args[1]=="Clan123")
assert(not w.tribe,"Client cannot grant membership before server confirmation")
assert(w:apply("g",{{sid="Clan123",owner=7}}))
assert(w:apply("3",{"Clan123",true}))
assert(w.tribe=="Clan123" and w.tribeOwner)
assert(w:apply("4",{{7,"owner",9,"friend"}}))
assert(#w.tribeMembers==2)
local leave=p:click(w,px+45,py+ph-51,1280,720)
assert(leave.packet=="N" and #leave.args==0)
assert(w.tribe=="Clan123","No premature leave before Node 3")
assert(w:apply("2",{13,"joiner"}))
assert(#w.joinRequests==1)
local approve=p:click(w,1280-330+10,100,1280,720)
assert(approve.packet=="P" and approve.args[1]==13 and approve.args[2]==true and approve.consumeRequest)
assert(#w.joinRequests==1,"Do not consume a join request before successful network send")
assert(w:apply("3",{false,false}) and w.tribe==nil)
assert(w:apply("1",{"Clan123"}))
assert(#w.teams==2 and w.teams[1].sid=="ABC")
assert(p:wheelmoved(0,-1,w))
p:reset()
assert(not p:isOpen())
-- Real browser parity: mouseover selects a store tooltip WITHOUT buying
-- or equipping, and mouseout clears it. Tests cover scissor-clipped rows,
-- both catalogs, scroll page changes and tab swaps.
assert(p:hover(640,360,1280,720)==nil)
p:toggle("store")
-- The original browser preserves the last selected tab when reopening.
-- Explicitly click Hats instead of assuming reset() changed the tab.
local px,py,pw,ph=p:position(1280,720)
assert(p:click(w,px+50,py+74,1280,720).consumed and p.tab==0)
local firstHat=Store.list(false)[1]
assert(p:hover(px+48,py+117,1280,720)==firstHat)
assert(p.hoverItem==firstHat)
assert(p:storeButtonLabel(w,firstHat)~=nil)
assert(p:hover(px+48,py+156,1280,720)==firstHat)
assert(p:hover(px+48,py+157,1280,720)==nil,
  "the 2px gap between rows is NOT a hover target")
local secondHat=Store.list(false)[2]
assert(p:hover(px+48,py+107+52+7,1280,720)==secondHat)
-- Row 5 is clipped under the footer, so no invisible tooltip.
assert(p:hover(px+48,py+107+4*52+7,1280,720)==nil)
assert(p:hover(px+16,py+115,1280,720)==nil)
assert(p:hover(px+50,py+90,1280,720)==nil)
assert(p:hover(px+50,py+ph+7,1280,720)==nil)
p:hover(px+48,py+117,1280,720)
assert(p:scrollBy(4,w,720) and p.hoverItem==nil)
assert(p:hover(px+48,py+117,1280,720)==Store.list(false)[5])
-- Tab click clears stale hat hover; only accessory entries may follow.
local tabs=p:click(w,px+300,py+72,1280,720)
assert(tabs and tabs.consumed and p.tab==1 and p.hoverItem==nil)
local accessory=Store.list(true)[1]
assert(p:hover(px+48,py+117,1280,720)==accessory)
assert(p.hoverItem==accessory)
assert(p:keypressed("return",w,720) and p.opened=="store",
  "Enter must be consumed by the modal, not open the background chat")
assert(p:keypressed("kpenter",w,720) and p.opened=="store")
p:toggle("tribe")
assert(p.hoverItem==nil and p:hover(px+48,py+117,1280,720)==nil)
p:reset()
assert(not p:isOpen())
print("reference store and tribe panels: exact catalog, Node-only operations, mouseover and focus passed")
