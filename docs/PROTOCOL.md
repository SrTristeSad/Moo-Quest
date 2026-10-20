# Protocolo do servidor de referência

Fonte auditada: `al007ex/moomoo-clone`, `server/src/network/connection.js`, `server/src/protocol/session.js`, `server/src/protocol/constants.js` e `server/src/network/packetUtils.js`.

## Caminho da conexão
- WebSocket: `/s/<key>`, com servidor local `LC` ou `MB`.
- O servidor pode exigir origem compatível, parâmetros `b` (build), `u` (bundle) e `token=tk:...` (ticket de entrada).
- O servidor envia inicialmente um frame MessagePack sem máscara: `["io-init", [socketId, seed, keyHex, mode, pinned, sealMode]]`.
- Depois do handshake, os identificadores de pacotes são derivados de tabelas dependentes de seed/build.
- Cliente → servidor: HMAC-SHA256 truncado a seis bytes + corpo MessagePack mascarado, sequência estritamente crescente.
- Servidor → cliente: MessagePack mascarado, com contador de frames.
- O protocolo inclui validação de integridade vinculada ao bundle oficial. Não tentar falsificar ou contornar verificações: a integração de um cliente independente requer um modo de compatibilidade **explicitamente autorizado e implementado no servidor sob nosso controle**, mantendo proteção adequada.

## Inventário dos eventos
Os nomes e sentidos de 22 mensagens de entrada e 42 de saída estão em `src/protocol/constants.lua`. Isso é **documentação do contrato**, não implementação funcional.

## Implementado
- Estrutura de dados dos nomes dos pacotes.
- Validação dos campos de um handshake MessagePack **já decodificado**.
- Teste de unidade do formato de handshake (requer interpretador Lua).

## Não implementado
- WebSocket e MessagePack binário.
- Obtenção de ticket e parâmetros de build.
- Derivação de chaves, máscaras e tabelas.
- Envio/recebimento de frames autenticados.
- Sincronização de estado, spawn e renderização de entidades.

A compatibilidade deve ser validada com testes reais antes de qualquer alegação de cliente jogável.
