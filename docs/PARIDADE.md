# Matriz de paridade — Moo-Quest vs. moomoo-clone

**Baseline congelada:** [al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7)
**Regra mandatória:** [REGRA-PRINCIPAL.md](REGRA-PRINCIPAL.md).

Cada item abaixo representa **funcionalidade real presente na referência**, não promessa de implementação. Estado inicial padrão: **não iniciado**. Os módulos existentes de estrutura/codec não significam jogabilidade aprovada. Não considerar completos módulos sem testes ponta a ponta.

| ID | Sistema obrigatório | Referência primária | Estado no Moo-Quest | Critério de aceitação |
| --- | --- | --- | --- | --- |
| P01 | Inicialização Windows e servidor local Lua | `server/src/index.js`, `package.json` | não iniciado | Abrir ambos e jogar sem JavaScript/serviços externos |
| P02 | Conexão, sessão e entrada guest/conta | `server/src/network/`, `server/src/api/` | em desenvolvimento | Handshake, login local, spawn, disconnect e reconexão reais |
| P03 | Serialização, eventos e sincronização | `server/src/protocol/`, `server/src/network/packets.js` | em desenvolvimento | Todas as mensagens necessárias resultam nos mesmos estados |
| P04 | Mundo/terreno, zonas, câmera e biomas | `shared/config.js`, `server/src/moomoo/server.js` | em desenvolvimento (geração natural e geometria Lua, não integrada) | Geometria, rio, neve, deserto, câmera e limites conferidos |
| P05 | Jogador, spawn, controle, morte/respawn | `server/src/moomoo/modules/player.js` | não iniciado | WASD, apontar, ataque, colisão, morte/retorno corretos |
| P06 | Recursos, mineração e coleta | `shared/config.js`, `server/src/moomoo/modules/objectManager.js` | não iniciado | Árvores/arbustos/rochas/ouro, recursos reais e respawns equivalentes |
| P07 | Armas e variantes, projéteis e dano | `shared/config/items.js`, `server/src/moomoo/modules/projectileManager.js` | não iniciado | Todas as armas, tiros, alcance, dano e XP equivalentes |
| P08 | Itens, construções, torres e moinhos | `shared/config/items.js`, `server/src/moomoo/modules/objectManager.js` | não iniciado | Colocação, limites, custos, efeitos e destruição corretos |
| P09 | IA, animais e criaturas comuns | `server/src/moomoo/modules/ai*.js` | não iniciado | Movimentação, ataques, estados, dano e drops corretos |
| P10 | Chefes, Crab King e eventos especiais | `server/src/moomoo/modules/ai.js`, README | não iniciado | Bosses, fases, telegraphs, mergulho e mecânicas reconstruídas |
| P11 | Área secreta, piscina e cachoeira | `shared/config.js`, README | não iniciado | Geometria e física especial equivalente |
| P12 | Progressão, upgrades, idades e economia | `server/src/moomoo/modules/player.js`, `shared/config/items.js` | não iniciado | Progressão, seleção, custos, efeitos e recompensas corretos |
| P13 | Chapéus, acessórios, loja e edição | `shared/config/store.js`, README | não iniciado | Compra/equipamento, efeitos, variantes, aparência e preferências |
| P14 | HUD, menu, minimapa, placar, sons e ajustes | `client/src/`, README | não iniciado | Interações, informação e feedback comparáveis |
| P15 | Tribos, clãs e chat | `server/src/moomoo/modules/clanManager.js`, `server/src/api/chat.js` | não iniciado | Criar/convidar/chat/expulsar/abandonar e mensagens |
| P16 | Contas, perfis e rankings locais | `server/src/api/store.js`, `server/src/api/routes.js` | não iniciado | Identidade local, configuração, histórico e ranking |
| P17 | Amigos, convites, sussurros e notificações | `server/src/api/social.js`, `server/src/api/pageStream.js` | não iniciado | Fluxos sociais em rede local sem FRVR |
| P18 | Servidores LC e MB/multijogador local | `server/src/index.js`, README | não iniciado | LC guest e MB membro, sessões simultâneas e permissão |
| P19 | Segurança e moderação adequadas ao Lua | `server/src/anticheat/`, `server/src/network/` | não iniciado | Autoridade, entradas inválidas, rate limits, bans e reports |
| P20 | Administração, comandos, poderes e avisos | `server/src/admin/console.js`, README | não iniciado | Comandos aplicam efeitos reais, inclusive eventos de reinício |
| P21 | Recursos extras 1.9.1/1.9.4 | README seções 'New in' | não iniciado | Cada item anunciado nas duas versões possui caso de teste |
| P22 | Distribuição e regressão Windows | regra do projeto | não iniciado | Instalador/pacote testado, teste de partida e regressão |

## Evidência de implementação parcial (2026-10-20)

- Mundo/recursos: `src/game/config.lua`, `src/server/world.lua`, `src/game/geometry.lua` — traduções iniciais do algoritmo e geometrias da referência fixada.
- Codificador de protocolo: `src/protocol/msgpack.lua` inclui mapas e números fracionários; ainda sem transporte de jogo integrado.
- Testes escritos: `tests/world.lua`, `tests/geometry.lua` e `tests/msgpack_gameplay.lua`.
- `.github/workflows/lua-tests.yml` foi criado. As primeiras execuções do GitHub Actions falharam antes de produzir passos/logs consultáveis; **não há aprovação de testes** nem teste local de partida.
- Nenhum dos itens da matriz está `verificado localmente`.

## Procedimento

- Expandir P01-P22 em subitens verificáveis antes de marcar `verificado localmente`; o README da referência e os dados `shared/` são base, não lista exaustiva.
- Manter evidência: comando de teste, versão de referência, sistema operacional, resultado e log/imagem quando pertinente.
- Para diferenças inevitáveis do navegador/FRVR, implementar a **mesma finalidade funcional** com substituição nativa local e registrar as limitações.
- A matriz de paridade precisa ser revisada junto de cada entrega; não declarar 100% com qualquer linha pendente.
