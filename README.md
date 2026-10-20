# Moo-Quest

**Decisao do projeto:** o Moo-Quest tera **apenas o CLIENTE desenvolvido em Lua/LÖVE 2D**. A simulacao, as regras, os animais, o combate, a construcao, os itens, as contas e os demais sistemas continuam no **servidor original de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone)**, executado primeiro localmente e depois possivelmente online.

**Regra obrigatoria:** usar o motor Node.js original, sem criar outro servidor, ponte TCP ou protocolo alternativo. O preparador **apenas complementa um arquivo de configuracao que o autor nao publicou**, sem sobrescrever nenhum arquivo do upstream. Essa configuracao e apenas para desenvolvimento local.

Referencia congelada: [commit 06f7c1c](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

## Status real

- **Implementado em codigo:** cliente LÖVE, MessagePack, WebSocket RFC6455, consulta `GET /ping`, **POST /api/join (ticket guest valido emitido pelo proprio Node local)**, conexao direta com `?b=<build>&token=tk:<ticket>`, leitura do `io-init`, chave/tabelas autenticadas e envio do pacote original `M` (spawn). Eventos `C` e `a` sao processados para exibir ID e coordenadas autoritativas; WASD, mira e clique enviam comandos reais. **Esta integracao ainda nao foi validada de ponta a ponta no Windows.**
- **Nao implementado ou nao validado:** login de contas, selo do bundle oficial quando exigido (seal 2), probes/telemetria completos, menus sociais, cenas especiais e verificacao visual pixel a pixel. **Ja existem** porte de swings/ataques de jogadores e animais (pacotes K/J), chat Enter/6, inventario inicial, opcoes de evolucao por idade e renderizacao basica da interface, mas **ainda nao sao uma versao 1:1 comprovada**. A requisicao guest usa **o stand-in de captcha da propria API local**, apropriado somente para testes locais.
- **Porte grafico do codigo-fonte:** `reference_primitives.lua` e `reference_objects.lua` convertem as rotinas Canvas originais de arvores, arbustos, pedras e **23 itens**; `reference_assets.lua` carrega PNGs reais do cliente JS, copiados apenas na instalacao local; `reference_view.lua` segue camadas, personagem, equipamentos, animais e terrenos de referencia; `reference_hud.lua` segue as posicoes do CSS original. Os dados de entidades continuam vindo do Node por pacotes; a tela de mundo so aparece depois de `C` e posicao autentica. Ainda **sem prova de execucao completa no Windows**.

### Bloqueio encontrado na propria referencia

No commit original, `server/src/anticheat/config.js` **nao foi publicado** e o `.gitignore` contem `config.js`. **O instalador corrigido supre apenas esse arquivo ausente usando `support/local-anticheat-config.js`, sem substituir o motor Node nem sobrescrever arquivos existentes.** Os valores desta configuracao de compatibilidade sao nossos, nao os valores privados do autor, e **nao devem ser usados em um servidor publico**. Veja [docs/CONFIG-LOCAL.md](docs/CONFIG-LOCAL.md).

O cliente Lua pode tentar conectar com **qualquer instancia original ja funcionando em `127.0.0.1:8080`**, sem modifica-la. Caso o servidor aceite apenas o cliente web oficial, a tela mostrara o erro retornado; nao existe simulacao de sucesso.

## Windows

Necessarios LÖVE 2D 11.5 e Node.js 20+ (para executar o servidor).

1. Extraia [o ZIP atualizado](https://github.com/SrTristeSad/Moo-Quest/archive/refs/heads/main.zip).
2. Execute `PREPARAR-SERVIDOR.bat` atualizado **mesmo que voce ja tenha o Node**, pois ele tambem importa os sprites do cliente JS original para `assets/reference/img/` apenas no PC local. O servidor `node-runtime/` e reutilizado; os arquivos existentes do upstream nao sao sobrescritos.
3. Execute `INICIAR-WINDOWS.bat` para abrir cliente LÖVE e servidor Node (ou usar Node ja ativo em `127.0.0.1:8080`).
4. `TESTAR-WINDOWS.bat` executa os testes do cliente Lua; isso nao substitui teste de conexao e gameplay.
5. O cliente solicita ticket guest no Node antes de abrir a conexao, valida `io-init` e tenta spawn. O ID e a posicao aparecem somente se vierem nos pacotes originais `C` e `a`. Se o servidor responder 4001/4002/4003/4004, o motivo continua visivel.

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
