# Moo-Quest

**Decisao do projeto:** o Moo-Quest tera **apenas o CLIENTE desenvolvido em Lua/LÖVE 2D**. A simulacao, as regras, os animais, o combate, a construcao, os itens, as contas e os demais sistemas continuam no **servidor original de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone)**, executado primeiro localmente e depois possivelmente online.

**Regra obrigatoria:** usar o motor Node.js original, sem criar outro servidor, ponte TCP ou protocolo alternativo. O preparador **apenas complementa um arquivo de configuracao que o autor nao publicou**, sem sobrescrever nenhum arquivo do upstream. Essa configuracao e apenas para desenvolvimento local.

Referencia congelada: [commit 06f7c1c](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

## Status real

- **Implementado em codigo:** cliente LÖVE, MessagePack, WebSocket RFC6455, consulta `GET /ping`, **POST /api/join (ticket guest valido emitido pelo proprio Node local)**, conexao direta com `?b=<build>&token=tk:<ticket>`, leitura do `io-init`, chave/tabelas autenticadas e envio do pacote original `M` (spawn). Eventos `C` e `a` sao processados para exibir ID e coordenadas autoritativas; WASD, mira e clique enviam comandos reais. **Esta integracao ainda nao foi validada de ponta a ponta no Windows.**
- **Nao implementado ou nao validado:** login de contas, selo do bundle oficial quando exigido (seal 2), probes/telemetria completos, menus sociais, chat, cenas especiais, desenho das animacoes e verificacao visual pixel a pixel. O HUD e as rotinas graficas principais ja foram portados do cliente JS de referencia, mas **ainda nao sao uma versao 1:1 comprovada**. A requisicao guest usa **o stand-in de captcha da propria API local**, apropriado somente para testes locais.
- **Porte grafico do codigo-fonte:** `reference_primitives.lua` e `reference_objects.lua` convertem as rotinas Canvas originais de arvores, arbustos, pedras e **23 itens**; `reference_assets.lua` carrega PNGs reais do cliente JS, copiados apenas na instalacao local; `reference_view.lua` segue camadas, personagem, equipamentos, animais e terrenos de referencia; `reference_hud.lua` segue as posicoes do CSS original. Os dados de entidades continuam vindo do Node por pacotes; a tela de mundo so aparece depois de `C` e posicao autentica. Ainda **sem prova de execucao completa no Windows**.

### Bloqueio encontrado na propria referencia

No commit original, `server/src/anticheat/config.js` **nao foi publicado** e o `.gitignore` contem `config.js`. **O instalador corrigido supre apenas esse arquivo ausente usando `support/local-anticheat-config.js`, sem substituir o motor Node nem sobrescrever arquivos existentes.** Os valores desta configuracao de compatibilidade sao nossos, nao os valores privados do autor, e **nao devem ser usados em um servidor publico**. Veja [docs/CONFIG-LOCAL.md](docs/CONFIG-LOCAL.md).

O cliente Lua pode tentar conectar com **qualquer instancia original ja funcionando em `127.0.0.1:8080`**, sem modifica-la. Caso o servidor aceite apenas o cliente web oficial, a tela mostrara o erro retornado; nao existe simulacao de sucesso.

## Windows

Necessarios LÖVE 2D 11.5 e Node.js 20+ (para executar o servidor).

1. Extraia [o ZIP atualizado](https://github.com/SrTristeSad/Moo-Quest/archive/refs/heads/main.zip).
2. Execute `PREPARAR-SERVIDOR.bat` atualizado **mesmo que voce ja tenha o Node**, pois ele tambem importa os sprites do cliente JS original para `assets/reference/img/` apenas no PC local. O servidor `node-runtime/` e reutilizado; os arquivos existentes do upstream nao sao sobrescritos.
3. Execute `INICIAR-WINDOWS.bat` para abrir cliente LÖVE e servidor Node (ou usar Node ja ativo em `127.0.0.1:8080`).
4. `TESTAR-WINDOWS.bat` executa os testes do cliente Lua; isso nao substitui teste de conexao e gameplay.
5. O cliente solicita ticket guest no Node antes de abrir a conexao, valida `io-init` e tenta spawn. O ID e a posicao aparecem somente se vierem nos pacotes originais `C` e `a`. Se o servidor responder 4001/4002/4003/4004, o motivo continua visivel.

Leia [docs/EXECUTAR-LOCAL.md](docs/EXECUTAR-LOCAL.md), [docs/REGRA-PRINCIPAL.md](docs/REGRA-PRINCIPAL.md) e [docs/PARIDADE.md](docs/PARIDADE.md).

## Licenciamento

A referencia contem materiais de terceiros, incluindo arquivos atribuidos a FRVR. O script `tools/sync-reference-art.mjs` copia 180 PNGs existentes na referencia **somente para a instalacao local**, que esta em `.gitignore`. Nenhum desses PNGs e registrado no GitHub do Moo-Quest. **Distribuir/publicar essas artes exige autorizacao apropriada**; somente arte e codigo com direitos claros devem integrar a futura distribuicao.

## Proxima implementacao

Validar no Windows `/api/join -> io-init -> M -> C` e recepcao dos objetos/animais. Comparar visualmente o porte Lua com o JavaScript original, corrigir divergencias nas animacoes, HUD, menu e cenas especiais. Nenhuma nova arte, mecanica ou servidor substituto.

## Etapa de cliente grafico (em andamento)

- `src/game/world_state.lua` aplica snapshots **reais** dos pacotes do Node. Nenhum animal, objeto ou jogador e criado aleatoriamente pelo cliente.
- `src/game/reference_primitives.lua` porta as formas Canvas; `reference_objects.lua` porta 4 recursos e 23 itens; `reference_view.lua` usa os PNGs originais de animais/armas/chapéus/acessórios e a ordem de renderizacao de referencia. Nenhuma silhueta de animal inventada sera desenhada quando faltar um PNG.
- WASD, mouse, espaco, teclas numericas, Q (consumivel), E (auto coleta), X (travar direcao) e R (ping do mapa quando vivo) enviam comandos equivalentes a referencia.
- Para verificar apenas se o **servidor esta aceitando tickets**, inicie o Node e execute `VERIFICAR-CONEXAO.bat`. O teste faz `/ping` + `/api/join` + WebSocket e espera io-init real. Isto **nao testa o cliente Lua nem o spawn**.
- `INICIAR-WINDOWS.bat` agora aguarda o servidor responder `/ping` antes de iniciar LÖVE.
- `tests/world_state.lua` verifica os formatos publicados dos snapshots e foi registrado nos testes Lua. Executar teste unitario nao equivale a validar uma partida real no Windows.

**Status: cliente INCOMPLETO.** O porte das rotinas graficas e parcial e nao foi validado rodando no Windows. Faltam paridade de animacao, menus, configuracoes, social, fluxos de conta, detalhes do cliente oficial e comparacao visual pixel a pixel. Veja [docs/PORT-CLIENTE-ORIGINAL.md](docs/PORT-CLIENTE-ORIGINAL.md).
