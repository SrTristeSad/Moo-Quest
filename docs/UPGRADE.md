# WebSocket HTTP upgrade

O cliente usa `src/net/upgrade.lua` para construir o pedido `GET /s/LC`, gerar `Sec-WebSocket-Key`, verificar `HTTP 101` e validar `Sec-WebSocket-Accept`. O socket real fica em `src/net/websocket_client.lua`.

- `love.data.hash("sha1", data)` gera o digest binario do WebSocket.
- `src/net/secure_random.lua` fornece nonce de 16 bytes e mascara aleatoria por frame (Windows BCryptGenRandom).
- `tests/upgrade.lua`, `tests/websocket_frames.lua`, `tests/websocket_client.lua` e `tests/original_client.lua` sao testes isolados.

**HTTP 101 nao e entrada no jogo.** O servidor original tambem precisa aceitar build, bundle e ticket, alem de autenticar os pacotes subsequentes. Atualmente o cliente pode reconhecer `io-init` mas nao concluiu ingresso/spawn.
