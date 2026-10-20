# Transport adapter (experimental)

`src/net/websocket_client.lua` now implements a nonblocking **plain ws://** client for LuaSocket, including HTTP upgrade, frame processing, outgoing client masking, ping/pong and basic socket lifecycle.

Dependencies are injected:
- `socket`: LuaSocket-compatible TCP factory.
- `secureRandom(n)`: cryptographically secure bytes. **Do not use math.random** for WebSocket masking or upgrade nonces.
- `sha1(data)`: SHA-1 digest returning 20 raw bytes; LÖVE's `love.data.hash("sha1", data)` is a candidate.

This module is not automatically started from `main.lua` because the project has not yet bundled a Windows LuaSocket dependency or a verified secure random provider. Connecting it prematurely would crash or fail on machines without those components.

Remaining limitations: no wss/TLS, no fragmented frames, no extension negotiation, no connection timeout, no reconnect policy, and no game-level authenticated session. Test the module with a controlled local WebSocket echo server before integrating gameplay. The upstream game server will still enforce its own build, ticket, bundle and transport integrity checks.
