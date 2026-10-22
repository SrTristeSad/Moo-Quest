# Fase 2 — Física e comportamento dos animais (V2)

Referência técnica: `al007ex/moomoo-clone`, commit
`06f7c1ca965a7628671676c8d9a7efd3997bb5e7`.

Implementado sem importar arquivos JS do servidor de terceiros:
- `playerSpeed=0.0016`: aceleração acumulada em `motionX/motionY` sob entradas normalizadas (`input` / `direction`); o cliente não transmite velocidades.
- `playerDecel=0.993`: amortecimento `pow(0.993,dt_ms)` após cada passo.
- `waterCurrent=0.0011`: aceleração para direita no rio central em vez de translação constante.
- Flipper Hat (ID 31): aplica 40% da correnteza e conserva 75% da aceleração de movimento na água; jogador comum conserva 33%.
- Winter Cap (ID 15): evita penalidade de 25% de aceleração no bioma norte (`y<=2400`). O comportamento anterior de associar essa regra a acessórios incorretos foi retirado.
- Integração em até quatro subpassos, com resolução por eixo para recursos, paredes e corpos de jogadores. Impede travessia instantânea de obstáculos e mantém deslizamento.
- Animais passam a ter `waitLeft`, `moveLeft`, `chargeTargetId`, `runFromId`, `targetDir` e momento acumulado. Bois/lobos escolhem alvo após espera, executam investidas com velocidade progressiva e giram respeitando o `turnSpeed` da espécie; animais pacíficos não adquirem alvos e podem fugir após receber golpes.
- A velocidade básica e taxa de giro de cada espécie vêm dos parâmetros correspondentes em `aiTypes`, convertidos para as unidades da simulação V2.

## Invariantes

O servidor mantém autoridade sobre posicionamento, vida, dano e bloqueios.
São preservados: autenticação V2, contas PostgreSQL, Redis, aaPanel, o
WebSocket binário e cliente Lua da fase anterior. Nenhum asset é alterado.

## Lacunas para próximas etapas

Ainda falta equivalência integral em ataques que acertam simultaneamente
múltiplos alvos, knockback com massas/pesos, colisões avançadas dos animais,
movimento nas piscinas secretas, manobras do Crab King e seus efeitos `W`.
A IA foi portabilizada por regras observáveis; o código da referência não
foi adicionado ao V2.

**Não considerar os testes unitários como garantia de paridade completa.**
Executar também smoke da conexão Lua-WSS e teste visual real no Windows
antes de qualquer publicação comercial.
