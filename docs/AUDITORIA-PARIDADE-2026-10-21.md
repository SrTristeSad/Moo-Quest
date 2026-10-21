# Auditoria de paridade do Moo-Quest — 21/10/2026

> **Estado verificado:** `main` em `14d7ef75b7dbc807747736a468de36c9382ca4cc` (PR #9 integrado), mais correções de controle nesta revisão. A auditoria de 20/10 e a matriz anterior de `docs/PARIDADE.md` são **instantâneos históricos**, não retratam toda a implementação atual.

## Veredito: ainda não é 1:1

O cliente já usa Lua/LÖVE 2D e um servidor Node.js real, com transporte autenticado, spawn, entidades e HUD. Entretanto, não há demonstração de paridade de **todas** as interfaces, mecânicas visíveis e eventos do servidor com a referência fixada em `al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7`.

**Não modificar o motor Node para simular respostas. Não substituir os PNGs originais por imagens genéricas. Não remover os efeitos já portados** (ataque, recuo, alertas do Crab King, dano/cura, camadas e transparências).

### Evidências que existem, e o que NÃO provam

- Sete workflows de GitHub Actions passaram no PR #9, incluindo testes Lua, smoke gráfico LÖVE (Linux/Xvfb), importação e desenho de 180 sprites, teste de partida Node no Windows, preparação no Windows e spawn autenticado Node.
- Os testes de importação desenham **180 imagens**, ícones de **16 armas** e **23 itens** no ambiente de CI. Isso não comprova ausência de arte fora do quadro ou erros de proporção durante a partida.
- Existe teste ponta a ponta automatizado que clica Play, recebe C/D e desenha HUD com LÖVE; **não é uma auditoria visual interativa no Windows com todas as funcionalidades**.
- Não há evidência nesta auditoria de uma partida manual comparada quadro a quadro com o cliente de referência. Portanto, **nenhum sistema recebe o rótulo de paridade visual 1:1 verificada**.

## Lacuna de protocolo: inventário completo do servidor

Comparação reproduzível entre `P.s2cList` em `src/protocol/constants.lua`, `World:apply` em `src/game/world_state.lua`, `src/net/original_client.lua` e `main.lua`:

| Verificação | Resultado |
| --- | --- |
| Tipos de pacote S2C conhecidos no protocolo | **42** |
| Tipos tratados diretamente em `World:apply` | **34** |
| Tipos sem um ramo próprio no `World:apply` | `B`, `Z`, `0`, `F`, `p`, `q`, `r`, `m` |
| Desses, tratados especificamente por outros componentes | `B` (desconexão), `q` (integridade/telemetria) |
| Eventos sem tratamento funcional explícito em `World:apply`/cliente principal | **`Z` shutdown, `0` pong, `F` estatísticas, `p` perfil, `r` aviso de atualização, `m` mergulho de jogador** |

A ausência não implica perda de todos os dados da sessão; significa que os recursos associados ainda precisam de teste ou implementação no cliente Lua. O pacote `m` é particularmente relevante: o Node transmite estado de mergulho por SID, mas a mudança após `D` não atualiza a representação do jogador.

## Matriz de subsistemas (código, evidência e pendências)

| Área | Presente no cliente | Lacuna para paridade 1:1 |
| --- | --- | --- |
| Preparação Windows/Node | Scripts BAT e workflows `windows-*.yml` | Instalação limpa, interação e partida manual em Windows |
| Ticket, sessão e spawn | `original_join`, `original_session`, `original_client`; E2E | Reconexão/erros sob condições reais variadas |
| Mapa | Mundo, neve, deserto, rio, grade e câmera | Renderização completa do **desfiladeiro e piscinas secretas**, escala e comparação visual |
| Controles | WASD, mouse, mira, teclado e pacotes `9/D/F/z` | Bloqueio de direção visual (corrigido nesta revisão); teste completo de ações |
| Coleta/dano | Mensagens `N/K/L/O/8` e sprites reais | Testar coleta e dano ponta a ponta com todas as armas e bônus |
| Armas e projéteis | 16 armas, variantes, `X/Y`, ataques | Fiel tamanho, posição, recarga e colisões percebidas em cada classe |
| Inventário e construção | 23 itens, 14 grupos, seleção, contador e camadas | Construções, limites e manipulação sob todos os estados de nível |
| IA/animais | 15 arquétipos, `I/J`, sprite e animação | Comportamento visual e visibilidade para cada tipo em jogo real |
| Crab King | Avisos `W`, mergulho pelo `I`, quatro indicadores | Comparação de arte, estágios, escala/posição e recompensa em partida |
| Loja | Chapéus, acessórios, paginação, `c/5` | Validar compra, equipar, posse, reset e layout em resoluções diferentes |
| Clãs/tribos | Criação, convite, lista e interação; clãs de contas separados | Fluxo simultâneo com diversos clientes, moderação e permissões |
| Chat | Envio/recebimento e balões | Parar ataque ao focar chat (corrigido nesta revisão) e antispam com testes |
| HUD | Recursos, minimapa, leaderboard, vida, níveis, item info | Paridade de CSS/fonte/tamanhos e cenários de inventário grande |
| Morte/respawn | Sobreposição, retorno ao menu, novo `M/C/D` | Verificação visual e operacional no Windows |
| Contas, perfis, social | Autenticação e parte de clãs por API | `p/F` perfis/estatísticas in-game e integrações não implementadas |
| Efeitos diversos | Animação de arma, recuo de torre, `8` dano/cura, `W` chefe | Efeitos do cliente oficial que não tenham correspondência ainda |
| Atualizações e avisos | Estados de conexão e erro | `Z/r` não tratados no UI Lua |
| Servidor online | Node local de referência | Não está liberado/homologado para hospedagem pública |

### Defeitos concretos corrigidos juntamente com este relatório

1. **Mira travada desenhada incorretamente:** `main.lua` enviava direção fixa com `K(0)`, mas `View.draw` fazia o personagem continuar seguindo o cursor. A mesma regra `View.localAim` passa a alimentar desenho e pacote de mira.
2. **Ataque persistente durante chat:** abrir chat com Enter parava movimentação, mas não enviava `F(0)`. Agora limpa os estados de mouse/Space e envia `F(0, null)` para o Node, da mesma forma que as janelas modais.

### Ordem de correções prioritárias

- **P0:** validar os controles corrigidos (mira travada e chat), depois fechamento correto de entradas quando perde foco/abre overlay. Critério: disparos cessam no Node e avatar não gira quando a direção está travada.
- **P1:** tratar estados `m` de mergulho de jogador, `p/F` de perfil/estatísticas e `Z/r` de avisos; testar com eventos reais do servidor.
- **P1:** renderizar a geografia secreta do mundo e reconciliar arte/ordem das camadas dos monstros, projéteis e estruturas.
- **P1:** E2E com dois clientes para loja, tribo/clã, morte, respawn, combate e chat.
- **P2:** checklist visual comparativo para tamanhos de tela comuns (1280×720, 1920×1080, Android futuro), HUD, menus, fontes, loja e os 180 sprites.
- **P2:** revisão de licenças: código aberto e artes do cliente de referência não são automaticamente redistribuíveis no jogo comercial.

## Progresso subsequente — eventos `m/r/Z/0` (PR #11)

O cliente Lua agora interpreta o `m` real do servidor para alterar a
**transparência do próprio jogador** em quatro estados, sem alterar artes,
mecanismos de combate nem criar entidades. O estado inicial continua vindo
do pacote `D`. Um shader LÖVE aplica a mesma transparência à geometria e
aos PNGs do corpo/equipamento, preservando a renderização de jogadores normais.

Os pacotes `r` e `Z` agora originam avisos visíveis e contagens regressivas
na partida, tela de morte e menu; `Z(-1)` cancela o aviso de reinício.
O pacote `0` é contado como resposta ao ping do servidor, sem inventar
uma medida de latência. Há testes em Lua e amostragem dos pixels LÖVE.

Com isso, dos **seis pacotes** anteriormente marcados sem tratamento,
**quatro passam a ter tratamento explícito** (`m/r/Z/0`). Permanecem
`F` (estatísticas) e `p` (perfil) a integrar na interface.
Esta etapa não equivale a paridade 1:1 do jogo inteiro.

## Critério objetivo para chamar 1:1

Todos os fluxos do escopo original aplicável têm controle correspondente, visual correspondente, evento Node validado, teste automatizado específico e evidência de execução manual lado a lado. **Um PR com 7 workflows verdes não é equivalente a paridade 1:1.**
