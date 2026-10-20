# Auditoria inicial de portabilidade

Fonte: https://github.com/al007ex/moomoo-clone (branch main, consultado em 2026-10-20).

## Diretórios confirmados
- `server/src/index.js`: inicialização do servidor
- `server/src/network/`: rede
- `server/src/protocol/`: protocolo
- `server/src/moomoo/`: lógica do jogo
- `server/src/anticheat/`: validação e antitrapaça
- `server/src/api/`: serviços
- `shared/config.js`, `shared/config/items.js`, `shared/config/store.js`: dados compartilhados
- `client/src/`: cliente não oficial, a ser auditado antes de qualquer reuso
- `client-official/`: **excluído** do port; contém material da FRVR

## Estado verificado
Este commit entrega a estrutura de um aplicativo LÖVE para Windows, entrada, câmera e contrato vazio de protocolo. **Não conecta ao servidor e não implementa gameplay.**

## Próximas tarefas
1. Ler `server/src/protocol` e `server/src/network` e mapear handshake, codificação e eventos.
2. Definir biblioteca Lua de rede compatível e testes com o servidor local.
3. Implementar fluxo de login/conexão e snapshots.
4. Só então renderizar o estado real do jogo e portar controles, animações e HUD.

Não copiar assets ou código do cliente oficial, mesmo para testes distribuídos.
