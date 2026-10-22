# Servidor Moo-Quest V2 — Node.js independente (desenvolvimento)

Este diretório contém o **servidor novo**, não um clone de código do servidor
MooMoo e não o código do BrowserQuest-Revived. O BrowserQuest foi utilizado
como referência apenas para instalação e administração.

**Escopo do jogo:** partidas multiplayer de sobrevivência e PvP, movimento,
recursos, animais, objetos, inventário, armas, loja, tribos e construções do
jogador. **Não haverá NPC, sistema de missões ou editor de mapa.**

**Estado:** trabalho em andamento. A base de instalação/painel funciona nos
testes, e existe uma primeira implementação do formato binário do cliente Lua,
mas ainda não foi validada uma partida completa no LÖVE. Os efeitos e itens
ainda não foram implementados integralmente. NÃO usar em produção pública.

## Primeira instalação guiada no aaPanel (sem configurar URLs de banco no Node)

**Novo fluxo:** instale e inicie PostgreSQL e Redis na VPS antes do
primeiro boot. Instale o ZIP completo e configure o projeto Node.js
(`node bootstrap.js`, Node >=22, `MOO_HOST=127.0.0.1`,
`MOO_PORT=8100`); configure o domínio em HTTPS apontando ao proxy
reverso. Sem `MOO_DATABASE_URL` e `MOO_REDIS_URL`, o bootstrap
**não encerra**: abre uma interface de instalação em `/setup` e
imprime nos logs do aaPanel um **código temporário de seis dígitos**.

No navegador, informe o código, endereço/porta/usuário/senha do
PostgreSQL e Redis e clique em **Testar PostgreSQL** e **Testar Redis**.
A conclusão valida ambos, cria as tabelas necessárias, cadastra o
administrador se ainda não existir e grava as conexões em
`MOO_DATA_DIR/infrastructure.json` (ou `var/infrastructure.json`)
com permissão `0600`. O mesmo bootstrap passa a iniciar o jogo
automaticamente. Reinicializações posteriores reutilizam a configuração
privada. Uma base existente **não perde o administrador**.

**Esse assistente configura conexões; não instala executáveis de
PostgreSQL ou Redis.** Para provisioná-los, há o `compose.yaml`.
Não coloque `var/` ou `MOO_DATA_DIR` sob uma rota estática do
Nginx. Recomenda-se `MOO_DATA_DIR` fora do webroot, sob acesso
restrito. Nunca compartilhe logs com o código de instalação ativo.

Instalações já configuradas por variáveis `MOO_DATABASE_URL` e
`MOO_REDIS_URL` **continuam usando-as** sem abrir o assistente.
`MOO_PUBLIC_MODE=1` ainda exige uma interface Turnstile verdadeira no
cliente Lua, e HTTPS/WSS remoto permanece pendente; não abra o jogo
ao público antes da homologação.

## aaPanel (somente ambiente de testes)

1. Use **Node.js 22 ou superior** e prepare PostgreSQL e Redis acessíveis somente na VPS.\n   Há um `compose.yaml` opcional para iniciar ambos em endereços `127.0.0.1`.\n   Copie `.env.example` para `.env`, substitua **as duas senhas** e execute\n   `docker compose up -d` em `server-v2`. Isso inicia somente os bancos;\n   o processo Node.js continua no aaPanel.\n   Configure no ambiente do projeto `MOO_DATABASE_URL` e `MOO_REDIS_URL` com\n   as mesmas credenciais. Nenhuma credencial real deve ir para o GitHub.
2. No diretório `server-v2`, execute `npm install --omit=dev`.
3. No aaPanel → Node.js Project, configure a raiz `server-v2`, entrada
   `node bootstrap.js`, porta `8100`, host `127.0.0.1`. Configure HTTPS
   pelo proxy reverso, e, se necessário, `MOO_TRUST_PROXY=1` apenas quando
   o Nginx **sobrescreve** `X-Real-IP` e impede acesso público direto à porta.
4. Abra `/setup`, use o código impresso **somente nos logs** e crie a conta
   proprietária (senha longa). Admin em `/admin`.
5. O teste local do **cliente Lua atual** usa, em vez de 8100, o endereço
   fixo `127.0.0.1:8080`. Encerre o servidor antigo e inicie o V2 com
   `MOO_HOST=127.0.0.1 MOO_PORT=8080 npm start`. Instale via `/setup`
   nesse mesmo servidor. Execute o cliente diretamente pelo LÖVE, e **não**
   pelo antigo BAT que inicia o servidor antigo. Teste experimental.

O aplicativo Lua atual não possui configuração de endereço remoto/HTTPS para
apontar diretamente ao domínio aaPanel. Isto exige uma pequena configuração
de transporte ou inicialização futura **sem redesenhar o cliente**.

## Contas persistentes de jogadores (primeira fase)

- `POST /api/account/register` recebe `{username,password}`; exige nome
  alfanumérico ou underscore (3–20 caracteres), senha de 12–128 caracteres.
  O cadastro público vem **desativado por padrão**. O administrador pode
  habilitar `publicRegistration:true` via API autenticada
  `POST /api/admin/settings` com cookie e CSRF.
- `POST /api/account/login` valida a senha scrypt e retorna token de
  jogador válido por oito horas; Redis armazena apenas hash do token.
- `GET /api/account/me` e `POST /api/account/logout` usam o cabeçalho
  `Authorization: Bearer <token>`.
- `POST /api/join` continua funcionando para convidados. Somente quem envia
  Bearer autenticado obtém ticket de entrada vinculado à conta. Identificadores
  `did` fornecidos pelo cliente **não concedem acesso a contas**.
- Na entrada autenticada pelo WebSocket binário, PostgreSQL restaura
  recursos, nível, XP, armas desbloqueadas, inventário de construções,
  itens de loja e vida. Os dados são salvos periodicamente (30 segundos),
  na desconexão e no encerramento. A morte preserva cosméticos comprados,
  mas reinicia a progressão de sobrevivência.
- Construções de contas autenticadas passam a integrar o snapshot de
  progresso. Saem do mundo ao desconectar e retornam quando o dono entra,
  somente em áreas ainda livres e dentro dos limites de construção; não são
  fazendas ou defesas ativas enquanto a conta está offline. Se o local estiver
  ocupado no retorno, a construção conflitante é ignorada; essa limitação é
  intencional na primeira fase e pode requerer reposicionamento futuro.
- Clãs de contas registradas são persistidos no PostgreSQL com nome exclusivo,
  líder fixado à identidade autenticada e membros cadastrados. Desconectar o
  líder não transfere a propriedade; ele pode voltar e dissolver o clã.
  Solicitações de jogadores convidados a clãs registrados não podem gerar
  direitos persistentes. Clãs de convidados continuam limitados à sessão.
  O banco mantém a associação de membros; o mundo mantém online somente
  os participantes conectados.
- O cliente LÖVE iniciado com `INICIAR-V2-WINDOWS.bat` agora pode
  cadastrar e autenticar usuário/senha no PostgreSQL, usar ticket Bearer
  para o personagem persistente e revogar a sessão. A validação visual
  Windows e o transporte HTTPS/WSS remoto ainda estão pendentes.

## Protocolo do cliente Lua

A implementação V2 tem seu próprio módulo `src/native-protocol.js`: handshake
MessagePack `io-init`, pacotes autenticados HMAC, IDs embaralhados por sessão
no modo legado não fixado, ticket de uso único e eventos compatíveis de
mundo no WebSocket `/s/LC`.

- `GET /ping`: identifica a instalação V2.
- `POST /api/join`: tickets de curta duração limitados por origem.
- `WS /s/LC`: autenticação do ticket, spawn e eventos.
- `/play` JSON da antiga demonstração só fica disponível se
  `MOO_DEV_JSON=1` (não é o protocolo do cliente Lua).

Não há cópia do protocolo proprietário de autenticação do navegador nem
simulação de provas de integridade. Os pacotes estendidos ainda não estão
implementados. A entrada de convidados não substitui CAPTCHA ou contas
seguras para uma instalação pública.

## Contrato do login definitivo para cliente novo

O servidor expõe um login tradicional com nome de usuário e senha; **não é
necessário copiar as telas de login existentes**. PostgreSQL guarda contas,
hashes scrypt e progresso. Redis guarda hashes de credenciais efêmeras.
O cadastro público é desligado por padrão e deve ser habilitado no painel
(`publicRegistration`). Consulte
[docs/CLIENT-LOGIN-API.md](docs/CLIENT-LOGIN-API.md) para o contrato de rotas
e os fluxos recomendados de refresh/logout. O cliente ainda não armazena
refresh tokens de maneira durável; essa responsabilidade será da nova interface.
Nunca disponibilize login remoto sem HTTPS.

## Contas V2 e limite do modo convidado

O cliente LÖVE iniciado pelo `INICIAR-V2-WINDOWS.bat` agora utiliza
`/api/account/register`, `/api/account/login` e o token de acesso
`Authorization: Bearer` em `/api/join`. As credenciais nunca devem ser
enviadas na URL. A senha substitui o emulador anterior de seis dígitos.
O cadastro é desabilitado inicialmente; ative `publicRegistration` no
painel se desejar abrir inscrições.

`GET /api/capabilities` identifica o protocolo, políticas de ingresso e
recursos disponíveis. `GET /api/account/progress` exige Bearer e apresenta
somente o último snapshot gravado no PostgreSQL. Se o personagem estiver
conectado, o mundo ao vivo pode conter progresso mais recente.

**O ingresso de convidado sem desafio externo somente é aceito em
conexões HTTP de loopback direto**, sem cabeçalhos de proxy. Em instalações
públicas, configure corretamente `MOO_PUBLIC_MODE=1` e Turnstile, ou
utilize contas autenticadas. Nunca publique a porta Node diretamente.

## Backup e restauração verificáveis (aaPanel)

A operação do PostgreSQL V2 agora conta com ferramenta própria em
`scripts/db-backup.mjs`: cria dump privado em formato PGDMP,
manifesto SHA-256, verifica integridade e exige confirmação manual e
Node parado para uma restauração destrutiva. O script não coloca
a senha do PostgreSQL nos argumentos do processo.

- `npm run db:backup`
- `npm run db:verify -- /caminho/privado/arquivo.dump`
- `npm run db:restore -- /caminho/privado/arquivo.dump` — **somente**
  depois de confirmar o alvo, fazer backup da base atual e parar o Node.

Instruções de operação, variáveis `MOO_BACKUP_DIR`,
`MOO_CONFIRM_RESTORE` e `MOO_SERVER_STOPPED`, e riscos:
[docs/DB-BACKUP-RESTORE.md](docs/DB-BACKUP-RESTORE.md).

**Os testes automatizados verificam o contrato da ferramenta**, mas
restauração numa VPS real ainda exige ensaio em banco isolado. Redis,
o mundo em RAM e os arquivos privados fora do banco exigem suas
próprias medidas de backup/segurança.

## Administração e atualizações

O painel oferece, nesta fase: sessões HttpOnly, scrypt, CSRF, limites de
login, status, manutenção, configurações, lista de jogadores, expulsão,
banimentos por origem, trilha de auditoria, catálogo de atualizações próprio
assinado Ed25519, verificação SHA-256, ativação após reinício e rollback.

- `MOO_UPDATE_MANIFEST_URL=https://.../manifest.json`
- `MOO_UPDATE_PUBLIC_KEY_FILE=/caminho/fora/do-repositorio/public.pem`

**Nunca hospede a chave privada de assinatura no servidor de jogo.**
O manifesto de release pode ser preparado fora da VPS com
`node scripts/make-release.mjs`. Detalhes em `docs/RELEASE-PUBLISHING.md`.

Os testes de contrato e simulação (sem `ws`) usam:

```bash
node --test test/native-protocol.test.js test/survival-contract.test.js test/world.test.js
```

Após instalar as dependências execute `npm test`, incluindo o E2E HTTP/WS.
Critérios completos de conclusão e limitações estão em `docs/ROADMAP.md`.

## Propriedade intelectual

Servidor escrito independentemente não significa que o produto completo está
juridicamente liberado. O cliente que já existe possui materiais e decisões
de apresentação derivados da referência, sujeitos a conferência de direitos,
licenças e marcas. Distribua apenas código e ativos sobre os quais tenha
os direitos necessários. Uma revisão especializada deve preceder a publicação.

## Avanços da etapa seguinte (21/10/2026)

- Cura autoritativa por alimento: o servidor confere slot, recursos disponíveis,
  vida restante e cooldown; clientes recebem `N` (comida) e `O` (vida).
- XP e escolhas de equipamento nos estágios implementados: o Node emite
  `T`, `U` e `V` após validar cada operação `H`. Parte dos itens continua
  indisponível nesta versão.
- Construções próprias: paredes podem ser destruídas por inimigos; espinhos
  causam dano periodicamente, com proteção contra dano a membros da tribo;
  custo, limite por grupo e posição são avaliados no Node.
- Recursos esgotados reaparecem após 30 segundos se não houver jogador ou
  estrutura ocupando o local. O Node notifica os clientes com `Q`/`H`.
- Compra de acessórios/chapéus: os códigos de solicitação e confirmação da
  loja **não são iguais** (`c: 1=compra, 0=equipar`, `5: 0=desbloqueado,
  1=equipado`); o mapeamento invertido é intencional e foi testado.
- Uma suíte nova valida dano direcional, limites de tempo, recursos, cura,
  upgrades, construções, espinhos e retorno de recursos. O teste WebSocket
  end-to-end foi estendido para loja, cura e evolução.

**Permanece em desenvolvimento**, não é ainda apropriado para partidas públicas:
sem prova de conexão com o executável LÖVE em Windows e faltam partes do
catálogo de armas, projéteis, animais, biomecânica, administração e verificações
jurídicas do cliente e de seus recursos visuais.

## PostgreSQL e Redis (obrigatórios no servidor V2)

- **PostgreSQL:** armazena conta administrativa, hash scrypt, configurações,
  banimentos, anúncios e trilha de auditoria. Estrutura `mq_admin_state`,
  criada automaticamente na primeira inicialização. Gravação parametrizada
  e sequenciada; PostgreSQL é a origem autoritativa desses dados.
- **Redis:** armazena sessões administrativas com TTL de oito horas,
  proteção de login contra tentativas repetidas e tickets de conexão
  com TTL de 30 segundos. A leitura e o consumo de tickets são atômicos;
  não ficam salvos no banco relacional. Nenhuma senha em texto puro é
  gravada no Redis.
- **RAM do Node:** simulação do mundo, jogadores conectados, fauna e
  construções da partida. O progresso dos convidados **ainda não é
  persistido**; contas/personagens persistentes são trabalho futuro.
- **Disco privado `var/`:** chave local de banimento, versões do
  atualizador e backups externos. `config.json` não recebe novas gravações
  pelo servidor PostgreSQL.

**Migração sem perda:** se já existe `var/config.json`, faça backup do
arquivo e dos serviços; numa base PostgreSQL **vazia**, inicie uma única vez
com `MOO_IMPORT_JSON=1` para importar os dados existentes. Desative
essa variável após conferir a instalação. Se a tabela já contém dados,
a importação não os substitui. Nunca apague `config.json` antes de
validar o backup e a leitura do PostgreSQL.

O servidor falha na inicialização se PostgreSQL ou Redis estiverem
inacessíveis; não muda silenciosamente para JSON. Faça backup consistente
do volume PostgreSQL e proteja as credenciais por permissões do aaPanel.
Os dois bancos não devem ficar abertos à internet.

## Public guest ingress: verified challenges (opt-in, fail-closed)

**Never treat `captcha: true` as proof of a human user.** For a public
deployment set `MOO_PUBLIC_MODE=1`, `MOO_PUBLIC_HTTPS=1`,
`MOO_TURNSTILE_SECRET` (Cloudflare Turnstile server secret), and
`MOO_TURNSTILE_HOSTNAME` (exact registered hostname). Configure TLS and
a reverse proxy in aaPanel. If the proxy is local and overwrites
`X-Real-IP`, set `MOO_TRUST_PROXY=1`. The server refuses to start the
public HTTP interface if required settings are missing.

When public mode is active, guest `POST /api/join` requires
`{host,captcha:true,captchaToken:"<actual provider token>"}`.
The backend submits the challenge to Cloudflare Siteverify with the
connection's remote IP, checks success and exact hostname, and rejects
verification errors or timeouts. Turnstile tokens are issued by a widget
on the intended website and cannot be forged using `captcha:true`.
Registered players using a valid Bearer token do not need a guest
CAPTCHA. Debug JSON WebSocket `/play` is disabled in public mode.

**Current client limitation:** the Lua/LÖVE client has not yet integrated
the Turnstile widget or `captchaToken` transport. Public mode therefore
**disables old anonymous Lua entry** until a real verification workflow
is added to the client or a separately approved admission mechanism is
implemented. For private/local development `MOO_PUBLIC_MODE` remains
unset and the historical `captcha:true` contract is preserved.
This does not establish bot-proof gameplay or production readiness.

## Parallel ingress test

`npm test` includes a real native-protocol smoke test of **40
concurrent WebSocket clients**, unique join tickets and a full-server
rejection, using 40 artificial client IPs behind a simulated local proxy.
This is a functional concurrency regression test, not a production
benchmark or evidence of performance on your specific VPS.
