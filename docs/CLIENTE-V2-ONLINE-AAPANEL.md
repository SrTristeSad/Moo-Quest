# Cliente Moo-Quest V2 Online — Windows / LÖVE

**Servidor configurado:** `https://app.snusnu.com.br` (API) e
`wss://app.snusnu.com.br/s/LC` (jogo). O cliente **não** usa API
legada nem baixa código do servidor na instalação.

## Como usar

1. Instale **Node.js 22+** e **LÖVE 2D 11.x** no computador Windows.
   O ZIP já contém o cliente Lua, o código da ponte TLS e o inicializador.
   Não é necessário instalar PostgreSQL/Redis no computador do jogador.
2. Extraia **todo o ZIP** em uma pasta e clique duas vezes em
   `JOGAR-V2-ONLINE-WINDOWS.bat`.
3. O inicializador abre somente `127.0.0.1:8080` no computador local,
   inicia a ponte de segurança e consulta `/ping` pelo domínio remoto
   com TLS verificado. Se retornar `mqv2native`, abre o LÖVE.
4. O cliente abre primeiro a **tela de login V2**. Informe usuário e senha,
   ou cadastre uma conta caso o administrador permita. Só depois do login
   a tela de personagem/Play aparece. A conta autenticada solicita ticket
   `/api/join`, conecta ao WebSocket binário `/s/LC` e pode entrar na partida.

O iniciador `JOGAR-V2-ONLINE-WINDOWS.bat` chama apenas
`node tools/run-v2-online.mjs` e **não executa PowerShell,
`ExecutionPolicy Bypass`, downloads, alterações no Registro ou
permissões de administrador**. Antes de iniciar o jogo, ele
valida `/ping` por meio da própria ponte HTTPS.

Ao encerrar LÖVE, o inicializador também encerra a ponte TLS.
Não use simultaneamente os launchers do servidor local e do cliente
online: ambos precisariam ocupar a porta 8080.

## O que a ponte faz

O LÖVE existente usa LuaSocket sem suporte TLS nativo empacotado.
Para não expor senhas ou tokens nem incluir DLLs LuaSec incompatíveis,
`tools/v2-https-relay.mjs` termina somente conexões loopback e
encaminha cada requisição autorizada a `app.snusnu.com.br:443` via
`tls.connect`, **com verificação obrigatória do certificado, SNI,
hostname e TLS 1.2+**. O WebSocket segue pela mesma sessão TLS.
O nó local reescreve Host e Origin no upgrade WebSocket para combinar
com o domínio HTTPS. Senhas/tokens não são registrados em log nem
gravados em arquivos. A ponte recusa rotas fora de /ping,
das APIs conhecidas e do WebSocket de jogo.

**Isso requer Node.js instalado na máquina Windows**: é uma ponte
de compatibilidade do cliente Lua existente, não um suporte TLS
feito dentro do motor LÖVE. Não é necessário iniciar um servidor do
jogo local — a porta 8080 transporta somente a conexão remota segura.

## Entendendo a tela "Servidor Online"

Ao iniciar pelo **`JOGAR-V2-ONLINE-WINDOWS.bat`**, a barra de título
deve dizer `Moo-Quest V2 ONLINE | app.snusnu.com.br`, e o painel
direito exibe `SERVIDOR ONLINE — LC - app.snusnu.com.br`.
A ponte local `127.0.0.1:8080` é apenas a conexão privada entre
LÖVE e Node no próprio PC; não é um servidor de jogo separado.

O modo online **não permite jogar como convidado sem desafio**.
A tela agora mostra `Faca login` e pede para selecionar `Entrar`,
informar nome de usuário e senha V2 e aguardar a emissão do ticket.
Após uma resposta positiva ao login, a conexão ao WebSocket é
realizada e o botão Play passa a ser liberado.

Se aparecer `LOCAL SERVER — LC 127.0.0.1:8080`, você abriu o
`INICIAR-V2-WINDOWS.bat` (modo de teste local) ou abriu a pasta
diretamente com `love.exe`, **em vez do inicializador online**.
Feche essa instância e use `JOGAR-V2-ONLINE-WINDOWS.bat`.
Nunca desative o antivírus para executar esse launcher.

Se o botão de cadastro responder `registration_disabled`, faça
login numa conta existente ou habilite novos cadastros no painel
admin do servidor. Se a conexão falhar mesmo após autenticar,
clique em **Detalhes** e copie a mensagem técnica, que identifica
se a falha ocorreu no HTTPS, no ticket V2 ou no WebSocket.

## Falha confirmada de cadastro/login no domínio — 22/10/2026

O teste ao vivo pelo mesmo relay HTTPS identificou
`POST /api/account/register`, `POST /api/account/login` e
`POST /api/join` respondendo **403 text/html**, em vez de JSON.
`/ping` e `/api/capabilities` funcionam (200 JSON).
O problema acontece **antes do retorno normal da API V2** e
precisa ser corrigido no proxy/regras de segurança do domínio
aaPanel. Nenhum cadastro ou login real foi realizado por esses
testes. Consulte o procedimento:

[Diagnóstico aaPanel: 403 HTML bloqueando API](../server-v2/docs/PROXY-AAPANEL-403-API.md).

O cliente agora diferencia o status HTTP, resposta HTML, resposta
vazia e JSON malformado sem imprimir conteúdos ou senhas. Não
tente contornar desativando a proteção do Windows ou o firewall
da VPS. Após o proxy retornar JSON, a resposta
`registration_disabled` indica separadamente que o painel
administrativo ainda não habilitou cadastros.

## Quando não conecta

- Erro "API V2 ...": verifique se o domínio está apontando ao Node.js
  certo no aaPanel, se a instalação foi concluída e se
  `https://app.snusnu.com.br/ping` responde com
  `{"build":"mqv2native",...}`.
- Erro "TLS connection failed": confira o certificado HTTPS válido,
  firewall e proxy reverso (Nginx); não desative validação de
  certificado para contornar o problema.
- Erro `registration_disabled`: o servidor desativou novos cadastros;
  habilite `publicRegistration` no painel administrativo antes de
  criar usuários novos (ou use uma conta existente).
- Erro `guest_verification_failed`: ao ativar o modo público o
  servidor exige Turnstile para convidados. Entre com uma conta V2;
  este cliente online não finge CAPTCHA resolvido.
- Erro `invalid_player_token`: o cliente tentará renovar a sessão
  uma única vez; se a renovação falhar, faça login novamente.
- Se `/s/LC` fechar na conexão, confira se o Nginx aceita
  `Upgrade: websocket` e encaminha-o ao Node do jogo.

## Limitações

O cliente continua sujeito às mecânicas inacabadas do V2. O protocolo
Lua não teve paridade visual e de gameplay integral validada num LÖVE
Windows real conectado à sua VPS. Testes automatizados da ponte
validam HTTPS, WebSocket, checagem de certificado e bloqueio de
requisições não autorizadas, mas **não comprovam** disponibilidade
nem configuração atual do domínio do aaPanel.

O ZIP de cliente **não inclui PNGs privados**. Copie suas artes próprias
para `MooQuest-V2-ONLINE/assets/custom/img/`, mantendo subpastas como
`animals/`, `weapons/`, `hats/` e `accessories/`. O carregador
prioriza essas imagens e mantém suporte a `assets/reference/img/`.
Sem elas, o jogo ainda conecta, mas algumas imagens ficam ausentes.
O cliente online não contém `PREPARAR-SERVIDOR.bat`.

### Recuperar o cliente visual anterior sem perder o login V2

O código original de câmera, renderização, HUD, lojas, animações e objetos
continua no cliente; a referência preservada antes do V2 é o commit
`5ad8c32` (branch `archive/client-before-server-v2-2026-10-21`).
**Não execute o cliente antigo diretamente contra a API V2**: ele não tem
o novo protocolo de conta e WebSocket.

1. Extraia o novo ZIP em uma pasta própria, sem apagar a instalação antiga.
2. Execute **`IMPORTAR-ARTES-ANTIGAS.bat`**.
3. Cole o caminho completo da pasta antiga que contém os PNGs.
   A ferramenta aceita `assets/custom/img/`, `assets/reference/img/`,
   `node-runtime/client/public/img/`, `client/public/img/`, `public/img/`
   e `img/` (somente subpastas de arte reconhecidas).
4. Confira quantos PNGs foram copiados e abra `JOGAR-V2-ONLINE-WINDOWS.bat`.
5. Durante a partida, pressione **F6** para recolher ou expandir o aviso
   de sprites ausentes sem afetar colisão, entidades ou inventário.

A importação funciona **somente para PNGs existentes na instalação antiga**.
Não baixa imagens de outros sites, não cria substitutos genéricos, não
copia dados de contas, não altera a VPS e não sobrescreve arquivos presentes.
O mundo quase vazio visto no servidor V2 não pode ser corrigido inventando
objetos no cliente: a densidade de recursos e animais é controlada pelo
servidor e precisa ser comparada separadamente com o servidor original.

## Alertas do Microsoft Defender ou SmartScreen

Se o Windows bloquear o ZIP ou inicializador, **não desative o
antivírus nem crie exclusões automaticamente**. Veja qual é a
detecção em **Segurança do Windows → Proteção contra vírus e ameaças →
Histórico de proteção** e registre o nome exato da ameaça e arquivo.
"Aplicativo não reconhecido" (SmartScreen) não equivale
necessariamente a detecção de trojan, mas não é uma aprovação de
segurança. Se for identificado malware, mantenha o arquivo em
quarentena até a verificação do conteúdo.

A versão anterior usava um script PowerShell com
`-ExecutionPolicy Bypass`; ele foi **removido** desta entrega
para reduzir comportamentos que poderiam disparar heurísticas.
O novo ZIP contém somente código-fonte Lua, JavaScript/Node,
o `.bat` transparente e documentação; não inclui arquivos
executáveis do LÖVE ou Node. Ainda pode haver alertas no download
por origem desconhecida ou por outros motivos; não afirmamos que um
alerta é falso positivo sem saber qual arquivo e detecção ocorreram.


## Microsoft Defender detectou `Trojan:Win32/MalUri.A!cl` no catálogo legado

Em 22/10/2026 o Windows Defender identificou especificamente
`shared/config/items.js` dentro do ZIP do cliente. O relatório marcou
a correção como incompleta. Uma inspeção estática do arquivo original
(hash SHA-256 `e5f203c49aa0e916852ce0367b9e92a65626a2608a2ac2adce7075fcae956abe`)
encontrou definições de armas, itens e construções; não foram
identificadas nele chamadas diretas de rede ou execução de processos.
**Essa inspeção não demonstra que o arquivo é seguro e não invalida
a detecção do Microsoft Defender.**

O Lua tem seu próprio catálogo em `src/game/catalog.lua`.
O antigo `shared/config/items.js`, `shared/config/store.js`,
`shared/config.js` e a configuração JS de referência do anticheat
não são carregados pelo runtime Lua. O pacote Windows passou a
**excluir** todos esses arquivos JavaScript de referência. O código
de referência permanece no repositório para auditoria, mas não faz
parte do programa instalado no Windows.

Não execute o ZIP que foi sinalizado. Mantenha a proteção do
Defender ativa; apague as cópias antigas depois de deixar o
antivírus lidar com a detecção, atualize as definições e execute
uma verificação completa. Se o Defender disser
**"Correção incompleta"**, execute as ações recomendadas pelo
Windows e, se persistir, uma verificação offline do Microsoft Defender.
Não permita a ameaça nem adicione exclusões.

A confirmação definitiva sobre um potencial falso positivo depende
de análise da Microsoft. Amostras podem ser enviadas para análise em
https://www.microsoft.com/wdsi/filesubmission — selecione o
arquivo individual detectado, não o projeto inteiro. A exclusão
do catálogo não constitui prova de limpeza do restante do sistema
ou do pacote; o Windows Defender continua sendo uma barreira ativa.


## Correcao: HTTP 403 vazio no cliente Windows — 22/10/2026

O erro `API V2 HTTP 403: resposta vazia em vez de JSON`, mesmo com
`/ping` bem-sucedido no console Node, foi causado por incompatibilidade
no transportador HTTPS local: LuaSocket inclui `TE: trailers` por padrão
em requisições HTTP/1.1, mas a ponte anterior rejeitava esse cabeçalho
antes de contactar o servidor. O verificador `/ping` do lançador usa
Node.js (não LuaSocket), por isso dava sucesso enganoso.

A ponte agora aceita **somente** `TE: trailers` legítimo em pedidos
HTTP comuns, remove o cabeçalho hop-by-hop antes de enviar a requisição
pela conexão TLS, normaliza `Connection: close` e continua bloqueando
`Transfer-Encoding`, `TE` diferente, rotas não aprovadas e headers
forjados. Testes reproduzem a solicitação real padrão do LuaSocket.
O relay também aceita `Connection: keep-alive` usado pelo Node.js no `/ping` do lançador, normalizando-o para `Connection: close` ao encaminhar via TLS. O cliente também diferencia uma resposta `403 Local relay request denied`
de erros de 403 emitidos pelo proxy remoto.

**Como usar:** baixe um ZIP completo do cliente desta revisão, extraia em
pasta nova, feche os executáveis antigos e abra
`JOGAR-V2-ONLINE-WINDOWS.bat`. Não basta reiniciar o jogo antigo,
porque o fix está em `tools/v2-https-relay.mjs`.

O bloqueio histórico de algumas rotas por Cloudflare/aaPanel é
independente: se após o novo cliente a API ainda retornar HTML 403,
consulte `server-v2/docs/PROXY-AAPANEL-403-API.md` e os logs da VPS.
Habilitar cadastros no painel continua obrigatório quando
`registrationEnabled=false`.

## Cliente V2 e novos controles de acesso do servidor

A API V2 agora permite ao administrador alterar **Permitir convidados** e
**Permitir cadastro de contas** separadamente. Nesta versão do cliente, ao
iniciar o modo V2, uma chamada pública autenticada pelo transporte TLS local
consulta `GET /api/capabilities` e apresenta as políticas atuais:

- Se `registrationEnabled=false`, o botão de cadastro mostra
  **Cadastro fechado**. Clicá-lo consulta novamente a política, pois o
  administrador pode reabrir cadastros enquanto o cliente estiver aberto.
  O login de contas existentes continua disponível.
- Se `guestEnabled=false`, não são emitidos tickets de convidados
  em sessões locais V2 e a tela pede login. No modo remoto o cliente
  já exigia conta V2 por não implementar ainda o Cloudflare Turnstile.
- Na confirmação de um cadastro iniciado antes de o administrador fechar
  inscrições, o cliente consulta novamente as capacidades e exibe a
  mensagem de cadastro fechado, em vez de tratar o bloqueio como erro
  genérico. A autoridade final continua sendo o Node.
- Se `/api/capabilities` falhar (por exemplo HTTP 403 HTML vindo de um
  WAF), o cliente não inventa uma política: mantém o login disponível
  e mostra o erro da API quando um pedido real for recusado.
- O botão Play não ignora a exigência de login online e o encerramento
  da conta não abre sessão de convidado quando o servidor o desabilitou.

A consulta passa pela ponte **HTTPS/WSS com TLS verificado** e nunca inclui
senha nem tokens. Continua necessário liberar no Cloudflare/aaPanel as
rotas `/api/account/*` e `/api/join` que anteriormente responderam
HTML 403. O novo cliente não contorna esse bloqueio.


## Login funciona, mas Play fica indisponivel: /s/LC retorna 404

**Verificacao publica de 22/10/2026:** um pedido de upgrade WebSocket
autenticado pelo TLS do dominio `app.snusnu.com.br`, feito com
**ticket intencionalmente invalido**, obteve **HTTP 404** na rota
`wss://app.snusnu.com.br/s/LC`. A API HTTP respondeu normalmente.

No servidor Node V2, um WebSocket com ticket invalido e rejeitado
por encerramento da conexao antes do `101 Switching Protocols`, e
nao com HTTP 404. Esse resultado indica fortemente que o upgrade
WebSocket nao esta sendo repassado corretamente pelo aaPanel/Nginx
(ou por uma regra de proxy anterior). Nao prova que o ticket real ou
o Redis da conta estejam errados.

**Como corrigir no aaPanel sem terminal:** abra a configuracao do
site/proxy `app.snusnu.com.br` em **Website → Proxy Project →
Modify → URL Proxy → Websocket** e habilite WebSocket. Confira que o
proxy HTTPS repassa `/s/LC` para a mesma porta local do Node que
atende `/ping` (normalmente `127.0.0.1:8100`). Salve, aplique/
recarregue Nginx pela interface e abra novamente o cliente V2.

Se usa configuracao personalizada, a rota /s/LC precisa de HTTP/1.1,
`proxy_set_header Upgrade $http_upgrade`,
`proxy_set_header Connection "upgrade"` e o mesmo Host.
Nao crie dois blocos `location /s/LC` conflitantes e nao exponha
a porta Node publicamente.

Referencia oficial: https://www.aapanel.com/docs/Function/proxy.html

Esta versao do cliente tambem separa na tela **Falha ingresso**
(API /api/join) de **Falha WebSocket** (upgrade /s/LC).
Aperte **Detalhes** se a falha continuar e envie somente a mensagem
de diagnostico, nunca usuario/senha ou tickets de jogo.
