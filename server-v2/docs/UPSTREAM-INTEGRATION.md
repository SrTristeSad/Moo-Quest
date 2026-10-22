## Imported reference gameplay and social behavior

This patch additionally vendors the original upstream chat filtering function
(without modifications) under Apache-2.0 and integrates it into the V2 game's
existing native Lua protocol. No other proprietary art, website scripts,
browser attestation or FRVR bundles are imported.

## Port real dos serviços sociais
- `src/social.js` é uma adaptação da lógica de `server/src/api/social.js`,
  `server/src/api/chat.js` e `server/src/api/store.js` do al007ex, sob
  licença Apache-2.0. Substitui Express/arquivos JSON por HTTP V2 + PostgreSQL,
  e tokens da referência por Bearer V2 em Redis.
- Lista/solicita/aceita/cancela amizades, mensagens privadas entre
  amigos/membros do clã, histórico privado/de clã e convites persistidos.
- `GET /api/social/online` mostra presença real da partida atual.
- `/api/social/friends/:id`, `/requests`, `/outgoing-requests`,
  `/api/chat/whisper`, `/api/chat/clan`, `/api/chat/history`,
  `/api/invite`, `/api/invite/inbox` usam todas as mesmas contas V2.
- TODO: WebSocket social para presença push, SSE de páginas e UI do cliente;
  os endpoints REST/persistência não substituem esses recursos.

## Presença/convites em tempo real
- Adaptado do `SocialHub` original para WebSocket `/api/social/ws?t=...`.
- `POST /api/social/ws-ticket` exige Bearer e concede ticket aleatório,
  de uso único e validade de 30s no Redis. Não há token de conta na URL.
- `ON_CONNECT`, `FRIEND_STATUS_UPDATED` e `RECEIVE_GAME_INVITE` 
  são entregues apenas a contas autenticadas e amigos confirmados. Os
  convites também permanecem no banco para a consulta offline.
- Ao efetuar logout da conta, a sessão social conectada é encerrada.
- A interface social do cliente Lua ainda exige implementação própria e
  o proxy público deve permitir WebSocket nessa rota.

## Directly reused reference GameObject and ConnectionLimit
`src/world.js` now calls the original `GameObject.getScale()` on
V2 resource collision shapes. `src/social-realtime.js` uses the original
`ConnectionLimit` to cap WebSocket connections at four per authenticated
account, not per proxy IP. Both vendor modules are unchanged, licensed
under Apache-2.0, with original source URL in `UPSTREAM-CODE.md`.

## Creature data from upstream AI source (22 October 2026)

The runtime loads the original upstream `AiManager.AI_TYPES` array. Animal
health, damage, rewards, size, hostility, respawn behavior, boss flags, view
range and AI movement coefficients are taken from those definitions directly.
The V2 maintains existing spawn counts, biomes and its independent AI
state machine; the imported `AI` class is not yet the active movement driver.
This avoids reimplementing or duplicating all original balance constants,
but it is **not** a claim of complete upstream AI compatibility.

Upstream source comments describe portions of AI code/data as derived from
an official client bundle. The repository's Apache-2.0 LICENSE alone does
not establish rights over third-party material. Review that provenance
before commercial redistribution or treating this as legally cleared.

## Projectile movement reuse (22 October 2026)

`src/world.js` now creates real `Projectile` instances from the original
upstream module. The original `init()` and `update(deltaMs)` determine
projectile position, speed, and remaining range. The V2 still resolves
swept collisions, team protection, damage, rewards and Lua events in its
own server-owned code. The first-tick `skipMov` flag is disabled to retain
the already tested V2 protocol timing. This is **directly reused runtime
code**, not a second unconnected copy of the algorithm.

## Revogação de tickets sociais via Redis

O ticket temporário do WebSocket social registra o número de revisão da
conta em `mq:v2:ticket-revision:<id>`. Os mesmos eventos que invalidam
tickets de entrada no jogo (logout, refresh e mudança de senha) impedem o
uso tardio de um ticket social previamente emitido. A verificação ocorre
depois do `GETDEL` atômico; tickets não podem ser reutilizados.

## ObjectManager original integrado ao runtime (22 de outubro de 2026)

O método original `ObjectManager.checkItemLocation()` é executado
para verificar a colisão de construções com objetos naturais e ao restaurar
construções persistidas. `GameObject.getScale()` aplica 60% do raio
visual para árvores e arbustos e o raio completo para rochas/minério.
O adaptador V2 é `src/reference-object-placement.js`. Os IDs, compras,
clãs, colisões de jogadores, faixa do rio e autenticação continuam no V2.
As outras rotinas de `ObjectManager` não foram ligadas ainda.

## Pit Trap escondida para inimigos (22/10/2026)

O runtime agora invoca diretamente `GameObject.visibleToPlayer()` do
al007ex. Uma Pit Trap recém-construída não é incluída no pacote `H`
de rivais (inclusive jogadores conectados posteriormente), mas continua
visível ao proprietário e a colegas de clã. Ao entrar/sair de uma
equipe, o servidor sincroniza o objeto com `H`/`Q`. Ao acionar
a armadilha, `World` envia `structure_revealed` uma única vez, e
o servidor redistribui `H`. O estado revelado da armadilha também
participa do snapshot de estruturas para contas PostgreSQL.
Não há novos códigos de pacote ou alteração do cliente Lua.

## Retrocompatibilidade JSON e efeitos de dano

O snapshot do cliente JSON legado e o fluxo de eventos agora são
individualizados por usuário para não revelar a localização de
armadilhas ocultas. Os efeitos `structure_hit` nos pacotes Lua
também respeitam `GameObject.visibleToPlayer()`. Administradores
continuam tendo acesso ao estado completo do mundo para depuração.

## Colisão sólida por ObjectManager original (22/10/2026)

`reference-solid-collision.js` chama de verdade
`ObjectManager.checkCollision()` e `GameObject.getScale()` da fonte
Apache-2.0 do al007ex durante o movimento do jogador. Árvores e
arbustos têm raio 0,6 da copa, pedras e minérios raio integral e
estruturas sólidas respeitam seu `colDiv` (ex.: sapling). Ao colidir,
a posição retorna à circunferência e as velocidades são amortecidas
em 25%, como no original. Agora também são sólidos: espinhos,
moinhos, minas, saplings e torres. Pit Trap, boost, watchtower,
healing, spawn, blocker e teleporter continuam atravessáveis,
com seus efeitos V2 independentes.

A ponte executa só a parte física do método original: dano, veneno,
teleporte, clãs e autenticação permanecem autoritativos na V2.
A colisão física entre jogadores ainda usa as regras existentes da
V2 e será tratada à parte; não há promessa de paridade integral.
## Colisão dinâmica entre jogadores (22/10/2026)

`reference-player-collision.js` executa a função original
`ObjectManager.checkCollision()` para cada par de jogadores vivos.
A separação da referência é simétrica: os dois corpos se afastam
até que seus raios somados deixem de se sobrepor. Isto substitui
o bloqueio unilateral antigo da V2 e preserva o cliente Lua.

Os novos deslocamentos são verificados contra os limites do mapa,
região secreta e obstáculos sólidos; se um jogador está encostado
em uma parede, o outro assume a correção, quando possível. O ataque
e o knockback continuam calculados separadamente pelo servidor,
e jogadores mortos não exercem colisão. O controle de sessões,
contas PostgreSQL e Redis não foi alterado.

## Colisão de fauna com objetos reais

A movimentação dos animais aplica até quatro subpassos de física,
executando `ObjectManager.checkCollision()` original sobre árvores,
pedras e construções sólidas. O tamanho de cada animal vem de
`AI_TYPES[index].scale`, diferentemente dos 35 pixels do jogador.
Pit Trap e demais itens `ignoreCollision` permanecem atravessáveis.

A IA de decisão, os biomas e os ataques continuam calculados pela V2.
Isso corrige animais atravessando obstáculos; **não significa que a
classe `AI` inteira já substituiu a máquina de estados da V2**.

