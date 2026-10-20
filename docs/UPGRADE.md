# HTTP upgrade (WebSocket)

The native client now has pure Lua helpers for constructing and validating a WebSocket HTTP/1.1 upgrade:
- `src/net/upgrade.lua`: request, Base64, expected accept calculation, response validation.
- `tests/upgrade.lua`: known RFC 6455 sample and failure cases.

**Not a live connection yet.** A future transport adapter must supply a secure 16-byte random nonce, compute SHA-1 via a compatible library (LÖVE provides `love.data.hash("sha1", ...)`), connect using a socket, send the request, validate the response, and then exchange frames. The transport must avoid blocking the main LÖVE rendering thread.

This implementation targets a server running locally and does not disable origin, ticket, build, bundle or integrity rules.
