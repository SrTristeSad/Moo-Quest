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

## Progresso subsequente — perfis e estatísticas reais `V → p/F` (PR #12)

- O cliente envia `V(sid)` somente após a escolha de um jogador ou ao
  abrir o próprio perfil pela tecla **P**. O Node retorna o JSON `p` e
  as estatísticas numéricas `F`. Clicar no placar usa os SIDs do pacote
  autoritativo `G`, sem criar jogadores inexistentes.
- `world_state.lua` interpreta a estrutura de `p` com o decodificador
  JSON seguro existente e `F` com os 13 campos reais do Node. Somente
  dados recebidos do servidor aparecem na janela. Perfis anônimos e
  convidados respeitam a filtragem aplicada pelo Node. IDs internos de
  convidados destinados à moderação não são exibidos.
- Ao fechar, o cliente envia `V(-1)` para encerrar o acompanhamento
  no servidor. A janela tem prioridade de entrada para evitar ataques
  ao clicar e preserva loja, clãs, chat e efeitos de combate.
- Os testes verificam a estrutura das respostas, validações, privacidade,
  a seleção de SIDs do placar e pixels do painel no LÖVE.
- Esta etapa fecha as lacunas `p` e `F` do inventário de pacotes, **mas
  não é prova de paridade total** das interfaces, do mapa, da economia
  ou da jogabilidade no Windows.

## Progresso subsequente — geometria da região secreta a oeste (PR #13)

**Defeito comprovado:** o Node executa `secretDistance` e permite entrar
pelo desfiladeiro (a partir de `x = -1500`), por cinco piscinas e pelo
corredor da cachoeira a oeste. O `View.ground` original só reproduzia a
planície/rios dentro do quadrado `x >= 0` e a função `boundaries`
escurecia indistintamente toda a área secreta.

- `reference_secret_map.lua` usa **os mesmos parâmetros** da configuração
  do Node (`gorgeX0=-1500`, `gorgeHalf=520`, cinco círculos, `waterfall`).
  O cálculo da união geométrica é portado de
  `server/src/moomoo/modules/effects.js::secretDistance`.
- A representação é feita **sem PNG novo ou textura genérica**: terreno
  verde, margem arenosa e água azul, exatamente com a paleta já existente no
  mapa. A água do desfiladeiro acompanha a oscilação do rio original.
- A região oeste fora da geometria continua escura; a região de jogo
  `x >= 0` não é redesenhada pelo módulo. Renderização de personagens,
  animais, recursos, Crab King, projéteis e indicadores visuais permanece
  sem alterações.
- Adicionados testes de limites geométricos, acesso do Crab King aos
  lagos, margens, cachoeira e amostragem de pixels num Canvas real do LÖVE.
- **Limite da afirmação 1:1:** o cliente JavaScript fixado no upstream
  **não possui um renderizador para a área secreta adicionada ao Node**.
  Esta implementação reproduz as coordenadas/regras reais desse Node, não
  uma suposta imagem oficial pixel a pixel dessa região.

## Progresso subsequente — pilha dos objetos e projéteis (PR #14)

A auditoria de `client/src/index.js` mostrou que os objetos são
acumulados em **baldes por layer na ordem do array `gameObjects`**
(`prepareObjectRenderLists`). O cliente Lua usava `pairs(world.objects)`,
que percorre o mapa hash sem uma ordem de desenho garantida e altera as
sobreposições de construções, paredes e recursos.

- `World:apply("H")` agora mantém a **posição de cada objeto** na
  lista do cliente; `Q` e `R` liberam seu slot. Novos objetos
  reutilizam o primeiro slot livre, como `objectManager.add` do JS.
- `View.draw` consome uma ordem de objetos determinística para as
  camadas `-1, 0, 1, 2, 3`, sem mudar as artes, transparências,
  rotação, recuo ou sobreposição dos efeitos W/8.
- Os seis índices de projéteis do catálogo real foram auditados:
  três flechas (`0/2/3`), dois projéteis circulares (`1/4`),
  e o projétil visual do mosquete (`5`). A resolução dos sprites
  vem apenas do catálogo de referência; o raio de visibilidade é o
  raio real, substituindo o culling genérico de 180 unidades.
- Testes verificam H/Q/R, reutilização de slots, ausência de
  ordenação arbitrária por SID, tipos e camadas de projéteis e
  desenhos em Canvas LÖVE, inclusive PNGs quando instalados.
- **Limitação:** isso corrige uma divergência demonstrável de
  renderização; ainda faltam avaliações manuais lado a lado de
  animação, colisão visível e efeitos na partida completa.

## Progresso subsequente — ordem de desenho de jogadores e animais (PR #15)

A referência JS usa duas listas persistentes `players[]` e `ais[]`:
`renderPlayers`, `renderAI` e os rótulos percorrem estas listas,
não um mapa hash. O cliente Lua já preservava os slots dos objetos do
cenário (PR #14), mas ainda fazia `pairs(world.players)` e
`pairs(world.animals)`. Em encontros com personagens/animais sobrepostos,
a ordem podia variar de forma diferente da referência.

- `world_state.lua`: acompanha a sequência dos **SIDs reais do Node**
  introduzidos por `D`, `a` e `I`, preservando-a após atualizações.
  Entidades temporariamente ocultas continuam com suas antigas posições
  e retornam nelas; `E` retira definitivamente o jogador desconectado,
  como `removePlayer` no original.
- `reference_view.lua`: renderiza corpos, acessórios, armas,
  animais, nomes e balões de chat nesta sequência, **sem modificar
  a ordem global das camadas** ou a orientação dos sprites.
- Novo teste de três jogadores (com cores originais) e três animais:
  verifica o ciclo `D/a/E/I`, ocultação, reentrada e
  a sequência das chamadas reais de desenho em Canvas LÖVE.
- Mantidos todos os efeitos existentes: mergulho, ataque, números de dano
  e cura, indicadores do chefe, projéteis, estruturas e mapa secreto.

**Limite:** a ordem agora segue a criação e visibilidade dos SIDs
vistos pelo cliente. Ainda falta auditoria manual da imagem final
de partidas simultâneas no Windows, antes de afirmar paridade 1:1.

## Progresso subsequente — acessórios/armas parcialmente fora da tela (PR #16)

**Defeito concreto:** o `renderPlayers` e `renderAI` de
`client/src/index.js` desenham cada entidade marcada como visível
pela rede, sem teste de posição do centro. O cliente LÖVE ainda aplicava
`see(p,camera,w,h)` para jogadores e rótulos, que só considerava a
escala do corpo (normalmente 35 unidades), e `see(...,kind.scale*2.4)`
para animais. Asas originais de grande escala, armas longas e nomes
podiam desaparecer enquanto parte da arte ainda estava na tela.

- `reference_view.lua`: elimina **somente esse corte prematuro de entidades**
  de rede nos passes de jogadores, animais e rótulos/balões. A GPU LÖVE
  recorta os pixels realmente fora da tela, como faz o Canvas original.
  Objetos de cenário e projéteis continuam usando o culling específico
  já auditado.
- `tests/reference_cosmetic_edges.lua`: comprova que o desenho de
  `Blood Wings` (acessório 18) é solicitado mesmo quando o centro do
  jogador está à direita da janela; com PNGs importados, compara pixels
  reais em uma margem visível. Também verifica camadas reais de
  `Sawblade` rotativo, martelo, mãos, corpo, Windmill Hat e topSprite,
  besta `aboveHand`, plataforma (`zIndex=1`) e invisibilidade.
- Nenhuma geometria, sprite, tinta, animação ou propriedade de combate
  foi modificada. **Os testes gráficos não substituem uma comparação
  manual integral do cliente original no Windows.**

## Progresso subsequente — interação real da loja e foco das janelas (PR #17)

- **Defeito de foco:** `main.lua` abria chat com `Enter` mesmo quando
  a loja ou a janela de tribo estava aberta. O chat ficava atrás da janela
  e recebia entrada de teclado indevidamente. O tratamento de teclas do
  painel agora acontece **antes** do atalho de chat; Esc e teclas de
  paginação continuam operando normalmente.
- **Tooltip que faltava:** o JavaScript do jogo usa `onmouseover` e
  `onmouseout` em todas as linhas da loja para apresentar a descrição
  do equipamento. Agora `reference_panels.lua::hover` acompanha o
  ponteiro, respeita somente as linhas inteiramente visíveis e limpa a
  descrição ao sair da linha, navegar ou trocar de aba.
- O clique de loja mantém o protocolo exato `c(action,id,isAccessory)`.
  **Não há simulação local de compras, saldo, desbloqueios ou equipe**;
  só o Node responde com `5` e `N`.
- Testes cobrem os dois catálogos reais (chapéus e acessórios), o espaço
  entre as linhas, a linha cortada, páginas, troca de abas, Enter e
  a ausência de mutações financeiras durante a interação de hover.
- A aparência e os efeitos de todos os equipamentos, HUD, chefe,
  combate, animações e mapas não foram alterados.

## Critério objetivo para chamar 1:1

Todos os fluxos do escopo original aplicável têm controle correspondente, visual correspondente, evento Node validado, teste automatizado específico e evidência de execução manual lado a lado. **Um PR com 7 workflows verdes não é equivalente a paridade 1:1.**
