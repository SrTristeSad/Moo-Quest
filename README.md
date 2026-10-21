# Moo-Quest

**Arquitetura atual (2026-10-21):** cliente **Lua + LÖVE 2D** e
servidor **Node.js reconstruido, agora versionado neste proprio GitHub**
(`server/src/` e `shared/`). O jogo continua usando o protocolo real da
referencia de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone),
sem gateway TCP alternativo nem entidades inventadas no Lua.

**Economia normal:** `shared/config.js` passou a utilizar
`unlimitedResources:false` e `inSandbox:false`. O jogador inicia com
**zero recursos**, e madeira, comida, pedra e pontos sao controlados pelo
Node conforme coleta e custo real. Veja [SERVER-ORIGIN.md](SERVER-ORIGIN.md)
para as alteracoes e a licenca Apache 2.0 de origem.

**Artes (corrigido):** os seis arquivos da referencia que pareciam
"PNG corrompidos" sao na verdade **WebP validos armazenados com extensao
.png**, inclusive `weapons/hammer_1.png` e `sword_1.png`.
`tools/sync-reference-art.mjs` detecta a assinatura real e converte
**automaticamente** WebP para PNG, preservando exatamente os pixels e o
canal de transparencia originais (sem redesenhar nada). Caso falte a antiga
pasta `node-runtime/client/public/img`, ele baixa a **referencia congelada
diretamente do GitHub apenas para uso local** e recupera todos os 180
sprites. Nao precisa criar outro martelo: ele agora e recuperado pelo
preparador. `assets/custom/` continua prioritario para as artes que voce
quiser trocar futuramente. `ARTES-PENDENTES.txt` informa apenas falhas
**reais** de download/leitura/conversao, sem chamar imagens ausentes de
corrompidas. Os PNGs e o ZIP temporario nao sao publicados no repositorio.

Referencia do Node congelada: [commit 06f7c1c](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).
O servidor tem apenas configuracao de contas/anticheat **local de testes**;
nao hospedá-lo na internet sem resolver a seguranca.

## Loja e tribos durante a partida

O cliente Lua passou a oferecer os botoes **Shop** (loja) e **Tribe**
(tribo/alianca) durante a partida, nas posicoes da interface original.
As janelas seguem as abas da referencia, fecham com Escape, possuem
rolagem pelo mouse e recebem eventos verdadeiros do Node.

**Shop:** a lista `src/game/store_catalog.lua` contem exatamente os
49 chapeus e 21 acessorios de `shared/config/store.js`, incluindo
`dontSell`, precos e nomes. Os itens usam os PNGs originais
`hats/hat_<id>.png` e `accessories/access_<id>.png`. O servidor
decide se uma compra e valida, debita os pontos e confirma compra ou
equipamento pelo pacote `5`. O Lua nao entrega um equipamento por
conta propria. Os testes Node validam uma compra real de chapeu e
uma compra real de acessorio, seus custos e o resultado de equipar.

**Tribe:** cria nome de 1 a 7 caracteres ASCII, permite pedir para
entrar numa tribo, consultar membros, sair, dissolver a tribo
quando lider, expulsar membros e responder pedidos de entrada.
Os pacotes de envio originais `L`, `b`, `N`, `P`, `Q`
e os pacotes recebidos `A`, `g`, `1`, `2`, `3`, `4`
sao conectados ao cliente Lua. O servidor preserva suas regras de
nomes reservados, propriedade da tribo e espera de 200 ms entre
comandos. Teste integrado em LÖVE cria e deixa uma tribo diretamente
no Node, recebendo as confirmacoes.

**Clãs permanentes de conta (NOVO):** alem da Tribe, contas
registradas agora possuem a tela **Meu cla** no menu inicial e o
botao **Clan** na partida. A interface Lua chama diretamente a API
`/api/name` e `/api/clan/:action` do Node; permite registrar
nome permanente, criar cla, solicitar entrada, aceitar convites,
consultar membros, gerir solicitacoes, convidar, promover e expulsar
membros, transferir lideranca, sair e dissolver o cla com confirmacao
dupla. O Node valida permissoes e guarda os dados em
`server/data/accounts.json`. A nova tag do jogador aparece ao
**entrar novamente** na partida. O teste integrado LÖVE/Node criou
e dissolveu um cla usando a interface Lua; o teste Node valida tambem
convites, cargos e persistencia em disco.

Veja [docs/CLAS-PERMANENTES.md](docs/CLAS-PERMANENTES.md) para uso,
limites e seguranca.

## Tela de morte original e detalhes dos itens (21/10/2026)

O cliente agora reage ao **pacote original `P`** do Node com a mesma
sequencia de `killPlayer()` da referencia: encerra os controles da
partida, fecha Chat/Shop/Tribe/Clan, conserva o mapa ao fundo e
mostra **YOU DIED**, branco e centralizado, com fundo preto translucido
de 25%. A fonte cresce a 0,1px por milissegundo ate 120px. Depois de
**3 segundos** (`shared/config.js deathFadeout=3000`), o menu original
com **Play** reaparece; clicar Play ou pressionar R envia um novo `M`
ao **mesmo servidor Node autenticado**, sem inventar o renascimento.
A posicao da morte permanece marcada no minimapa, como no cliente JS.

Tambem foi portado `showItemInfo()`/`#itemInfoHolder`: ao passar
o mouse sobre armas e itens da barra inferior ou sobre opcoes de
evolucao, aparece o painel superior esquerdo original com **nome,
descricao, materiais/custos, tipo da arma e limite de construcoes**.
A quantidade construida vem do pacote real `S` do Node, e os dados dos
**23 itens e 16 armas** vem de `shared/config/items.js`.
O item nao aparece artificialmente caso o Node nao o tenha colocado
no inventario; a barra usa apenas os pacotes autoritativos `V`.
A folha de estilo do painel segue `client/public/css/main.css`
(30px titulo, 22px descricao).

Os testes `tests/reference_death.lua`,
`tests/reference_item_info.lua` e `tests/reference_render.lua`
validam essas mudancas nos runtimes Lua 5.1, Lua 5.4 e LÖVE 2D;
o LÖVE testa tambem a renderizacao efetiva das caixas de informacao
e da animacao de morte. Teste manual completo na versao Windows e
comparacao pixel a pixel com o navegador ainda sao pendentes.

## Status real

- **Implementado em codigo:** cliente LÖVE, MessagePack, WebSocket RFC6455, consulta `GET /ping`, **POST /api/join (ticket guest valido emitido pelo proprio Node local)**, conexao direta com `?b=<build>&token=tk:<ticket>`, leitura do `io-init`, chave/tabelas autenticadas e envio do pacote original `M` (spawn). Eventos `C` e `a` sao processados para exibir ID e coordenadas autoritativas; WASD, mira e clique enviam comandos reais. **O Windows foi validado para o servidor Node e o cliente Lua foi testado no runner Linux com LÖVE; a interface grafica completa ainda exige teste manual no Windows.**
- **Ainda nao implementado ou validado por completo:** fidelidade pixel a pixel do visual de clãs/conta, selo do bundle oficial quando exigido (seal 2), probes/telemetria completos, menus sociais, cenas especiais e verificacao visual pixel a pixel. **Ja existem** porte de swings/ataques de jogadores e animais (pacotes K/J), chat Enter/6, inventario inicial, opcoes de evolucao por idade e renderizacao basica da interface, mas **ainda nao sao uma versao 1:1 comprovada**. A requisicao guest usa **o stand-in de captcha da propria API local**, apropriado somente para testes locais.
- **Porte grafico do codigo-fonte:** `reference_primitives.lua` e `reference_objects.lua` convertem as rotinas Canvas originais de arvores, arbustos, pedras e **23 itens**; `reference_assets.lua` carrega PNGs reais do cliente JS, copiados apenas na instalacao local; `reference_view.lua` segue camadas, personagem, equipamentos, animais e terrenos de referencia; `reference_hud.lua` segue as posicoes do CSS original. Os dados de entidades continuam vindo do Node por pacotes; a tela de mundo so aparece depois de `C` e posicao autentica. Ainda **sem prova de execucao completa no Windows**.

### Bloqueio encontrado na propria referencia

No commit original, `server/src/anticheat/config.js` **nao foi publicado** e o `.gitignore` contem `config.js`. **O instalador corrigido supre apenas esse arquivo ausente usando `support/local-anticheat-config.js`, sem substituir o motor Node nem sobrescrever arquivos existentes.** Os valores desta configuracao de compatibilidade sao nossos, nao os valores privados do autor, e **nao devem ser usados em um servidor publico**. Veja [docs/CONFIG-LOCAL.md](docs/CONFIG-LOCAL.md).

O cliente Lua pode tentar conectar com **qualquer instancia original ja funcionando em `127.0.0.1:8080`**, sem modifica-la. Caso o servidor aceite apenas o cliente web oficial, a tela mostrara o erro retornado; nao existe simulacao de sucesso.

## Windows — como atualizar sem perder a instalacao anterior

Necessarios Node.js 20+ e LÖVE 2D 11.5.

1. Feche todas as janelas antigas do Node de versoes anteriores: elas
   ainda iniciavam com **1.000.000** e podem ocupar a porta 8080.
2. Extraia o ZIP atual do Moo-Quest na pasta do projeto. Preserve
   `node-runtime/` (imagens da referencia e dados locais anteriores) e
   `assets/custom/` (as suas artes).
3. Execute `PREPARAR-SERVIDOR.bat` para instalar dependencias do servidor
   agora versionado em `server/`. O script copia dados antigos para
   `server/data/` somente quando ainda nao existe um estado novo.
4. O preparador procura os sprites que voce ja tem; se a pasta antiga
   nao existir, baixa a referencia do GitHub e converte os seis WebPs
   que estao com nome .png. **Nao precisa fornecer um martelo novo.**
   O arquivo `ARTES-PENDENTES.txt` e um diagnostico para eventuais
   falhas reais de rede/arquivos.
5. Execute `INICIAR-WINDOWS.bat`. Ele identifica o servidor Moo-Quest
   pela rota `/mooquest/status` e recusa um Node antigo rodando em 8080.
   Ao iniciar o Lua, `Play` exige o handshake verdadeiro.
6. `TESTAR-WINDOWS.bat` roda os testes unitarios do cliente.

As artes nao sao incluidas no Git. Todas as **180 imagens originais**
sao recuperadas ou reutilizadas localmente, incluindo as 6 WebP
convertidas em PNG real automaticamente.

Leia [docs/EXECUTAR-LOCAL.md](docs/EXECUTAR-LOCAL.md), [docs/REGRA-PRINCIPAL.md](docs/REGRA-PRINCIPAL.md) e [docs/PARIDADE.md](docs/PARIDADE.md).

## Licenciamento

A referencia contem materiais de terceiros, incluindo arquivos atribuidos a FRVR. O script `tools/sync-reference-art.mjs` copia 180 PNGs existentes na referencia **somente para a instalacao local**, que esta em `.gitignore`. Nenhum desses PNGs e registrado no GitHub do Moo-Quest. **Distribuir/publicar essas artes exige autorizacao apropriada**; somente arte e codigo com direitos claros devem integrar a futura distribuicao.

## Proxima implementacao

Validar no Windows `/api/join -> io-init -> M -> C` e recepcao dos objetos/animais. Comparar visualmente o porte Lua com o JavaScript original, corrigir divergencias nas animacoes, HUD, menu e cenas especiais. Nenhuma nova arte, mecanica ou servidor substituto.

## Etapa de cliente grafico (em andamento)

- `src/game/world_state.lua` aplica snapshots **reais** dos pacotes do Node. Nenhum animal, objeto ou jogador e criado aleatoriamente pelo cliente.
- `src/game/reference_primitives.lua` porta as formas Canvas; `reference_objects.lua` porta 4 recursos e 23 itens; `reference_view.lua` usa os PNGs originais de animais/armas/chapéus/acessórios e a ordem de renderizacao de referencia. Nenhuma silhueta de animal inventada sera desenhada quando faltar um PNG.
- WASD, mouse, espaco, teclas numericas, Q (consumivel), E (auto coleta), X (travar direcao) e R (ping do mapa quando vivo) enviam comandos equivalentes a referencia.
- Para verificar apenas se o **servidor esta aceitando tickets**, inicie o Node e execute `VERIFICAR-CONEXAO.bat`. O teste faz `/ping` + `/api/join` + WebSocket e espera io-init real. Isto **nao testa o cliente Lua nem o spawn**.
- `INICIAR-WINDOWS.bat` agora aguarda o servidor responder `/ping` antes de iniciar LÖVE.
- `tests/world_state.lua` verifica os formatos publicados dos snapshots e foi registrado nos testes Lua. Executar teste unitario nao equivale a validar uma partida real no Windows.

**Status: cliente INCOMPLETO.** O porte das rotinas graficas e parcial e nao foi validado rodando no Windows. Faltam paridade de animacao, menus, configuracoes, social, fluxos de conta, detalhes do cliente oficial e comparacao visual pixel a pixel. Veja [docs/PORT-CLIENTE-ORIGINAL.md](docs/PORT-CLIENTE-ORIGINAL.md).

## Atualizacao do porte — cliente nativo

- O pacote local `support/local-anticheat-config.js` agora aceita cliente **Lua nativo em localhost** sem exigir o arquivo de bundle JavaScript ou o seu selo. A autenticacao WebSocket continua exigindo ticket verdadeiro, origem, build valido, sessao com chave HMAC e sequencia. A implementacao da logica de jogo do Node.js nao foi alterada. O preparador migra apenas a antiga configuracao do proprio Moo-Quest, se for uma correspondencia **exata**, e preserva configuracoes personalizadas. Leia [docs/CONFIG-LOCAL.md](docs/CONFIG-LOCAL.md).
- Corrigido travamento de atualizacao de objetos causado por `math.pow` (funcao inexistente no Lua/LuaJIT).
- `World:apply(C)` inicia os mesmos itens e armas que o `Player.spawn` original: martelo (ID 0) e itens 0, 3, 6, 10. Depois, pacotes `V` atualizam as escolhas, como no jogo JavaScript.
- `reference_animation.lua` reproduz os tempos de animacao de ataques ao receber `K` e `J`. O dano e calculado exclusivamente no Node.
- O chat recebe `6`, mostra baloes por tres segundos e envia mensagens de ate 30 caracteres via Enter.
- `reference_upgrades.lua` mostra as opcoes elegiveis no nivel atual, com o indice do pacote `H` do servidor e selecao clicavel.
- A verificacao de arte local agora exige **os 180 PNGs originais** previstos, distribuidos nas categorias ja publicadas. Se faltar algum, o instalador falha com uma mensagem especifica: nao existe substituicao improvisada.
- Os novos testes `tests/reference_animation.lua`, `tests/reference_upgrades.lua` e `tests/world_state.lua` verificam protocolos e estado sem simular um jogo completo. O GitHub Actions pode falhar antes de executar os jobs na plataforma; uma falha sem etapas executadas nao comprova problema no Lua nem sucesso. O teste real deve ser feito no LÖVE 2D no Windows.

**Meta continua a mesma:** cliente Lua reproduzindo o original, Node.js como servidor autoritativo e **nenhuma mudanca de design ou de jogabilidade sem pedido**.

## Porte de interacao / minimapa do cliente JavaScript

Nesta etapa, o cliente Lua passou a oferecer **clique nos itens e nas armas da barra original**, sem converter o clique em ataque. Mouse e Espaco gerenciam juntos a acao `F`, e a tecla X mantem a mira fixa ate ser acionada novamente. As miniaturas de armas usam a rotacao original de 225 graus, enquanto miniaturas de construcao usam o sprite do `getItemSprite(asIcon=true)` (sem a rotacao de 90 graus dos itens no mundo).

Os pacotes autoritativos `7` e `9` agora atualizam posicoes da equipe e pings de mapa: o minimapa 130x130 mostra circulos brancos na escala da referencia, a posicao da morte, e o efeito expansivo conforme o cliente JS. Clique no minimapa e R enviam ping, enquanto C marca a posicao atual. Nao sao entidades inventadas pelo Lua.

Teste local: `TESTAR-WINDOWS.bat` roda os testes do codigo Lua via LÖVE. O `INICIAR-WINDOWS.bat` abre a conexao real ao Node. **Nenhum sucesso de teste foi declarado sem execucao**. Menus completos e paridade grafica pixel a pixel continuam pendentes.

## Verificacao nova: spawn REAL do Node original

Com o Node **ja iniciado** em localhost, execute `VERIFICAR-PARTIDA-NODE.bat`.
Ele solicita um ticket local autentico em `/api/join`, recebe `io-init`,
carrega **o modulo de build gerado pelo proprio Node**, assina um pacote
`M` com a chave HMAC da sessao, envia a mensagem via WebSocket, e exige
um pacote autenticado `C` com o SID da partida. O jogador de teste sai
imediatamente depois.

Isso prova somente que o **servidor Node original aceitou uma entrada
autenticada naquela maquina**. Nao comprova que Lua entrou no jogo.
O `VERIFICAR-CONEXAO.bat` anterior so verifica `io-init`.
A principal verificacao do cliente nativo ainda e
`INICIAR-WINDOWS.bat` (confirma `C` e `D/a` do Lua) e
`TESTAR-WINDOWS.bat` (testes unitarios).

## Correcoes do porte de renderizacao desta etapa

- HUD: valores de recursos e placar sao sempre strings, inclusive antes
  de receber os pacotes `N` ou `G`. Corrige crash em `Font:getWidth(0)`
  logo apos o spawn.
- Ataque: o desenho do jogador usa `dir + dirPlus` gerado pelo pacote `K`
  do Node; projeteis continuam usando somente sua direcao propria.
- Camera: mesma escala da area Canvas virtual **1920x1080** do JavaScript,
  com `max(largura/1920, altura/1080)`, e snap instantaneo no novo spawn.
- Mundo: animacao de largura da agua pelo `waveSpeed` original; composicao
  azul-translucida aplicada antes dos rotulos e depois das entidades, como
  no renderizador JS. Grid alinhado a 60 unidades do mundo.
- Arvores e arbustos: se a triangulacao de uma forma concava falhar no LÖVE,
  o renderizador tenta preencher a mesma silhueta em triangulos para impedir
  um travamento. Nao cria nenhuma nova arte.
- Inventario: estado das quantidades pelo pacote `S` do Node.
- Novos testes: `tests/reference_camera.lua`, assercoes de primeiro
  spawn do HUD, da rotacao da arma, da agua e de quantidades de item.
- O cliente **nao esta concluido**: faltam menus, animacoes/efeitos
  completos, validacao do cliente Lua no Windows e comparacao visual fiel
  com a referencia.

## Sincronizacao do catalogo original de animais

O servidor Node original envia o pacote `A` antes do nascimento do personagem.
Esse pacote inclui `animals`: identificador, nome, arquivo de sprite, escala,
escala de desenho, vida e tipo de animal. O Lua agora armazena essa lista em
`src/game/world_state.lua` e consulta os valores **efetivamente enviados pelo
Node** ao renderizar os animais, seus nomes e suas barras de vida. Apenas quando
o servidor nao envia metadados de algum indice o cliente usa o catalogo Lua
transcrito da mesma referencia. Nenhum boi ou vaca extra foi criado.

A nova verificacao em `tests/world_state.lua` assegura que o pacote `A`
recebido do Node tem prioridade sobre o catalogo estatico. Isso nao altera
as regras, a IA nem o servidor.

## Teste local com retorno confiavel

O arquivo `TESTAR-WINDOWS.bat` agora executa a bateria de testes Lua
automaticamente, **encerra o LÖVE com erro se algum teste falhar** e copia
o relatorio `RELATORIO-TESTES-LUA.txt` ao lado do BAT. Esse relatorio
e gerado localmente, nao deve ser adicionado ao Git e permite identificar
o arquivo e a mensagem exata da falha. Um relatorio ausente indica que
o LÖVE nao chegou ate a gravacao de resultados (por exemplo, erro de
inicializacao) e o erro da janela/console deve ser consultado.

O teste cobre também a recepcao do pacote `A` com as configuracoes visuais
dos animais que o servidor original envia ao conectar. Isso evita depender
de dados visuais presumidos pelo Lua para nomes e dimensoes de animais.

**Status:** arquivos publicados no repositorio, mas ainda nao houve teste
de ponta a ponta executado nesta sessao no computador Windows. O teste
`VERIFICAR-PARTIDA-NODE.bat` valida Node separadamente, nao o Lua.

## Correcao da interface mostrada na captura de 20/10/2026

O cliente Lua **nao envia mais o nascimento automaticamente**. Ele inicia
a conexao autenticada ao Node e exibe a tela de entrada inspirada diretamente
em `client/public/html/play.html` e `client/public/css/main.css`:
abas `Game`, `Info`, `Settings`, campo de nome (ate 15 caracteres),
selecao das dez cores originais e botao **Play**. O clique ou Enter na
aba Game envia o pacote de nascimento `M` pela conexao real e aguarda
a confirmacao `C`. A interface ainda nao reproduz todos os cards,
abas e controles secundarios do navegador.

O fundo da tela inicial e construido pelas posicoes **exatamente da rotina
`prepareMenuBackground` da referencia JavaScript** e a camera fica no
centro do mapa (rio Y=7200). Estes objetos pertencem **somente ao menu**,
nao sao entidades inventadas para a partida. Ao jogar, o Node faz o
nascimento em coordenada real aleatoria; portanto o rio nao estara
necessariamente visivel perto de todo jogador, como na referencia.

`INICIAR-WINDOWS.bat` agora confirma **os 180 PNGs existentes** do
cliente original em `node-runtime/client/public/img` e os copia para
`assets/reference/img` antes de iniciar o LÖVE, evitando a barra de arma
vazia por falta de `hammer_1.png` ou outras imagens. Se uma arte
especifica continuar ausente ou invalida, o overlay mostra **seu nome
exato**, sem substitui-la por desenho novo.

Os recursos no HUD agora aparecem por extenso, como
`updateStatusDisplay()` do JavaScript; o cliente nao abrevia
`1000000` como `1.0m`. O servidor de referencia usa o modo
`unlimitedResources`, podendo iniciar a partida em `1000000`;
**essa e uma configuracao do Node e nao um erro dos contadores**.
O HUD tambem recebe `N: kills`, mostra aumentos positivos reais
de recursos depois da leitura inicial de cada total e mostra quantidades
de estruturas baseadas em `S` / `group.limit`, sem inventar coleta local.

Arquivos principais atualizados:
`src/game/reference_menu.lua`, `src/net/original_client.lua`,
`src/game/reference_hud.lua`, `src/game/world_state.lua`,
`src/game/reference_assets.lua` e `INICIAR-WINDOWS.bat`.

**Ainda nao foi validado executando no Windows nesta sessao:** use
`TESTAR-WINDOWS.bat` para verificar os testes e depois
`INICIAR-WINDOWS.bat` para conferir menu, Play, PNGs, rios, arma e
contadores numa partida. Envie o texto `RELATORIO-TESTES-LUA.txt`
se os testes indicarem falhas. O porte completo 1:1 segue em andamento.

## Atualizacao: Play, Entrar e Cadastrar testados contra o Node (21/10/2026)

A captura de tela do usuario mostrava a tela de entrada com `Connection: Ready`,
mas sem acesso a conta e sem uma forma comprovada de passar para a partida.

**Resolvido e validado por GitHub Actions:**
- A tela de entrada agora tem controles **Entrar**, **Cadastrar** e **Sair**
  (no painel direito), alem da entrada como convidado via Play.
- Ambos os botoes de conta usam os endpoints ja existentes do servidor
  reconstruido: `POST /api/auth/code` e `POST /api/auth/verify`.
  Depois da validacao, o cliente reabre a sessao Node com `auth` em
  `POST /api/join`; o WebSocket recebe um ticket vinculado a conta.
- Os controles e o Enter acionam o mesmo fluxo `Original:spawn()` do
  protocolo original. Mensagens de aguardando conexao/partida sao visiveis.
- O workflow `.github/workflows/node-spawn.yml` instala o Node original
  fixado, o LÖVE 11.5 e os PNGs apenas no runner temporario; em seguida
  verifica **seis jornadas reais**: autenticacao e spawn Node via JS,
  Lua convidado direto, Lua conta direta, Play via interface,
  Entrar->Play via interface e Cadastrar->Play via interface.
  Os testes exigem `M -> C -> D` verdadeiros e executam o
  `View.draw` e o HUD grafico, nao apenas mocks de rede.
- `.github/workflows/lua-tests.yml` e `love-smoke.yml` verificam
  os modulos (inclusive `tests/local_auth.lua` e os alvos clicaveis
  de `tests/reference_menu.lua`).

**Seguranca:** A API do upstream e um **simulador local**, nao um servico
real de autenticacao: `/auth/code` cria contas automaticamente a partir do
email e `/auth/verify` aceita QUALQUER codigo de seis digitos sem enviar
email. O cliente deixa isso explicito. **Nao use esse metodo em servidor
publico ou com dados pessoais reais**. Implementar cadastro e login
seguros para producao requer um backend de contas apropriado e autorizacao
para alterar essa parte do servidor. Tokens ficam apenas em memoria do
processo do cliente Lua.

**Escopo:** Os testes comprovam o percurso no Linux/headless com o servidor
local fixado; Windows ainda deve ser conferido no computador do usuario.
O cliente continua incompleto visualmente em relacao a todos os menus do
original. As artes terceirizadas so sao sincronizadas localmente,
nao incluídas em commits.

## Correcao do menu e build local (captura de 21/10/2026)

O erro da captura era `Connection: blocked` apos `io-init`, porque o
cliente nao encontrava `protocol-build.json` no endereco definido por
`MOOQUEST_BUILD_FILE`. **Nao era uma falha de login nem algo que o Play
pudesse contornar.** A instalacao de referencia gera parametros novos no
Node, e o cliente deve usar precisamente a versao da sessao ativa.

- `src/protocol/original_build.lua` procura nos caminhos explicitamente
  fornecidos (`MOOQUEST_BUILD_FILE`, `PROTOCOL_BUILD_FILE`, `DATA_DIR`,
  `MOOQUEST_SERVER_DIR`) e no diretorio da instalacao LÖVE/Node.
  Caminhos inexistentes nao impedem tentar as outras opcoes, mas builds
  diferentes do valor publicado por `/ping` **sao rejeitados**.
- `tools/resolve-local-build.mjs` verifica localmente o ID real de
  `/ping`, localiza somente o JSON correspondente e entrega seu caminho
  ao `INICIAR-WINDOWS.bat`. O iniciador para antes de abrir o LÖVE se
  houver outra copia do Node operando na porta 8080 e nenhum build local
  correspondente; **nao inventa chaves nem desativa autenticacao**.
- O menu mostra um status curto e uma dica objetiva no painel do servidor.
  A explicacao tecnica com caminho absoluto so aparece ao tocar
  `Detalhes`, numa area separada. `Entrar`, `Cadastrar`, email e
  codigo mantem seus proprios controles sem sobreposicao.
- `Play` fica cinza/indisponivel durante `blocked`, `failed` e
  `connecting`, e verde quando o WebSocket autenticado fica pronto.
  O clique e a tecla Enter compartilham a mesma regra, consultando o
  estado **atual da rede**, nao o da tela anterior.
- `tests/build_lookup.lua` simula build ausente, antigo e correto;
  `tests/reference_menu.lua` verifica os estados de Play, botao Detalhes
  e os alvos dos formularios.
- `.github/workflows/node-spawn.yml` testa o resolvedor no Node real
  antes da entrada Lua, inclusive com `MOOQUEST_BUILD_FILE` errado.
  `.github/workflows/windows-build.yml` verifica o caminho gerado pelo
  servidor original em um runner **Windows**, independente dos testes LÖVE
  em Linux.

**Como testar no seu PC:** Feche **as janelas antigas do servidor Node.js**
da copia anterior; depois execute o `INICIAR-WINDOWS.bat` atualizado.
Mantenha a pasta `node-runtime` que ja possui, para nao refazer o download.
Se o servidor for externo ou tiver `DATA_DIR` proprio, configure
`MOOQUEST_BUILD_FILE` com o arquivo JSON gerado por aquele mesmo Node.
Se o iniciador nao achar uma versao correspondente, ele mostra a falha
no console **antes** de iniciar o cliente, evitando horas na tela
`Connection: blocked`.

**Nao foi criada nenhuma mecanica de jogo nem arte nova.** As contas do
servidor reconstruido continuam apenas locais/de teste e nao constituem
autenticacao segura para producao. Paridade visual de todas as telas do
cliente original continua em desenvolvimento.
