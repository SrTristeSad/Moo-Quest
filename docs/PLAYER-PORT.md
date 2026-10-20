# Jogador — núcleo de movimento autoritativo (parcial)

Portado de `al007ex/moomoo-clone/server/src/moomoo/modules/player.js`, baseline `06f7c1ca965a7628671676c8d9a7efd3997bb5e7`.

`src/server/player.lua` modela o estado inicial, spawn no mundo, direção de movimento/mira, fórmula de aceleração e inércia, desaceleração, penalidade por neve e rio, correnteza, subdivisão de deslocamento, limites e região secreta e colisões geométricas simples com objetos naturais. `tests/player.lua` verifica estas propriedades.

**Status:** implementação parcial ainda **sem teste em partida real** e não integrada a conexão de rede/cliente LÖVE.

**Ainda falta para paridade do Player original:** colisão com outros jogadores/animais, otimização de grades e eventos de colisão especiais; velocidade por arma, chapéus e acessórios; empurrões, estruturas especiais, dano, saúde, combate, uso de itens, construção, XP/idades, times, spawn pads, buffs/debuffs, chat, notificações e reprodução completa do tick do servidor.

Esta implementação não significa que WASD já move o personagem na tela. Somente estados confirmados por execução ponta a ponta serão declarados funcionais.
