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
