# Servidor Moo-Quest autoral — escopo CORRIGIDO

O **BrowserQuest-Revived** é somente referência para operação: instalação visual no
**aaPanel**, administração autenticada, logs, backups e atualizações produzidas
pelo nosso próprio projeto. **O jogo NÃO terá NPC, missões, campanha nem
editor/modificação administrativa de mapa.** A construção de estruturas pelos
jogadores durante a partida continua fazendo parte do escopo.

## Objetivo de aceitação (não alcançado ainda)

O cliente Lua/LÖVE já implementado deve funcionar com o servidor independente
sem perder seus efeitos visuais, controles ou telas. O servidor atual não copia
bibliotecas, classes, lógica de jogadores, scripts ou artes do MooMoo.io ou
BrowserQuest. Reimplementação de formatos necessários à interoperabilidade
não equivale a autorização de distribuir artes, marca, textos e visuais
protegidos; revisão jurídica independente ainda é necessária.

### Especificação de entrada que o cliente realmente exige

- `GET /ping`: retorna JSON com `build` alfanumérico;
- `POST /api/join`: emite ticket de 36 caracteres hex e `did` hexadecimal;
- WebSocket `/s/LC?b=...&token=tk:...`, resposta `io-init` em MessagePack;
- sessão HMAC-SHA256 autenticando pacotes binários e sequência monotônica;
- envio **pelo jogador** dos códigos `M,D,9,e,F,z,H,K,L,N,b,P,Q,c,6,S,0`;
- recepção inicial de `A,C,D,H,N,V,T,U`, depois `a` (posições/atributos),
  `I` (animais), `G` (placar), `O` (saúde), `K` (golpe), `P` (morte),
  `Q,R` (remoção de construções), `5` (equipamento), `3,4` (tribos) etc.
- Conforme `src/protocol/original_crypto.lua`, o modo **unpinned** do cliente
  reconhece somente 17 comandos e 36 eventos; para perfis, anúncios e os
  efeitos adicionais (`p,F,W,m,r,q`) é necessário um modo de transporte
  completo, independentemente implementado, ou mínima adaptação de transporte
  do cliente. Não basta habilitar um nome de pacote não reconhecido.

### Estado real do novo servidor

Implementado na fundação experimental:

- infraestrutura Node.js + aaPanel, login proprietário, painel de jogadores,
  moderação, auditoria e atualização **Ed25519** com rollback;
- binário de interoperabilidade independente em `src/native-protocol.js`,
  sem depender do antigo `server/src/protocol`;
- `/ping`, `/api/join` com ticket de uso único, `/s/LC`, pacote `io-init`,
  validação HMAC/antirreplay, entrada M -> C/D e atualizações de posição;
- mundo de coordenadas contínuas 14.400, recursos de coleta e seu reaparecimento,
  fauna básica (animais sem diálogo/NPC), estruturas com custo e dano,
  espinhos, combate direcional, cura por alimento, progressão e upgrades parciais,
  vida/morte, compras limitadas e tribos básicas — decisões do servidor;
- armas de longo alcance 9/12/13/15 com requisitos de evolução e munição,
  projéteis `X`/`Y` animados pelo Lua e colisão varrida no Node contra
  jogadores, animais, obstáculos e construções; proteção da própria tribo;
- botão `F` mantido aciona disparos/coleta somente após o intervalo autorizado
  pelo servidor e o envio de `F(0)` interrompe o ataque;
- escudo de madeira (arma 11) desbloqueado aos seis níveis: defesa frontal
  calculada pelo Node contra golpes e projéteis, sem falsificar golpes de martelo;
- torre defensiva construída (item 17, índice Lua 33): custo de recursos,
  limite por jogador, identificação de hostis, proteção de aliados, cadência
  de 2200 ms, balas reais de tipo 1 e eventos `M`/`X`/`Y` para Lua;
  sem NPCs, editor, comandos gráficos ou detecção de alvos no cliente;
- novas construções e melhorias da progressão por idade no Node: armadilha
  (15, idade 4), impulsionador (16, idade 4), plataforma de cura
  (19, idade 7), bloqueador contra construções de rivais (21, idade 7)
  e moinho avançado (12, idade 8, exige moinho 11);
- a armadilha imobiliza rivais temporariamente (com recarga), a plataforma
  cura apenas o proprietário e os aliados, o impulsionador altera a velocidade
  do movimento validado pelo Node e bloqueadores não impedem sua própria tribo;
- geradores de ouro calculados pelo tempo transcorrido e não pela quantidade
  de ticks da VPS, mantendo frações e limitando acúmulo depois de travamentos;
- contagem de estruturas no pacote Lua `S` agora é por grupo de construção
  (paredes, moinhos etc.), e não por ID individual;
- testes unitários de codecs, entrada, inventário, compras, construção,
  recursos, retorno após coleta, cura, XP e escolhas de equipamentos. O teste
  WebSocket de ponta a ponta inclui loja, cura e upgrades, além da entrada.
  A confirmação visual na versão Windows ainda está pendente.

**Não comprovado:** conexão efetiva com o aplicativo LÖVE em Windows;
compatibilidade integral de todos os comandos, cosméticos, equipamentos,
animações, colisão e câmera. O antigo pacote de artes do cliente ainda
precisa de auditoria/recriação licenciada antes de lançamento comercial.

### Pendências obrigatórias (não declarar concluído antes delas)

1. Rodar o teste **WebSocket real** com dependência `ws` instalada, mais o
   cliente Lua/LÖVE no Windows, provando `M -> C/D -> movimento -> coleta`.
2. Implementar os recursos, animais existentes, obstáculos, objetos e biomas
   requeridos pelo cliente, sem introduzir NPCs ou editores de mapa.
3. Completar os equipamentos e efeitos restantes: já há arco, escudo, torres,
   armadilha, impulso, cura, bloqueio de construções e moinhos básicos, mas ainda
   faltam minas/árvores plantadas, teletransporte, reaparecimento em construção,
   demais variantes, itens e efeitos, com testes de colisão.
   Não assumir paridade só porque os pacotes `X`/`Y` passaram na CI.
4. Morte/renascimento, clãs, loja, chat, placar, perfil e moderação no Node,
   usando confirmações autoritativas; testes para manipulação de pacotes,
   replay, fraude de posição e execução simultânea de 40 jogadores.
5. Completar os pacotes estendidos de aviso e efeitos; cobertura 100% do
   contrato consumido pelo `World:apply` do Lua.
6. aaPanel: backup/restore verificado, atualização assinada e rollback real,
   contas persistentes, auditoria de permissões e proteção da API de ingresso.
7. Testar Linux/Windows lado a lado, paridade funcional/visual e carga.
8. Revisão jurídica de marcas, artes do cliente, nomes, arquivos, licenças,
   pacote distribuído e limites da engenharia de interoperabilidade.

**O painel e o atualizador não tornam o jogo completo por si mesmos.**
Nenhum código do servidor antigo deve entrar no pacote comercial V2.
