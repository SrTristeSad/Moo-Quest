# Moo-Quest

**Decisao do projeto:** o Moo-Quest tera **apenas o CLIENTE desenvolvido em Lua/LÖVE 2D**. A simulacao, as regras, os animais, o combate, a construcao, os itens, as contas e os demais sistemas continuam no **servidor original de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone)**, executado primeiro localmente e depois possivelmente online.

**Regra obrigatoria:** usar o motor Node.js original, sem criar outro servidor, ponte TCP ou protocolo alternativo. O preparador **apenas complementa um arquivo de configuracao que o autor nao publicou**, sem sobrescrever nenhum arquivo do upstream. Essa configuracao e apenas para desenvolvimento local.

Referencia congelada: [commit 06f7c1c](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

## Status real

- **Implementado em codigo:** cliente LÖVE, MessagePack, WebSocket RFC6455, consulta `GET /ping`, **POST /api/join (ticket guest valido emitido pelo proprio Node local)**, conexao direta com `?b=<build>&token=tk:<ticket>`, leitura do `io-init`, chave/tabelas autenticadas e envio do pacote original `M` (spawn). Eventos `C` e `a` sao processados para exibir ID e coordenadas autoritativas; WASD, mira e clique enviam comandos reais. **Esta integracao ainda nao foi validada de ponta a ponta no Windows.**
- **Nao implementado:** login de contas, selo do bundle oficial quando exigido (seal 2), resposta completa a probes/telemetria, sprites de gameplay fieis, menus completos, artes licenciadas, renderizacao completa de armas/construcoes, som e demais recursos visuais equivalentes. O inventario recebe dados de rede, mas ainda nao possui HUD 1:1. A requisicao guest usa **o stand-in de captcha da propria API local** (aceita um booleano); nao se aplica a servidores publicos.
- **Viewport do mundo em desenvolvimento:** o cliente agora guarda jogadores, objetos, animais e recursos enviados nos pacotes Node `C/D/a/H/I/N/O/Q/G/T/U/V/P` e desenha o terreno **somente quando o Node confirma a partida e envia a posicao**. A camera segue a coordenada do jogador, recebida do servidor. As formas vetoriais dos personagens/objetos sao temporarias e **nao equivalem aos sprites finais 1:1**. O cliente nao usa a antiga simulacao Lua nem a ponte `nativeBridge.js`.

### Bloqueio encontrado na propria referencia

No commit original, `server/src/anticheat/config.js` **nao foi publicado** e o `.gitignore` contem `config.js`. **O instalador corrigido supre apenas esse arquivo ausente usando `support/local-anticheat-config.js`, sem substituir o motor Node nem sobrescrever arquivos existentes.** Os valores desta configuracao de compatibilidade sao nossos, nao os valores privados do autor, e **nao devem ser usados em um servidor publico**. Veja [docs/CONFIG-LOCAL.md](docs/CONFIG-LOCAL.md).

O cliente Lua pode tentar conectar com **qualquer instancia original ja funcionando em `127.0.0.1:8080`**, sem modifica-la. Caso o servidor aceite apenas o cliente web oficial, a tela mostrara o erro retornado; nao existe simulacao de sucesso.

## Windows

Necessarios LÖVE 2D 11.5 e Node.js 20+ (para executar o servidor).

1. Extraia [o ZIP atualizado](https://github.com/SrTristeSad/Moo-Quest/archive/refs/heads/main.zip).
2. Se voce ja tem o servidor original funcionando localmente em `127.0.0.1:8080`, **nao precisa preparar outro**. Abra `INICIAR-WINDOWS.bat`.
3. Execute `PREPARAR-SERVIDOR.bat` atualizado, inclusive se o download anterior ja existe. Ele **reaproveita `node-runtime/`**, acrescenta somente `config.js` quando ausente, instala dependencias e testa o **servidor original** localmente por `/ping`, sem mudar outros arquivos JavaScript.
4. `TESTAR-WINDOWS.bat` executa os testes do cliente Lua; isso nao substitui teste de conexao e gameplay.
5. O cliente solicita ticket guest no Node antes de abrir a conexao, valida `io-init` e tenta spawn. O ID e a posicao aparecem somente se vierem nos pacotes originais `C` e `a`. Se o servidor responder 4001/4002/4003/4004, o motivo continua visivel.

Leia [docs/EXECUTAR-LOCAL.md](docs/EXECUTAR-LOCAL.md), [docs/REGRA-PRINCIPAL.md](docs/REGRA-PRINCIPAL.md) e [docs/PARIDADE.md](docs/PARIDADE.md).

## Licenciamento

A referencia contem materiais da FRVR e do cliente oficial identificados como de terceiros. Os arquivos do cliente oficial nao serao copiados para o Moo-Quest ou redistribuidos por este repositorio sem a autorizacao necessaria. Somente arte e codigo com licenca apropriada podem ser usados na versao final.

## Proxima implementacao

Validar a inicializacao no Windows apos o reparo da configuracao, completar o ingresso por **ticket autentico da API existente** e integridade apropriada ao cliente nativo; verificar spawn real antes de renderizar mundo. Nenhuma simulacao Lua ou substituicao do servidor.

## Etapa de cliente grafico (em andamento)

- `src/game/world_state.lua` aplica snapshots **reais** dos pacotes do Node. Nenhum animal, objeto ou jogador e criado aleatoriamente pelo cliente.
- `src/game/reference_view.lua` desenha o terreno nas dimensoes e cores de referencia e visualiza entidades **somente apos o spawn**. As silhuetas ainda sao substitutos vetoriais temporarios; nao representam a arte definitiva.
- WASD, mouse, espaco, teclas numericas, Q (consumivel), E (auto coleta), X (travar direcao) e R (ping do mapa quando vivo) enviam comandos equivalentes a referencia.
- Para verificar apenas se o **servidor esta aceitando tickets**, inicie o Node e execute `VERIFICAR-CONEXAO.bat`. O teste faz `/ping` + `/api/join` + WebSocket e espera io-init real. Isto **nao testa o cliente Lua nem o spawn**.
- `INICIAR-WINDOWS.bat` agora aguarda o servidor responder `/ping` antes de iniciar LÖVE.
- `tests/world_state.lua` verifica os formatos publicados dos snapshots e foi registrado nos testes Lua. Executar teste unitario nao equivale a validar uma partida real no Windows.

**Status: cliente INCOMPLETO.** Nenhuma reproducao 1:1 foi validada de ponta a ponta; ainda faltam renderizacao fiel, animacoes, interface, colisoes visuais, inventario e recursos sociais, entre outros sistemas.
