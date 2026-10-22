# V2: paridade de combate, fase 3 (golpes múltiplos / knockback)

Referência: `al007ex/moomoo-clone`,
`server/src/moomoo/modules/player.js` (método `gather`),
commit `06f7c1ca965a7628671676c8d9a7efd3997bb5e7`.

Objetivo: portar **as regras**, não redistribuir cliente/arte proprietários,
sem substituir autenticação PostgreSQL/Redis, aaPanel ou Lua.

## Entregue
- Um único golpe passa a percorrer **todos os objetos elegíveis**,
  jogadores inimigos e animais vivos dentro do arco frontal, em vez de
  interromper no alvo mais próximo. Cada entidade é avaliada **uma vez**
  por golpe, preservando cooldown e limites calculados pelo servidor.
- Construções hostis sofrem dano independente; coleta de construções
  autorizadas e árvores/pedras/arbustos/ouro é simultânea se alcançável.
  Recursos naturais permanecem no mapa sem perder HP.
- Golpe aplica impulso `0.3 * weightM + weapon.knock` convertido para
  unidades/s, integrado às velocidades `motionX/motionY` da fase 2.
  A colisão continua resolvida pelo servidor e impede atravessamento.
- Jogadores do mesmo clã/equipe não sofrem dano do aliado, e entidades
  atrás do atacante não são atingidas.
- Thief (arma 14) transfere **somente pontos existentes** do alvo,
  nunca madeira, pedra ou comida, conforme regra da referência.
- Eventos de hit, animal_hit, gather, structure_hit, destroy, death e steal
  continuam usando os pacotes binários conhecidos do cliente Lua.

## Limites ainda existentes

Esta fase não conclui toda a reprodução do jogo original. Pendências:
- Efeitos por variante/poison/lifesteal/bleed em todos os equipamentos.
- Física corpo a corpo com empurrões entre animais e paredes, incluindo
  colisão entre criaturas, em todas as situações do original.
- Crab King: mergulho, ataques telegrafados e efeitos W.
- Possível diferença no ângulo exato de varredura e nos modificadores
  específicos por equipamento; comparar com a referência em testes de
  trajetória e replay.

Testes: `server-v2/test/reference-multihit-knockback.test.js` e
suíte geral V2; **não publicar como 'igual ao original'** sem validação
visual e comportamental em partida Windows.
