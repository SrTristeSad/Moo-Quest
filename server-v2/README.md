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

## aaPanel (somente ambiente de testes)

1. Use **Node.js 22 ou superior**.
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
