# Matriz de paridade — Cliente Lua / servidor Node reconstruído

**Baseline:** [al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

**Nova regra:** o servidor Node.js **já contém** a simulação das mecânicas da referência. O trabalho do Moo-Quest agora se concentra na **conexão, renderização e controles do cliente Lua**. Não é necessário portar o Game/Player/AI do servidor para Lua. Os antigos módulos `src/server/` foram removidos da árvore atual; seu histórico permanece no GitHub. **O único servidor em uso é Node.js.**

Estados: `pendente`, `em desenvolvimento`, `implementado sem teste de ponta a ponta`, `verificado em Windows`. **Nenhum dos sistemas foi ainda verificado em Windows após esta mudança de arquitetura.**

| ID | Sistema de referência | Status da parte Lua | Critério para aprovar |
| --- | --- | --- | --- |
| P01 | Inicio Windows / motor Node original | correcao de instalacao criada, teste Windows pendente | Preparacao reutiliza download, adiciona config local ausente e confirma /ping do Node |
| P02 | Sessao, ticket, spawn e retorno | nao integrado | /api/join, ingresso legitimo, spawn C/D, morte e respawn |
| P03 | Transporte e eventos da partida | em desenvolvimento | WebSocket original, io-init, sessao assinada e pacotes decodificados |
| P04 | Mapa completo e câmera | em desenvolvimento | biomas, área secreta, zoom, culling e mundo completo |
| P05 | WASD, mira, seleção e ações | em desenvolvimento | comandos 9, D, F e z confirmados pelo servidor |
| P06 | Recursos, coleta e dano em objetos | em desenvolvimento | coleta real atualiza recursos, XP e status |
| P07 | 16 armas, variantes e projéteis | pendente | controles, desenho, ataques, recarga, efeitos e upgrades |
| P08 | 23 itens, 14 grupos e construções | em desenvolvimento | seleções, custos, limite, reparos e objetos sincronizados |
| P09 | 15 tipos de animais, IA e ataques | em desenvolvimento | todos aparecem e animam conforme pacotes I, J e outros |
| P10 | Chefes, Crab King, fases e eventos | pendente | mergulho, avisos, golpes, efeitos e recompensas |
| P11 | Neve, deserto, rio, piscinas secretas | em desenvolvimento | terreno/física são vistos corretamente sem inventar regras |
| P12 | Idade, XP, atualizações e economia | em desenvolvimento | interface, seleção e upgrade H/T/U/V corretos |
| P13 | 49 chapéus e 21 acessórios / loja | pendente | menus, compra, equipa, efeitos, identificação e sprites legais |
| P14 | HUD completo e configurações | pendente | escala, posição, saúde, inventário, ajustes e controles |
| P15 | Chat, tribos e clãs | pendente | enviar/receber pacotes, convites e moderadores |
| P16 | Contas locais, perfis e rankings | pendente | menus e chamadas API ao Node original |
| P17 | Amigos, convites, mensagens sociais | pendente | integração com APIs de contas e SSE ou equivalente nativo |
| P18 | LC/MB e multijogador | pendente | jogadores simultâneos, espectro LC/MB, membros autenticados |
| P19 | Segurança apropriada para nativo | em desenvolvimento | taxas, validação local; projeto de autenticação online separado |
| P20 | Administração, comandos e moderação | pendente | UI/controles correspondentes à referência e API local |
| P21 | Extras v1.9.1/v1.9.4 | pendente | cada elemento anunciado na referência validado |
| P22 | Pacote final Windows / regressão | em desenvolvimento | build, instalador, testes e revisão de paridade visual |

## Implementado no código atual

- `PREPARAR-SERVIDOR.bat` reutiliza o original baixado, supre somente `anticheat/config.js` quando ausente e executa o Node original num teste temporario em localhost. A politica de compatibilidade e documentada em `docs/CONFIG-LOCAL.md`, **nao representa os valores originais** e nao deve ser usada online.
- Ponte TCP anterior removida. O cliente nao cria uma rota alternativa no Node original.
- `src/net/original_client.lua`, `src/net/websocket_client.lua`, `src/net/secure_random.lua` implementam a sondagem HTTP e tentativa de conexao WebSocket diretamente ao servidor original em 8080.
- `src/protocol/original_crypto.lua`, `src/protocol/original_build.lua`, `src/protocol/original_session.lua` implementam as tabelas, chave e frames binarios do protocolo original (integracao e testes reais pendentes).
- `main.lua` mostra a etapa real da conexao, sem gerar mapa ou jogador simulado. Falta ingresso autenticado, spawn, receber/renderizar eventos de mundo e interface de jogo.
- `tests/original_client.lua` e `tests/original_session.lua` testam os modulos de WebSocket e criptografia independentemente; execucao ponta a ponta ainda nao realizada.

## Não confundir os resultados

- **Escrever um módulo ou teste não comprova sua execução.** Os testes no GitHub Actions continuam sem um resultado aprovado confiável no histórico consultado.
- A imagem anterior foi produzida com simulacao do servidor Lua que foi removida; nao comprova comunicacao com o servidor original.
- Os catálogos completos de `src/game/catalog.lua` e `src/game/animals.lua` são **dados de referência**. Sua presença não prova funcionamento de cada item, sprite, animação, ataque, economia ou efeito.
- O cliente ainda usa geometria provisória; a referência inclui visuais cujo uso está sujeito a direitos de terceiros.
- **Não afirmar 100% antes que todos os itens P01-P22 estejam verificados em Windows.**

## Próxima ordem de trabalho

1. Validar no Windows `PREPARAR-SERVIDOR.bat` depois do reparo local de `config.js`, com o servidor Node original passando `/ping`. Registrar logs se houver nova falha. Manter o uso estritamente localhost.
2. Completar interpretação dos demais pacotes e paridade da interface e visualização.
3. Equipamentos, loja, inventário, progressão, construções, combate e animais.
4. Social, conta, clã, eventos, ajustes e ferramentas especiais.
5. Regressão completa e, só numa fase posterior, transporte Node seguro para hospedagem online.
