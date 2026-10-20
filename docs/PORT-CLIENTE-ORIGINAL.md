# Porte do cliente JavaScript do MooMoo.io para Lua/LÖVE 2D

Referencia fixa: [al007ex/moomoo-clone@06f7c1c](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

## Especificacao de produto

Reproduzir o cliente do jogo **antes de** modificar artes, entidades ou regras.
O usuario define exclusivamente futuras modificacoes. Nenhuma vaca, boi,
arvore ou outra entidade sera trocada ou inventada agora.

O motor **Node.js** mantem autoritativamente os jogadores, colisao, coleta,
combate, IA, economia e construcoes. O cliente **Lua/LÖVE 2D** recebe esses
estados, desenha a mesma partida e envia controles equivalentes. Nao e um
jogo apenas "inspirado": estamos portando as rotinas do cliente de referencia.

## Mapeamento 1:1 de responsabilidades

| Arquivo JavaScript original | Equivalente Lua | Estado |
| --- | --- | --- |
| `client/src/index.js`: `renderCircle`, `renderStar`, `renderBlob`, `renderRect`, `renderLeaf` | `src/game/reference_primitives.lua` | Portadas; Beziers aproximadas geometricamente por segmentos; requer comparacao visual |
| `client/src/index.js`: `getResSprite` | `src/game/reference_objects.lua` | Portada geracao procedural de arvore/arbusto/pedra/minerio |
| `client/src/index.js`: `getItemSprite` | `src/game/reference_objects.lua` | Portadas as 23 formas de item, sem PNGs inventados |
| `client/src/index.js`: `renderAI` | `src/game/reference_view.lua` | Carrega as imagens originais e respeita rotacao e tamanho |
| `client/src/index.js`: `renderPlayer`, `renderSkin`, `renderTail`, `renderTool` | `src/game/reference_view.lua` | Estrutura basica portada, requer animacao e acabamento |
| `client/src/index.js`: `updateGame`, camadas e `renderWaterBodies` | `src/game/reference_view.lua` | Port inicial de terreno, rio, camadas e bordas |
| `client/src/index.js`: `updateGame` camX/camY | `src/camera.lua` | Formula de acompanhamento portada |
| `client/public/css/main.css`: HUD recursos, XP, mini-mapa, barra de itens, leaderboard | `src/game/reference_hud.lua` | Posicoes base portadas; fontes e detalhes ainda nao sao 1:1 |
| `client/public/img/{animals,weapons,hats,accessories,resources,icons}` | `assets/reference/img/` (local, ignorado no Git) | Copia local via `tools/sync-reference-art.mjs`; nao publicada |
| `server/src/moomoo/server.js`: pacotes `D/a/H/I/N/O/G/T/U/V/P/Q/R/X/Y/M/L/E` | `src/game/world_state.lua` | Parte dos pacotes portada; outros eventos aguardam porte |
| `server/src/network/connection.js`, `protocol/session.js` | `src/net/original_client.lua`, `src/protocol/` | Autenticacao/transporte em codigo, **sem validacao de ponta a ponta** |

### Sprite existente x desenho procedural

O repositorio de referencia inclui **180 imagens PNG nas seis categorias do
cliente**: 17 animais, 81 armas/variantes, 55 chapeus, 21 acessorios, quatro
icones de recurso e dois outros icones. Essas imagens nao devem ser redesenhadas.

Arvores, arbustos, pedras e construcoes tradicionais foram feitos no Canvas
original. Seu equivalente Lua deve **portar o algoritmo original** em vez de
inventar sprites, paletas ou elementos diferentes.

Caso futuramente se encontre um recurso ausente, identificar **nome, tamanho,
formato, variacoes e animacoes** e solicitar a arte ao usuario; nao preencher
com uma figura improvisada.

## Preparacao local de artes

1. Execute `PREPARAR-SERVIDOR.bat`: instala/reutiliza o Node e chama
   `tools/sync-reference-art.mjs`.
2. O script **le apenas** `node-runtime/client/public/img/` (ou
   `%MOOQUEST_SERVER_DIR%/client/public/img/`) e copia 180 PNGs para
   `assets/reference/img/`.
3. A pasta de destino e ignorada pelo Git. **Nao redistribuir esses PNGs**
   sem licenca/autorizaçao suficiente.
4. `reference_assets.lua` carrega os PNGs na instalacao local. Se faltar uma
   imagem, registra o caminho ausente; o programa nao desenha um animal falso.

## O que falta antes da paridade real

- Uma sessao Windows real que complete ticket -> io-init -> M -> C e sincronize
  entidades sem erros.
- Validar imagens, proporcoes, dimensoes e transformacoes lado a lado com o
  cliente JavaScript **na mesma resolucao e posicao**.
- Portar animacao de ataque/dano, morte, especiais de chefes e status completos.
- Reproduzir toda a interface, lojas, menus, ajustes, chat, times, upgrades,
  inventario interativo, itens de loja, mapas especiais e social.
- Verificar comportamento de rios, efeitos, sombreado, audio e renderizacao
  especial da versao oficial atual.
- Criar testes de regressao visual; screenshots com mesmos estados reais,
  nao mundos aleatorios para demonstracao.

## Etapa atual: controles e minimapa originais (sem trocar design)

- `src/game/reference_icons.lua`: miniaturas da barra e de upgrades agora seguem
  a orientacao e as proporcoes de `client/src/index.js`: ferramentas rotacionam
  225 graus com `iconPad` / `iPad`; itens usam `getItemSprite(asIcon=true)`
  com rotacao 0 graus. Sprites de mundo continuam usando 90 graus.
- `src/game/reference_hud.lua::hitTest`: clique em arma ou construcao envia o
  mesmo `z(index,isWeapon)` da referencia. As dimensoes de 66px, margens
  de 5px e margem inferior de 17px sao as do CSS original.
- Mouse e Espaco nao anulam o ataque um do outro quando um permanece
  pressionado. Tecla X mantem a orientacao atual, como `getAttackDir()`.
- `src/game/world_state.lua`: os pacotes `7` (coordenadas da equipe) e `9`
  (ping do mapa) agora alimentam o minimapa. O efeito de ping cresce com
  `0.05 * deltaMs` e desaparece na escala 40, conforme `MapPing` da referencia.
  O cliente guarda a posicao da ultima morte; tecla C define o marcador
  pessoal e clique no mapa envia ping ao Node, tal como o JS original.
- Testes adicionais: `tests/reference_hud.lua`, `tests/reference_render.lua`
  e `tests/world_state.lua`. Estes cobrem formatos de pacote, localizacao
  dos alvos clicaveis e geracao de sprites, **nao** demonstram uma partida
  completa nem garantem fidelidade grafica.

**NAO CONCLUIDO: nao afirmar paridade 1:1 ate que a lista inteira seja
testada de ponta a ponta.**

## Correcoes do renderizador de referencia — etapa seguinte

- Os rotulos de jogadores e animais agora seguem `client/src/index.js`:
  nomes dos animais retirados de `shared/config.js::cowNames`, barras de vida
  abaixo de cada personagem na distancia `scale + nameY`, e equipe com
  a cor verde de HP original.
- A invisibilidade de rotulo/HP para o visual identificado pelo indice 10
  respeita a logica original: o proprio jogador e companheiros de equipe
  ainda enxergam seu nome.
- Os emblemas `crown.png` e `skull.png` sao carregados da pasta original
  `client/public/img/icons/`, com as mesmas dimensoes de `shared/config.js`.
- Os nomes personalizados usam fonte de fallback, **nao** a fonte WOFF2
  original, pois ainda nao existe uma conversao local licenciada e validada
  para o formato TTF aceito pelo LÖVE. Portanto, ainda nao existe igualdade
  grafica pixel a pixel.
- O pacote `C` recebido depois da morte remove a posicao antiga do jogador
  local e espera seu novo `D` enviado pelo servidor. Isso impede desenhar
  um renascimento em coordenadas obsoletas; o Node decide a nova posicao.
- Os testes `tests/reference_render.lua` e `tests/world_state.lua`
  agora verificam regras de visibilidade, nomes, posicao dos rotulos,
  nova posicao do jogador apos renascimento e preservacao do marcador de morte.
- A verificacao externa `VERIFICAR-PARTIDA-NODE.bat` continua sendo um teste
  do **servidor Node**, nao da execucao Lua. O cliente nao foi validado
  de ponta a ponta em uma instalacao Windows nesta etapa.

## Direitos sobre as artes

O codigo do repositorio declara Apache-2.0, mas o proprio autor informa que
arte, nome e cliente oficial de MooMoo.io/FRVR sao de terceiros. O script
trabalha com uma copia local, sem adicionar os PNGs ao repositorio; distribuicao
publica comercial exige revisao dos direitos aplicaveis. As artes originais
novas do usuario nao serao misturadas com a referencia sem uma decisao dele.
