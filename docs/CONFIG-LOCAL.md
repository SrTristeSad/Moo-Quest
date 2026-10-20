# Configuracao de compatibilidade local do servidor Node

## Por que este arquivo existe

A referencia publica [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone), commit `06f7c1ca965a7628671676c8d9a7efd3997bb5e7`, utiliza `server/src/anticheat/config.js` em varios modulos, mas **nao versiona esse arquivo**. O `.gitignore` do upstream possui a linha `config.js`, que pode explicar sua exclusao (o motivo exato do autor nao foi confirmado).

O Moo-Quest usa **a simulação e o servidor Node.js da referencia**, sem novos gateways TCP, proxies ou substituicao das regras de jogabilidade. Para que o Node possa importar os modulos originais, o preparador supre **apenas a configuracao ausente**:

- Arquivo de origem, versionado em nosso projeto: `support/local-anticheat-config.js`.
- Arquivo gerado na instalacao local: `node-runtime/server/src/anticheat/config.js`.
- Marcador explicativo: `node-runtime/LOCAL-COMPATIBILITY-NOTICE.txt`.
- O instalador preserva arquivos existentes personalizados e do autor. **Somente se encontrar exatamente o template local anterior do Moo-Quest e seu marcador de instalacao**, migra esse template para a politica de compatibilidade Lua nativa. Nao altera outros arquivos JS do servidor.

## Limites importantes

**Nao conhecemos a configuracao privada original do autor.** Portanto, os parametros sao uma compatibilidade criada para rodar localmente, **nao sao copias ou recuperacoes dos valores originais**. O arquivo define os campos que o motor original espera: regras de ingresso, limite de conexoes, limites de pacotes, moderacao, telemetria, selo, armazenamento e penalidades.

Por seguranca, a configuracao:

- Mantem exigencias de **ticket de entrada**, **build** e **origem**; mantem WebSocket, MessagePack, derivacao de chaves, HMAC e numeros de sequencia.
- Para permitir **LÖVE 2D nativo sem bundle JavaScript**, a configuracao **apenas local** define `enforceBundle: false` e `seal.mode: 0`. Essas validacoes sao especificas do bundle do navegador, que nao existe em Lua. O motor de combate, IA, mundo e economia nao foi modificado.
- Mantem os limites de conexao/pacotes e a politica de resposta a telemetria. O cliente Lua responde os rounds vazios `q/T` com livro-razão assinado quando o selo de navegador estiver desligado.
- Deixa a lista de probes adicionais vazia porque **as regras e hashes originais nao foram publicados**. Portanto, **essa protecao local nao equivale a producao**.
- Se voce tiver uma configuracao personalizada com verificacao obrigatoria de bundle ou selo, o preparador a preserva e mostra um aviso. O cliente Lua pode continuar sendo recusado nesse caso.

**Nao exponha esta configuracao na Internet.** Se houver uma versao oficial completa do arquivo, substitua o ambiente de teste pela fonte do autor antes de hospedar o jogo. Nao afirme equivalencia de anticheat ou paridade completa.

## Como corrigir a instalacao que ja falhou

1. Baixe a versao **atualizada** do Moo-Quest e copie seus arquivos para a pasta onde esta o seu `node-runtime/`. **Nao apague `node-runtime/`.**
2. Execute novamente **`PREPARAR-SERVIDOR.bat`**.
3. O preparador deve informar que reutilizou o download, criou ou migrou somente a configuracao local quando reconhecida, instalou dependencias e iniciou o **servidor Node original em porta local temporaria** para verificar `/ping`.
4. So se esse teste passar, o preparador informara `[OK] SERVIDOR NODE ORIGINAL PREPARADO`.
5. Depois use `INICIAR-WINDOWS.bat` para iniciar o servidor e abrir o cliente Lua.

Caso o teste de inicializacao ainda falhe, a mensagem completa do console revelara o proximo problema real. Isso nao equivale a garantir que o cliente Lua ja possa entrar na partida; o protocolo de ingresso ainda esta em desenvolvimento.

## Validacao do cliente nativo

Apos executar `PREPARAR-SERVIDOR.bat`, inicie `INICIAR-WINDOWS.bat` e confirme a sequencia `/ping -> /api/join -> io-init -> M -> C`. O arquivo `VERIFICAR-CONEXAO.bat` valida apenas o ingresso e o `io-init`, nao o spawn em Lua. Sem ver `C`, a partida nao foi validada. A configuracao de compatibilidade deste documento destina-se **exclusivamente ao localhost**.
