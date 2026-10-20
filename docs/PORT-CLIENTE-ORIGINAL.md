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

**NAO CONCLUIDO: nao afirmar paridade 1:1 ate que a lista inteira seja
testada de ponta a ponta.**

## Direitos sobre as artes

O codigo do repositorio declara Apache-2.0, mas o proprio autor informa que
arte, nome e cliente oficial de MooMoo.io/FRVR sao de terceiros. O script
trabalha com uma copia local, sem adicionar os PNGs ao repositorio; distribuicao
publica comercial exige revisao dos direitos aplicaveis. As artes originais
novas do usuario nao serao misturadas com a referencia sem uma decisao dele.
