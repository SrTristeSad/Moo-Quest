# Mundo local — transcrição de regras (ainda não é uma partida)

Baseline: `al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7`

- `src/game/config.lua`: dimensões, zonas, recursos e plano de população animal, transcritos de `shared/config.js`.
- `src/server/world.lua`: geração dos objetos naturais com os mesmos laços, limites de tentativas e tipos de recurso de `Game.generateWorld()` em `server/src/moomoo/server.js`.
- `tests/world.lua`: valida limites, zonas, IDs e sobreposição.

O gerador é **estado do servidor**, não é um mapa gráfico fictício do cliente. Pode receber uma fonte de números aleatórios injetada para testar deterministicamente. A implementação segue o algoritmo e faixas do original, mas o Lua RNG padrão não garante a mesma sequência de `Math.random()` de JavaScript; equivalência de distribuição é o objetivo, não identidade bit a bit entre sementes.

**Ainda não feito:** servidor de rede em Lua, tick, integração do mundo em partidas, validação de jogador contra mundo, animais em movimento, eventos de coleta, renderização, persistência, áudio e testes integrados. As coordenadas de recursos atualmente geradas não são entregues ao cliente.

**Observação:** a referência pode gerar menos árvores/arbustos do que a contagem teórica em zonas proibidas; os testes verificam limites e distribuição, não contagem exata em todas as tentativas.
