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
