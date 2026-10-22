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
4. No menu, use a **conta V2 com usuário e senha**. O servidor exige
   cadastro habilitado no painel para registrar novas contas. Após login,
   solicita ticket `/api/join`, conecta ao WebSocket binário `/s/LC` e
   envia o spawn normalmente.

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

O repositório-base não contém sprites PNG de terceiros. Para
manter as artes personalizadas já usadas na instalação anterior,
copie-as separadamente para a pasta `assets/custom/` se for o
caso; o ZIP não fabrica sprites e não inclui artes privadas.
