# Reconstrução do servidor Moo-Quest usando práticas do BrowserQuest-Revived

Estado: **primeira etapa de infraestrutura**. O cliente Lua/LÖVE está
congelado; este plano altera apenas Node.js e os testes do servidor.

## Dois jogos, dois protocolos

- **BrowserQuest-Revived**: Node.js, grid/tile, movimentos discretos, protocolo
  WebSocket JSON, painel administrativo, editor visual, salvamento e controle
  de ciclo de vida.
- **Moo-Quest**: Node.js ES modules, movimento por coordenadas contínuas,
  colisão circular, recursos e construção, atualizações frequentes do mundo,
  MessagePack autenticado, números de pacote derivados do build e
  cliente LÖVE 2D já conectado.

**Não** trocar `server/src/network/packets.js`,
`server/src/protocol/session.js`, `shared/config` ou a simulação do MooMoo
pelos módulos de `server/js` do BrowserQuest: isso quebraria jogadores,
animações, construções e o cliente existente.

## Etapa 1 — reinício seguro, persistência e monitoramento

Inspirado pelo fluxo de `BrowserQuest-Revived/server/lifecycle/graceful-shutdown.js`.
Implementação nova, independente, em
`server/src/lifecycle/serverLifecycle.js`:

1. Na chegada de SIGINT/SIGTERM, marcar imediatamente o servidor como
   indisponível para **novos** WebSockets.
2. Enviar o pacote original `Z(3)` e respeitar os três segundos anunciados.
3. Parar os ticks das partidas antes de começar a desconectar jogadores.
4. Enviar `B` pelo fluxo existente `Game.closeAll()`; deixar o frame
   sair antes de forçar fechamento de conexões restantes.
5. Encerrar WebSockets e aguardar `Game.removePlayer/recordLife` para
   contabilizar os pontos, conquistas e tempo da última partida.
6. **Depois da desconexão**, gravar todas as alterações de contas, clãs,
   preferências e estatísticas em arquivo temporário + rename na mesma pasta.
   Encerrar HTTP. Em falha de disco, saída com erro, não um sucesso falso.
7. Pedidos de encerramento repetidos compartilham a mesma operação.
   Existe limite externo de 10 segundos caso recursos travem.

`GET /health` → HTTP 200 enquanto o processo puder responder;
`GET /ready` → HTTP 200 ativo; HTTP 503 quando uma reinicialização começa.
Essas rotas não expõem contas, chaves, tokens ou dados administrativos.
`GET /ping` mantém o JSON anterior durante a operação normal.

Testes: ordem real de `Z`, encerramento de simulação, `B`,
flush, desconexões, resposta a sinais repetidos, falha de disco e
persistência imediata de contas/clãs, mais verificação HTTP real no CI.

## Próximos módulos a portar (sem mudar o protocolo)

| Origem em BrowserQuest-Revived | Adaptar para Moo-Quest |
| --- | --- |
| `server/admin/` | Console/painel autenticado; não copiar endpoints sem autenticação |
| `server/persistence/` e `server/storage/` | Interfaces de persistência separadas, migrações e backups |
| `server/js/combat-guard.js` | Testes de autoridade do Node em alcance e cooldown, usando raios reais |
| `server/js/movement-guard.js` | Validação por velocidade e colisão contínuas, não tiles |
| `server/js/regen-policy.js` | Política explícita **compatível com os itens e bônus originais** |
| `server/admin/world-store.js` | Editor de mundo e configuração próprios para árvores, pedras e estruturas |
| `server/setup/` | Preparação inicial por interface, compatível com VPS/aaPanel |
| `.github/workflows/` | Testes de reinício real, desconexões, dados persistidos e partidas |

**Critério de qualidade:** cada módulo deve ter testes do protocolo atual,
testes de segurança e um cenário com Node real. Não declare equivalência
1:1 apenas porque o CI está verde.

Referências e licenças: a arquitetura do BrowserQuest-Revived inspira o
desenho, mas o código não foi copiado mecanicamente; cada projeto mantém
suas dependências e seus avisos de licença.
