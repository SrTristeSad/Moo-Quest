# Moo-Quest V2 — Regras do servidor de referência

Base comparada: `al007ex/moomoo-clone`, commit
`06f7c1ca965a7628671676c8d9a7efd3997bb5e7`.

Objetivo: portar **comportamento**, preservando o cliente Lua pré-V2,
a API autenticada do Moo-Quest, PostgreSQL/Redis, painel aaPanel,
formato dos pacotes e sprites escolhidos pelo autor.

## Incorporado na fase 1 (PR #61)

| Regra | Referência | Implementação V2 |
|---|---|---|
| XP inicial | 300, depois +20% por idade | `LEVEL_XP` e teto de 100 idades |
| Armas 0–15 | dano, range, speed, spdMult | `WEAPONS` e cálculo do movimento |
| Minério de ouro | concede `gather+4` pontos, não pedra | `attack`: recurso `ore` |
| Árvore/pedra/arbusto | colhe seu próprio recurso; ouro extra depende do equipamento | `attack`: sem ouro genérico |
| XP de arma | aumenta ao colher, separado por arma | `weaponXp` por índice, salvo para registrados |
| Variantes | 0 / 3000 / 7000 / 12000 / 30000 de XP | 0–3 apresentados em `a`; variante 4 exige membresia ausente |
| Escudo de madeira | deixa passar 20% do dano frontal | `protectedDamage` multiplica por 0,2 |
| Carga da arma | espada/katana/bow reduzem movimento, adagas aumentam | `WEAPONS.move` |
| Construção selecionada | metade da velocidade de movimento | `buildIndex` |

## Regras já existentes antes da fase 1

- grade do mapa 7×7; árvores, arbustos, pedras e minério autoritativos
- rio, neve, cactos e área secreta (com aproximações de física)
- conta V2, autenticação/ticket e WebSocket binário
- inventário, tribos, loja, construção e dano projetil
- coleta de recursos naturais sem destruição
- nomes corretos de animais e seus biomas básicos

## Lacunas **ainda não equivalentes**

1. Física contínua: aceleração e amortecimento por `playerDecel=0.993`,
   empurrão e deslizamento em impactos (V2 ainda usa deslocamento simplificado).
2. Combate: o original verifica **todos** os alvos e recursos em alcance por
   golpe; V2 ainda prioriza um alvo por rotina.
3. IA: `ai.js` usa `waitCount`, `moveCount`, rotação gradual,
   `xVel/yVel`, investida, fuga e atordoamento. V2 ainda tem IA simplificada.
4. Crab King: dive/ataques especiais, `W`, animações e colisão.
5. Projéteis e efeitos: variantes venenosas, lifesteal, knockback, visibilidade.
6. Loja/construções: totais, vidas e alguns efeitos ainda precisam de
   verificação individual contra `shared/config/items.js`.
7. O projeto de referência usa recursos ilimitados por padrão no sandbox.
   **Não habilitar esse modo** sem decisão explícita do dono do Moo-Quest.
8. Revisão de autoria/licença para uso público: não importar sprites/marca
   de MooMoo.io/FRVR para uma distribuição comercial.

### Critério de aprovação

Não considerar paridade completa por simples aprovação de testes V2.
Exigir comparação de valores e trajetórias de entrada idêntica nas duas
implementações, testes de cliente Lua/binário e teste visual em Windows.
Não substituir o cliente pré-V2 nem reinicializar contas existentes.
