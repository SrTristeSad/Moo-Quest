# Executar cliente Lua contra o servidor ORIGINAL do moomoo-clone

**Status atual: fluxo de ticket guest e pedido de spawn implementados em codigo, ainda sem teste real de ponta a ponta. O renderizador grafico continua pendente.** O motor Node.js e o mesmo da referencia, sem ponte TCP especial nem servidor Lua. Uma unica configuracao de compatibilidade pode ser adicionada localmente se o upstream nao a publicar.

## Requisitos no Windows

- [LÖVE 2D 11.5](https://love2d.org/).
- [Node.js 20+](https://nodejs.org/) para iniciar o servidor da referencia, caso voce nao o tenha rodando.
- O servidor **original** de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone), escutando em `127.0.0.1:8080`.

## Caso voce ja tenha o servidor funcionando

1. Inicie o servidor do jeito previsto pelo **proprio projeto original**, sem alterar seus arquivos.
2. Verifique `http://127.0.0.1:8080/ping` no navegador. O resultado precisa conter `"status":"ok"` e `"build":"..."`.
3. Extraia o Moo-Quest e execute `INICIAR-WINDOWS.bat`. Se o servidor responder ao /ping, o script **nao inicia outra copia**, somente o LÖVE.
4. O cliente procura o build atraves de `/ping`, usa `POST /api/join` para pedir um ticket guest de uso unico ao Node e abre o WebSocket original (`/s/LC?b=<build>&token=tk:<ticket>`). Depois de `io-init`, usa o arquivo de build do Node para assinar o pacote de spawn. O codigo de recusa aparece na propria tela.
5. `R` tenta conectar novamente apos falha e recebe um ticket novo; `ESC` fecha o cliente. O cliente mostra `SPAWN CONFIRMADO` somente se o Node mandar pacote `C`. Quando isso acontecer, WASD envia movimento ao Node e a posicao retornada por `a` aparece na tela.

## Caso voce precise instalar o servidor original

1. `PREPARAR-SERVIDOR.bat` baixa o commit original congelado para `node-runtime/`. **Se voce ja tentou instalar e recebeu erro sobre config.js, nao apague `node-runtime`: o novo preparador o reutiliza.**
2. Se `server/src/anticheat/config.js` estiver faltando, copia **apenas esse arquivo** de `support/local-anticheat-config.js`, sem sobrescrever arquivos existentes. Essa configuracao e somente de **compatibilidade local**, nao os valores originais do autor.
3. Instala as dependencias npm, inicia o servidor **Node original** temporariamente no localhost e verifica resposta HTTP real de `/ping`.
4. Apos aparecer `[OK]`, `INICIAR-WINDOWS.bat` abre o servidor em uma janela e o cliente Lua em outra.
5. Alternativamente, defina a variavel `MOOQUEST_SERVER_DIR` com o caminho de uma copia original completa e funcional do repositorio. Nenhum arquivo sera editado nessa pasta.

### Arquivo ausente no upstream: instalacao agora reparavel

O commit original nao publica `server/src/anticheat/config.js`, embora o arquivo seja importado por varios modulos do Node.js. O instalador agora acrescenta **somente** uma configuracao de compatibilidade local que exporta os campos exigidos pelo codigo-fonte existente. **Nao modifica a logica de jogo original.** Essa configuracao nao e uma recuperacao dos valores do autor, portanto NAO e adequada para uso publico/Internet.

Leia [CONFIG-LOCAL.md](CONFIG-LOCAL.md) para entender exatamente quais valores sao fornecidos e suas limitacoes. A inicializacao e verificada automaticamente: se o servidor nao responder a `/ping`, o instalador informa erro com os logs reais.

## Testes do cliente

Execute `TESTAR-WINDOWS.bat`: uma tela lista testes de MessagePack, WebSocket, emissao do ticket guest na API, handshake, criptografia e sondagem HTTP. O arquivo `test-results.txt` e salvo no diretorio de dados do LÖVE, mostrado na tela.

**Aprovacao de testes unitarios nao valida uma partida.**

## Interpretacao das mensagens

- `GET /ping falhou`: nao ha servidor original acessivel.
- `API /api/join HTTP 403: captcha`: o servidor recusou o stand-in local de CAPTCHA, e o ingresso precisa ser revisado.
- `API /api/join HTTP 403: locked`: o servidor aplicou um bloqueio temporario; aguarde o prazo indicado.
- `SPAWN CONFIRMADO`: o Node aceitou um pacote `M` autenticado e retornou `C`.
- `HTTP 400/500`: servidor respondeu com erro na consulta inicial.
- `WebSocket original aberto`: negociacao de transporte concluida, mas nao indica que entrou no jogo.
- `io-init original recebido`: o primeiro pacote do servidor foi reconhecido, **ainda falta autenticar a sessao**.
- `4001`: falha de entrada, ticket, limite, banimento ou politica de conexao.
- `4002`: build/bundle incompatível.
- `4003`: servidor exige login.
- `4004`: origem incompatível.

## Evidencia da correção da imagem enviada

A imagem da ultima execucao apresentou:

- Node original iniciou em `http://127.0.0.1:8080`.
- O build retornado por `/ping` foi reconhecido pelo Lua.
- A conexao foi recusada com `4001` e o Node explicou: **missing or invalid join ticket**.
- `official client is not built yet - run npm run build` se refere ao cliente JavaScript do navegador. **O cliente Lua nao precisa compilar o navegador para solicitar um ticket guest nem para receber `io-init` quando nao ha bundle oficial ativo.** Compilar o cliente JS pode ativar selo de bundle (mode 2), ainda nao suportado pelo cliente Lua.

A correcao implementada agora envia o `POST /api/join` original primeiro. A API da referencia possui um CAPTCHA de teste local: **ela apenas verifica se o campo `captcha` esta presente**. O cliente Lua usa esse modo guest local. Isso NAO significa suporte a verificacao CAPTCHA real em servidores publicos.

Depois de receber um ticket autentico, o cliente envia o ticket em `?token=tk:<ticket>`, le `io-init`, carrega o `protocol-build.json` **somente para leitura** e solicita spawn com o pacote original `M`. Se a chave e as regras coincidirem, o Node responde com `C` e `a`; o cliente mostra o ID e as coordenadas retornadas. A propria origem do spawn deve ser confirmada pela nova execucao do Windows.

**O renderizador completo e as interfaces do MooMoo.io continuam pendentes.** Nenhuma parte de gameplay e simulada localmente.

### Requisito do arquivo de build

O `INICIAR-WINDOWS.bat` informa ao LÖVE a variavel `MOOQUEST_BUILD_FILE` apontando ao `node-runtime/server/data/protocol-build.json` gerado pelo servidor original. O Lua le esse arquivo sem modifica-lo. Se o servidor original estiver rodando em outra pasta, ajuste `MOOQUEST_SERVER_DIR` e execute o `.bat` novamente.

### Licenciamento

A versao original inclui conteudo da FRVR/cliente oficial sujeito a direitos de terceiros. A copia e download do repositorio original para uso local nao significam permissao de redistribuir livremente esses assets. O Moo-Quest nao embute esse conteudo em seu ZIP.
