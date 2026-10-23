# Auditoria do cliente Lua — 23/10/2026

## Escopo
Inspeção estática da árvore do repositório, do fluxo de conexão Lua/V2 e dos módulos de WebSocket, MessagePack e inicialização. A execução do cliente gráfico Windows e a conexão real à conta do usuário **não** foram reproduzidas neste ambiente. Não confundir inspeção com teste de jogo aprovado.

## Correções aplicadas
- `src/net/websocket_client.lua`: limite de 1 MiB para a fila de frames de saída, para impedir crescimento ilimitado se a rede deixar de escoar dados; o envio agora retorna erro explícito ao atingir o limite.
- Limite de 16 KiB no cabeçalho de upgrade HTTP/WebSocket; conexões com resposta descontrolada do proxy são encerradas.
- Reset do erro de transporte ao iniciar nova conexão.
- Encerramento TCP sem close frame agora gera fechamento sem código (em vez de interpretar texto arbitrário como código WebSocket).
- `tests/websocket_client.lua`: regressão para fila de saída cheia.
- Correções já presentes no histórico recente: diagnóstico detalhado de fechamento 1008 e não envio preventivo do pacote opcional `Y` no handshake V2.

## Conclusões da auditoria
1. **Crítico — compatibilidade online**: o erro `1008 invalid_packet` relatado pelo usuário aponta para rejeição de pacote no servidor. A remoção do `Y` inicial pode resolver versões implantadas que não aceitam a extensão, mas ainda necessita teste de ponta a ponta. Não declarar a partida consertada sem confirmação.
2. **Alto — tratamento de conexão**: houve risco de memória crescer com fila WebSocket não limitada. Corrigido.
3. **Médio — escopo do cliente**: `main.lua` contém fluxos de teste, integração, conta, menu e jogo no mesmo arquivo (>1000 linhas). Separação em módulos deve ser gradual e protegida pelos testes UI E2E; fazer divisão extensa sem executar LÖVE tem alto risco de quebrar Play/login.
4. **Médio — compatibilidade legada**: existem módulos do servidor antigo, utilizados no modo sem `MOOQUEST_REQUIRE_V2`. Não são 'lixo' enquanto esse modo existir; removê-los exige migração explícita de configuração e testes.
5. **Médio — inicializadores**: diversos `.bat` coexistem para cenários distintos (legado, V2 local e V2 online). Consolidação deve preservar os fluxos, e não apagar indiscriminadamente.
6. **Arte**: assets e avisos sobre PNGs ausentes fazem parte das verificações de integridade; não devem ser eliminados para ocultar problemas.

## Verificação pendente
- `TESTAR-WINDOWS.bat` com LÖVE 2D 11.5 no Windows.
- Login e Play usando servidor público V2; conferir se retorna confirmação `C` e se começa a receber posições `D`.
- Exercitar reconexões e limite de buffer com interrupção da rede.
- Só depois de obter cobertura de testes: extração do fluxo UI E2E de `main.lua`, consolidação dos lançadores e remoção de dependências comprovadamente sem referências.
