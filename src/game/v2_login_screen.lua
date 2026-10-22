-- Online V2 account gate. The player may enter the game selection menu
-- only after login succeeds; this screen never stores secrets on disk.
local Login={}
local fonts={}
local function font(size)
  if not fonts[size] then fonts[size]=love.graphics.newFont(size) end
  love.graphics.setFont(fonts[size])
end
local function rect(x,y,w,h,r,g,b,a,round)
  love.graphics.setColor(r,g,b,a or 1)
  love.graphics.rectangle('fill',x,y,w,h,round or 8,round or 8)
end
local function label(value,x,y,size,color)
  font(size)
  local c=color or {0.19,0.24,0.22}
  love.graphics.setColor(c)
  love.graphics.print(value,x,y)
end
local function hit(x,y,px,py,w,h)
  return x>=px and x<px+w and y>=py and y<py+h
end
function Login.click(menu,sx,sy,w,h)
  local x,y=menu:mapInput(sx,sy,w,h)
  menu.authMode=menu.authMode or 'login'
  if hit(x,y,430,262,420,52) then
    menu.authStep='email';menu.authFocus='email';return 'auth_focus'
  end
  if hit(x,y,430,351,420,52) then
    menu.authStep='code';menu.authFocus='code';return 'auth_focus'
  end
  if hit(x,y,430,433,420,53) then
    return 'auth_verify'
  end
  if hit(x,y,430,506,420,33) then
    if menu.authMode=='login' then
      if menu.registrationEnabled==false then
        menu.authMessage='Cadastro desativado pelo administrador.'
        return 'registration_closed'
      end
      menu.authMode='register'
    else
      menu.authMode='login'
    end
    menu.authCode='';menu.authMessage=''
    menu.authStep='email';menu.authFocus='email'
    return 'auth_open'
  end
  return nil
end
function Login.keypressed(menu,key)
  menu.authMode=menu.authMode or 'login'
  if key=='escape' then
    -- Never expose the guest Play menu behind mandatory login.
    menu.authStep='email';menu.authFocus='email'
    return nil
  end
  return menu:keypressed(key)
end
function Login.draw(menu,status)
  local w,h=love.graphics.getDimensions()
  local scale,ox,oy=menu:geometry(w,h)
  local original=love.graphics.getFont()
  love.graphics.push('all')
  love.graphics.translate(ox,oy)
  love.graphics.scale(scale)
  rect(0,0,1280,720,0.055,0.10,0.09,0.83,0)
  rect(350,87,580,547,0.985,0.989,0.983,1,18)
  rect(350,87,580,8,0.37,0.74,0.38,1,0)
  font(40)
  love.graphics.setColor(0.16,0.28,0.18)
  love.graphics.printf('MOO-QUEST',350,123,580,'center')
  font(18)
  love.graphics.setColor(0.42,0.48,0.43)
  love.graphics.printf('Entre na sua conta para continuar',350,189,580,'center')
  label('USUARIO',430,239,13,{0.30,0.40,0.34})
  rect(430,262,420,52,0.92,0.94,0.92,1,9)
  if menu.authStep=='email' then
    love.graphics.setColor(0.29,0.62,0.33)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle('line',430,262,420,52,9,9)
  end
  local user=menu.authEmail or ''
  label((user~='' and user or 'Nome de usuario')..
    (menu.authStep=='email' and '|' or ''),449,275,17,
    user~='' and {0.15,0.21,0.17} or {0.57,0.59,0.57})
  label('SENHA',430,328,13,{0.30,0.40,0.34})
  rect(430,351,420,52,0.92,0.94,0.92,1,9)
  if menu.authStep=='code' then
    love.graphics.setColor(0.29,0.62,0.33)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle('line',430,351,420,52,9,9)
  end
  local entered=menu.authCode or ''
  local masked=entered~='' and string.rep('*',math.min(#entered,30)) or 'Sua senha'
  label(masked..(menu.authStep=='code' and '|' or ''),449,364,17,
    entered~='' and {0.15,0.21,0.17} or {0.57,0.59,0.57})
  rect(430,433,420,53,0.35,0.75,0.36,1,9)
  font(20)
  love.graphics.setColor(0.08,0.20,0.08)
  love.graphics.printf(menu.authMode=='register' and 'Criar conta e entrar' or
    'Entrar na conta',430,447,420,'center')
  font(15)
  love.graphics.setColor(0.26,0.47,0.29)
  local secondary=menu.authMode=='register' and 'Ja tenho conta - Entrar'
    or menu.registrationEnabled==false and 'Cadastro fechado'
    or 'Criar uma nova conta'
  love.graphics.printf(secondary,430,514,420,'center')
  local info=menu.authMessage~='' and menu.authMessage or
    (status or 'Conexao segura com app.snusnu.com.br')
  font(13)
  love.graphics.setColor(menu.authMessage~='' and {0.68,0.20,0.18} or {0.38,0.43,0.39})
  love.graphics.printf(tostring(info):sub(1,190),405,567,470,'center')
  font(13)
  love.graphics.setColor(0.67,0.72,0.68)
  love.graphics.printf('Login protegido por HTTPS. A partida abre somente apos autenticar.',
    290,660,700,'center')
  love.graphics.pop()
  love.graphics.setFont(original)
end
return Login
