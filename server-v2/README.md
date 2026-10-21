# MooQuest Own Server V2 — implementação independente (alfa)

Este servidor foi escrito do zero em Node.js e **não incorpora** o motor do MooMoo,
protocolos FRVR, código do BrowserQuest ou imagens/sons de terceiros. A arquitetura
operacional foi inspirada no projeto do usuário, BrowserQuest-Revived, sem copiar
os módulos. A ausência de arte não é, sozinha, garantia de ausência de riscos de
propriedade intelectual: faça revisão jurídica de nome, marcas, assets, licenças
 e protocolos antes de comercializar.

## Instalação aaPanel

1. Na sua VPS com **Node.js 22+**, clone o repositório e entre em `server-v2/`.
2. Execute `npm install --omit=dev` no diretório `server-v2` (ou `bash scripts/install-aapanel.sh`).
3. No aaPanel → Node.js Project, configure projeto com raiz `.../Moo-Quest/server-v2`,
   startup **`node bootstrap.js`**, porta **8100**, variáveis:
   `MOO_PORT=8100`, `MOO_HOST=127.0.0.1`, `MOO_PUBLIC_HTTPS=1` e
   `MOO_TRUST_PROXY=1` (quando Nginx sobrescreve X-Real-IP).
4. Configure o domínio público com certificado HTTPS e **reverse proxy no aaPanel**
   encaminhando ao processo local `127.0.0.1:8100`. Não exponha a porta 8100.
5. Abra `https://seu-dominio/setup`, encontre o **código de instalação nos logs
   do projeto Node.js no aaPanel** e crie o proprietário com senha de pelo menos
   12 caracteres. O código não é disponibilizado por HTTP.
6. O painel está em `/admin`. Após reiniciar, use a mesma conta; a senha fica
   armazenada como hash scrypt em `server-v2/var/config.json`.

Por padrão o processo escuta só em `127.0.0.1:8100`. Isso evita conflito com
`8080` do servidor antigo, que permanece intacto. O instalador visual é parte
do próprio servidor e o script Shell é opcional.

## Painel administrativo

A interface atual oferece: instalação, login seguro, sessão com cookie HttpOnly,
proteção CSRF, status e monitoramento, limite de jogadores, modo manutenção,
MOTD, anúncios em tempo real, jogadores online, expulsão, bloqueio por origem,
registro de operações, verificação/download/ativação/rollback de atualizações
**assinadas**. Não é ainda um painel completo de editor de mundo, missões ou
contas, e novas ferramentas serão implementadas por etapas.

## Atualizações produzidas pelo nosso projeto

Jamais cole uma URL arbitrária no painel para executar código. Para permitir
atualizações configure as variáveis de ambiente:

- `MOO_UPDATE_MANIFEST_URL=https://updates.seu-dominio/releases/manifest.json`
- `MOO_UPDATE_PUBLIC_KEY_FILE=/caminho/fora/do-git/release-public.pem`

O administrador do projeto publica um manifesto assinado com chave privada
Ed25519, mantendo a chave **fora do Git, do aaPanel público e da VPS do jogo**.
O servidor verifica a assinatura e hash SHA-256 de cada arquivo e baixa apenas
arquivos `src/*.js` ou `public/*` do mesmo domínio HTTPS configurado.

Use `node scripts/make-release.mjs` com a chave privada offline para preparar
um release. No painel: **Verificar → Baixar e verificar → Preparar ativação**.
**Reinicie o processo pelo aaPanel**: `bootstrap.js` carrega a versão ativada
sem sobrescrever `var/`. Se a versão cair logo após iniciar, o bootstrap tenta
reverter automaticamente para a anterior. Há também botão Reverter no painel.

## Protocolo e próximo trabalho

- WebSocket próprio em `/play`, mensagens JSON autenticadas apenas para o
  canal de jogo de teste; `join`, `input`, `attack`, eventos e snapshots são
  processados no servidor. O jogador **não escolhe coordenadas ou dano**.
- A arena simples é **alfa de infraestrutura**: faltam colisões do mundo,
  NPCs, mobs, biomas, itens, inventário e persistência de progresso.
- **O cliente Lua antigo não conecta a V2 ainda.** Um adaptador de protocolo
  autoral e os testes de integração serão desenvolvidos separadamente.
- As rotas `/health`, `/ready` e `/api/status` não exigem login;
  `/api/admin/*` requer sessão e CSRF para mutações.

Rode `npm test` para testes de autenticação, armazenamento, atualizações,
instalação HTTP e simulação de mundo. Nenhuma arte de jogo está incluída.
