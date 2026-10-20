# Transporte de rede — servidor ORIGINAL

O cliente LÖVE nao cria um servidor ou ponte customizada. O unico destino esperado e o servidor reconstruido original de `al007ex/moomoo-clone`, com:

- `GET http://127.0.0.1:8080/ping`: descobre o identificador de build.
- `ws://127.0.0.1:8080/s/LC?b=<build>`: conexao WebSocket diretamente ao servidor.
- `src/net/websocket_client.lua`: handshake HTTP WebSocket e framing RFC6455.
- `src/net/secure_random.lua`: aleatoriedade criptografica do sistema operacional.
- `src/protocol/bootstrap.lua`: interpreta primeiro `io-init` em MessagePack.
- `src/protocol/original_build.lua`: le dados do build da instalacao local original, sem editar esses arquivos.
- `src/protocol/original_crypto.lua` e `original_session.lua`: implementam misturador de chave, tabelas de ID, HMAC, mascaramento e sequencia do protocolo original.

**Importante:** a API original pode exigir token de entrada, `?u=` (bundle oficial), autenticacao, seal e telemetria. A conexao inicial ainda nao fornece todos esses requisitos; pacote de spawn e gameplay **nao sao enviados ate o ingresso ser implementado legitimamente**. Em caso de recusa, o cliente exibe o erro, e nao simula uma partida.

O codigo-fonte do Node.js original continua **intacto**. A ponte TCP 17017 e a simulacao paralela Lua foram removidas.
