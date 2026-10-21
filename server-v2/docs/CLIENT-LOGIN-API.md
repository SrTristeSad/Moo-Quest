# API de login do cliente — Moo-Quest V2

Este documento descreve o contrato de backend e a primeira integração
da interface Lua local. O menu V2 já possui cadastro, login e logout; agora
renova o par de tokens uma única vez quando /api/join recusa um access
token expirado (HTTP 401). Ainda não equivale a um cliente remoto completo. A API é JSON sobre HTTP
(local) ou HTTPS pelo proxy reverso aaPanel. **O cliente remoto exige HTTPS
para não transmitir segredos em claro.** O servidor Node usa PostgreSQL
para contas e Redis para sessões. Senhas nunca são devolvidas.

## Credenciais

- \`username\`: de 3 a 20 caracteres ASCII \`A-Z a-z 0-9 _\`,
  comparação sem diferenciar maiúsculas/minúsculas, mas preserva capitalização.
- \`password\`: de 12 a 128 caracteres. Segredo é armazenado com scrypt e salt.
- \`token\`: token de acesso hexadecimal aleatório (64 caracteres, 8 horas).
- \`refreshToken\`: token de renovação hexadecimal aleatório (64 caracteres,
  30 dias); **cada renovação invalida o anterior**.
- Armazenar tokens em armazenamento seguro do dispositivo, não em logs,
  query strings, URLs, telemetria, capturas de tela ou arquivos do repositório.
- Todas as rotas retornam JSON; erros têm corpo \`{"error":"codigo"}\`.
  Nunca enviar nome e senha como parâmetros GET.

## Rotas

| Método | Rota | Corpo | Retorno |
|---|---|---|---|
| POST | \`/api/account/register\` | \`{"username":"Jogador01","password":"senha-de-exemplo-123"}\` | 201: \`id\`, \`username\` |
| POST | \`/api/account/login\` | Usuário e senha | 200: \`id\`, \`username\`, \`token\`, \`refreshToken\`, \`tokenType\`, \`expiresIn\`, \`refreshExpiresIn\` |
| POST | \`/api/account/refresh\` | \`{"refreshToken":"..."}\` | 200: nova dupla de tokens, \`id\`, \`username\` |
| GET | \`/api/account/me\` | Bearer | 200: \`id\`, \`username\`, \`clan\` |
| GET | \`/api/account/progress\` | Bearer | 200: último snapshot persistido, não o estado ao vivo |
| POST | \`/api/account/logout\` | Bearer **ou** \`{"refreshToken":"..."}\` sem cabeçalho | 200: \`{"ok":true}\` |
| POST | \`/api/account/logout-all\` | Bearer | 200: \`{"ok":true}\` |
| POST | \`/api/account/change-password\` | Bearer + \`{"currentPassword":"...","newPassword":"..."}\` | 200: \`{"ok":true,"reloginRequired":true}\` |
| POST | \`/api/join\` | Bearer + \`{"host":"https://game.example/s/LC"}\` | 200: \`ticket\`, \`did\` |
| GET | \`/api/capabilities\` | Nenhum | Inclui \`accountAPI:"v2-session-1"\` |

### Exemplo do login (formato ilustrativo)

\`\`\`json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "username": "Jogador01",
  "tokenType": "Bearer",
  "token": "<64 hexadecimais>",
  "expiresIn": 28800,
  "refreshToken": "<64 hexadecimais>",
  "refreshExpiresIn": 2592000
}
\`\`\`

Para chamadas autenticadas enviar o cabeçalho
\`Authorization: Bearer <token>\`. O ticket de \`/api/join\` é consumido
uma única vez no handshake binário da partida, separado da sessão de conta.

### Fluxo recomendado no cliente

1. Abrir cadastro ou login; validar campos localmente apenas para UX.
   Cadastro pode retornar 403 (\`registration_disabled\`) e nomes duplicados
   retornam 409 (\`username_taken\`).
2. Em login 200, guardar **os dois tokens** de forma segura. Nunca salvar senha.
3. Em requisição autenticada com 401, tentar **uma** renovação pelo
   refresh token; se funcionar, substituir os dois tokens de forma atômica.
   Se falhar, limpar credenciais e pedir novo login.
4. Não emitir refresh concorrentes usando o mesmo token; \`refreshToken\`
   é de uso único, por segurança. Erro 401 com \`invalid_refresh_token\`
   exige login novamente.
5. Em logout, usar Bearer; se o access token já expirou, usar
   \`refreshToken\` no corpo, sem Authorization. Apagar credenciais locais.
6. Alterar senha ou encerrar todas as sessões revoga todos os dispositivos
   e tickets pendentes; solicitar novo login em cada cliente.

### Segurança e limites

- Rate limit Redis no login e na renovação; sessão Redis não contém senha.
- A API devolve \`Cache-Control: no-store\` e não grava credenciais no log.
- Logout de uma sessão revoga seu par de tokens e fecha a partida da conta.
- Logout global e mudança de senha alteram a geração de sessão de toda
  a conta e encerram sua partida. Tickets WebSocket emitidos antes são
  invalidados. Chaves de geração sobrevivem mais que 30 dias.
- IP real atrás de Nginx só é confiável se o proxy sobrescrever
  \`X-Real-IP\` e a porta interna não ficar exposta.
- Ainda não há recuperação de senha por e-mail, verificação de e-mail,
  MFA, vínculo de dispositivo, sistema de banimento de contas ou UI final.
  Isso deve ser decidido antes de abrir um serviço público.


## Situação do cliente Lua/LÖVE

- O menu já cadastra e autentica contas V2 por senha. Ao entrar, guarda
  access e refresh tokens **somente na memória** do processo; não os grava
  no diretório do LÖVE, no GitHub ou em logs. Reiniciar o aplicativo exige
  login novamente. Armazenamento persistente exigiria cofre do sistema.
- Ao reconectar, **somente** HTTP 401 de /api/join aciona uma tentativa
  de `POST /api/account/refresh` e uma repetição de ingresso. HTTP 403
  ou problemas de rede não acionam renovação. Falhas definitivas de refresh
  invalidam o login na UI. Nenhum token de conta entra em URLs.
- O logout usa Bearer e pode repetir via refresh token se o access token
  expirou. A renovação não cria conta, personagem ou progresso local.
- Transporte `socket.http` + WebSocket do projeto continua
  **restrito a localhost**. Não usar HTTP ou ws:// pela internet:
  HTTPS/WSS ainda precisa de implementação segura e validação em Windows.
- Em `MOO_PUBLIC_MODE=1`, entrada de convidados requer token Turnstile
  verdadeiro. A integração da UI desse desafio ainda é pendente; não
  substituir por `captcha:true`.
