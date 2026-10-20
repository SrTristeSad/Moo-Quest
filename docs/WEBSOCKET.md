# WebSocket framing

`src/net/websocket_frames.lua` implements client-side RFC 6455 framing and an incremental decoder for unmasked server frames.

- Outgoing binary frames are masked using a **four-byte key provided by the caller**. A real socket adapter must obtain a fresh unpredictable key for every frame.
- Incoming binary, close, ping and pong frames are decoded.
- Fragmented frames, extensions, text and masked server frames are explicitly rejected rather than silently misread.
- Maximum incoming frame size is configurable (default 1 MiB).
- This is **not yet a WebSocket client**: HTTP upgrade, TLS, socket lifecycle, ping/pong replies, MessagePack session handling and reconnects are not integrated.

Next step: select and vendor a properly licensed LuaSocket/LuaSec-compatible transport for LÖVE; test the complete handshake with the adapted local server. Avoid using blocking network operations in `love.update`.
