# Matriz de paridade — Cliente Lua / servidor Node reconstruído

> **Documento histórico:** esta tabela corresponde a uma etapa anterior do porte e contém status que ficaram desatualizados após os PRs #2–#9. Consulte [Auditoria de 21/10/2026](AUDITORIA-PARIDADE-2026-10-21.md) para o inventário atual de 42 pacotes, defeitos comprovados, evidências de CI e prioridades. Não interpretar os rótulos abaixo como o estado atual da `main`.

**Baseline:** [al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

**Nova regra:** o servidor Node.js **já contém** a simulação das mecânicas da referência. O trabalho do Moo-Quest agora se concentra na **conexão, renderização e controles do cliente Lua**. Não é necessário portar o Game/Player/AI do servidor para Lua. Os antigos módulos `src/server/` foram removidos da árvore atual; seu histórico permanece no GitHub. **O único servidor em uso é Node.js.**

Estados: `pendente`, `em desenvolvimento`, `implementado sem teste de ponta a ponta`, `verificado em Windows`. **Nenhum dos sistemas foi ainda verificado em Windows após esta mudança de arquitetura.**

| ID | Sistema de referência | Status da parte Lua | Critério para aprovar |
| --- | --- | --- | --- |
| P01 | Inicio Windows / motor Node original | correcao de instalacao criada, teste Windows pendente | Preparacao reutiliza download, adiciona config local ausente e confirma /ping do Node |
| P02 | Sessao, ticket, spawn e retorno | implementado parcialmente em codigo, sem teste de ponta a ponta | POST /api/join em localhost, token tk: valido, C/D reais, morte e respawn |
| P03 | Transporte e eventos da partida | implementado parcialmente em codigo, sem teste Windows | WebSocket original, io-init, HMAC, mascaramento, eventos decodificados e telemetria local vazia |
| P04 | Mapa completo e câmera | em desenvolvimento | biomas, área secreta, zoom, culling e mundo completo |
| P05 | WASD, mira e acoes | em desenvolvimento (9, D e F ligados, sem teste; z pendente) | comandos autenticados de movimento, mira, mouse, inventario confirmados pelo servidor |
| P06 | Recursos, coleta e dano em objetos | em desenvolvimento | coleta real atualiza recursos, XP e status |
| P07 | 16 armas, variantes e projéteis | pendente | controles, desenho, ataques, recarga, efeitos e upgrades |
| P08 | 23 itens, 14 grupos e construções | em desenvolvimento | seleções, custos, limite, reparos e objetos sincronizados |
| P09 | 15 tipos de animais, IA e ataques | em desenvolvimento | todos aparecem e animam conforme pacotes I, J e outros |
| P10 | Chefes, Crab King, fases e eventos | pendente | mergulho, avisos, golpes, efeitos e recompensas |
| P11 | Neve, deserto, rio, piscinas secretas | em desenvolvimento | terreno/física são vistos corretamente sem inventar regras |
| P12 | Idade, XP, atualizações e economia | em desenvolvimento | interface, seleção e upgrade H/T/U/V corretos |
| P13 | 49 chapéus e 21 acessórios / loja | pendente | menus, compra, equipa, efeitos, identificação e sprites legais |
| P14 | HUD completo e configurações | pendente | escala, posição, saúde, inventário, ajustes e controles |
| P15 | Chat, tribos e clãs | pendente | enviar/receber pacotes, convites e moderadores |
| P16 | Contas locais, perfis e rankings | pendente | menus e chamadas API ao Node original |
| P17 | Amigos, convites, mensagens sociais | pendente | integração com APIs de contas e SSE ou equivalente nativo |
| P18 | LC/MB e multijogador | pendente | jogadores simultâneos, espectro LC/MB, membros autenticados |
| P19 | Segurança apropriada para nativo | em desenvolvimento | taxas, validação local; projeto de autenticação online separado |
| P20 | Administração, comandos e moderação | pendente | UI/controles correspondentes à referência e API local |
| P21 | Extras v1.9.1/v1.9.4 | pendente | cada elemento anunciado na referência validado |
| P22 | Pacote final Windows / regressão | em desenvolvimento | build, instalador, testes e revisão de paridade visual |

## Implementado no código atual

- `PREPARAR-SERVIDOR.bat` reutiliza o original baixado, supre somente `anticheat/config.js` quando ausente e executa o Node original num teste temporario em localhost. A politica de compatibilidade e documentada em `docs/CONFIG-LOCAL.md`, **nao representa os valores originais** e nao deve ser usada online.
- Ponte TCP anterior removida. O cliente nao cria uma rota alternativa no Node original.
- `src/net/original_join.lua` emite ticket guest **pela propria API local `/api/join`** (usa o stand-in local de captcha que o autor publicou); `src/net/original_client.lua`, `src/net/websocket_client.lua` e `src/net/secure_random.lua` usam esse ticket em WebSocket `?token=tk:...`, com consulta `/ping` em 8080.
- `src/protocol/original_crypto.lua`, `src/protocol/original_build.lua`, `src/protocol/original_session.lua` implementam tabelas, chave e frames binarios. `INICIAR-WINDOWS.bat` indica, **somente para leitura**, o caminho do build original. A integracao real precisa ser testada.
- `main.lua` solicita o spawn pelo pacote original `M`, apresenta o ID somente apos o Node confirmar `C`, mostra posicao real recebida pelo pacote `a` e envia WASD, mira, clique e renascimento pelo protocolo original; ainda nao ha renderizacao grafica fiel.
- `tests/original_join.lua`, `tests/original_client.lua` e `tests/original_session.lua` exercitam as requisicoes/tabelas/criptografia com mocks. **Nao substituem teste real no Windows**.

## Não confundir os resultados

- **Escrever um módulo ou teste não comprova sua execução.** Os testes no GitHub Actions continuam sem um resultado aprovado confiável no histórico consultado.
- A imagem anterior foi produzida com simulacao do servidor Lua que foi removida; nao comprova comunicacao com o servidor original.
- Os catálogos completos de `src/game/catalog.lua` e `src/game/animals.lua` são **dados de referência**. Sua presença não prova funcionamento de cada item, sprite, animação, ataque, economia ou efeito.
- O cliente ainda usa geometria provisória; a referência inclui visuais cujo uso está sujeito a direitos de terceiros.
- **Não afirmar 100% antes que todos os itens P01-P22 estejam verificados em Windows.**

## Próxima ordem de trabalho

1. Validar no Windows `PREPARAR-SERVIDOR.bat` depois do reparo local de `config.js`, com o servidor Node original passando `/ping`. Registrar logs se houver nova falha. Manter o uso estritamente localhost.
2. Completar interpretação dos demais pacotes e paridade da interface e visualização.
3. Equipamentos, loja, inventário, progressão, construções, combate e animais.
4. Social, conta, clã, eventos, ajustes e ferramentas especiais.
5. Regressão completa e, só numa fase posterior, transporte Node seguro para hospedagem online.
