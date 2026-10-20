# Executar cliente Lua contra o servidor ORIGINAL do moomoo-clone

**Status atual: conexao WebSocket e leitura inicial do handshake em desenvolvimento. Nao jogavel.** O motor Node.js e o mesmo da referencia, sem ponte TCP especial nem servidor Lua. Uma unica configuracao de compatibilidade pode ser adicionada localmente se o upstream nao a publicar.

## Requisitos no Windows

- [LÖVE 2D 11.5](https://love2d.org/).
- [Node.js 20+](https://nodejs.org/) para iniciar o servidor da referencia, caso voce nao o tenha rodando.
- O servidor **original** de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone), escutando em `127.0.0.1:8080`.

## Caso voce ja tenha o servidor funcionando

1. Inicie o servidor do jeito previsto pelo **proprio projeto original**, sem alterar seus arquivos.
2. Verifique `http://127.0.0.1:8080/ping` no navegador. O resultado precisa conter `"status":"ok"` e `"build":"..."`.
3. Extraia o Moo-Quest e execute `INICIAR-WINDOWS.bat`. Se o servidor responder ao /ping, o script **nao inicia outra copia**, somente o LÖVE.
4. O cliente procura o build atraves de `/ping`, abre o WebSocket original (`/s/LC?b=<build>`) e tenta ler `io-init`. O codigo de recusa aparece na propria tela.
5. `R` tenta novamente; `ESC` fecha o cliente.

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

Execute `TESTAR-WINDOWS.bat`: uma tela lista testes de MessagePack, WebSocket, handshake e sondagem HTTP. O arquivo `test-results.txt` e salvo no diretorio de dados do LÖVE, mostrado na tela.

**Aprovacao de testes unitarios nao valida uma partida.**

## Interpretacao das mensagens

- `GET /ping falhou`: nao ha servidor original acessivel.
- `HTTP 400/500`: servidor respondeu com erro na consulta inicial.
- `WebSocket original aberto`: negociacao de transporte concluida, mas nao indica que entrou no jogo.
- `io-init original recebido`: o primeiro pacote do servidor foi reconhecido, **ainda falta autenticar a sessao**.
- `4001`: falha de entrada, ticket, limite, banimento ou politica de conexao.
- `4002`: build/bundle incompatível.
- `4003`: servidor exige login.
- `4004`: origem incompatível.

## Ainda falta antes de jogar

A referencia utiliza ingresso por `/api/join`, verificacao de build/bundle, tabelas aleatorias de pacotes, chave por sessao e frames assinados/mascarados, alem de integridade do cliente. A primeira conexao atual **nao falsifica** esse protocolo. O cliente ainda precisa implementar a negociacao integral legitimamente antes de receber eventos de jogo, desenhar mapa real ou permitir WASD.

### Licenciamento

A versao original inclui conteudo da FRVR/cliente oficial sujeito a direitos de terceiros. A copia e download do repositorio original para uso local nao significam permissao de redistribuir livremente esses assets. O Moo-Quest nao embute esse conteudo em seu ZIP.
