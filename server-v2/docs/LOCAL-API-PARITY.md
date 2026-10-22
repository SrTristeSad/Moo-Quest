# Compatibilidade da API local antiga com o servidor V2

Referência funcional: cliente Lua pré-V2, commit 5ad8c32, e seus módulos
`main.lua`, `src/game/reference_panels.lua`, `world_state.lua`.
A versão atual do Windows continua sendo **o cliente antigo, com adaptadores V2**.
Este documento não autoriza substituir o cliente, suas artes ou sua câmera.

## Comandos do cliente antigo para o servidor V2

| Entrada binária | Função / regra |
|---|---|
| M | Entrar/renascer no mundo após validação de ticket |
| 9, D, e | Movimentação, direção da mira e parada |
| F | Pressionar/soltar ataque, coleta e construção |
| K | E: ataque automático; X: travar/destravar direção |
| z | Seleção de arma ou item de construção |
| H | Evolução/desbloqueio de equipamento por idade |
| c | Loja: comprar/equipar chapéus e acessórios |
| L, b, P, N | Criar tribo, pedir ingresso, aceitar/rejeitar e sair |
| Q | Expulsar integrante da tribo; SQL para membros persistentes |
| 6 | Bate-papo |
| S | Ping do mapa para os demais jogadores |
| V | Selecionar/parar visualização do perfil de um jogador |
| 0 | Ping/pong de transporte |

Todos os comandos dessa tabela agora possuem despachante no V2. Os
comandos de loja, combate, evolução e associação permanecem validados
pelo servidor; pacotes do cliente **não controlam saúde, posição ou dano
de outras entidades**.

## Retorno do servidor V2 para o cliente

- A contém o catálogo público de 13 categorias de fauna com IDs e sprites
  conhecidos pelo renderizador Lua;
- I atualiza os 51 animais da configuração local de referência, incluindo
  biomas de neve e rio e posições fixas de chefes;
- H contém árvores, arbustos, minérios e estruturas autoritativas;
- p retorna identificação pública de perfil em JSON, **sem dados privados**;
- F retorna os dez campos de estatística da vida e pontuação, atualizados
  enquanto o perfil estiver aberto;
- 7 lista coordenadas de aliados na tribo no minimapa;
- 3, 4 e 2 sincronizam associação e pedidos da tribo;
- os pacotes tradicionais C,D,a,G,N,V,T,U,O,P,K,X,Y,S,Q,5,6 permanecem
  destinados ao renderer original.

## Limites ainda não equivalentes à API local pré-V2

- AI especial de chefes, animações de mergulho, zonas de impacto com pacote
  W e interação do Crab King com região secreta;
- balanceamento fino e colisões de todos os animais;
- efeitos especiais cosméticos e eventos de atualização de servidor;
- totais históricos da conta no cartão de perfil: o V2 mostra o nome e a
  situação de conta/convidado, mas não inventa kills/lives/bestScore
  anteriores. F cobre dados reais da vida corrente;
- PNGs pessoais continuam fora dos pacotes de GitHub. Importar do cliente
  antigo em `assets/custom/img`.

Essa lista é um **registro de lacunas**, não uma declaração de clone
100% completo. Toda evolução deverá incluir testes de rede binária
e comparação visual do cliente antigo em execução.
