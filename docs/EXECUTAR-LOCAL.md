# Executar Moo-Quest no Windows — servidor e cliente do nosso GitHub

> Atualizado em 2026-10-21. O Moo-Quest inclui o cliente Lua/LÖVE 2D e
> o servidor Node.js reconstruído, versionado nas pastas `server/` e `shared/`.

## Instalação

Requisitos: [Node.js 20+](https://nodejs.org/) com npm e
[LÖVE 2D 11.5](https://love2d.org/).

1. Feche todas as **janelas antigas de Node** relacionadas ao Moo-Quest.
   Caso contrário, o servidor anterior continuará ouvindo na porta 8080
   e fornecendo 1.000.000 de recursos.
2. Extraia o [ZIP atual do Moo-Quest](https://github.com/SrTristeSad/Moo-Quest/archive/refs/heads/main.zip).
   Se estiver atualizando a pasta já existente, preserve `node-runtime/`,
   `assets/reference/` e `assets/custom/`.
3. Execute `PREPARAR-SERVIDOR.bat`. Ele instala as dependências npm
   do nosso próprio `server/`. Se a pasta `server/data/` estiver vazia,
   copia para ela as contas e parâmetros antigos de `node-runtime/server/data/`
   **sem apagar a instalação original**.
4. **Artes do jogo:** seis arquivos da fonte original são PNGs inválidos.
   Não é defeito do LÖVE nem do seu Windows. O arquivo
   `ARTES-PENDENTES.txt` contém a lista. A arma inicial
   `weapons/hammer_1.png` precisa ser uma imagem PNG real da sua autoria,
   colocada em `assets/custom/img/weapons/hammer_1.png`.
   O importador preserva seus desenhos, jamais os substitui pelos seis
   arquivos corrompidos e não cria artes genéricas.
5. Execute `INICIAR-WINDOWS.bat`. O iniciador usa o nosso Node
   `server/src/index.js`, checa `/mooquest/status` e só abre o Lua
   depois de confirmar a compatibilidade do `protocol-build.json`.
   Em seguida use o botão **Play**.

## Economia e recursos

Nossa versão de `shared/config.js` define `inSandbox=false` e
`unlimitedResources=false`, como exige um jogo normal de coleta.
O jogador começa com **0 de madeira, comida, pedra e pontos**.
O Node calcula as coletas, custos e recompensas; o Lua exibe os valores
autoritativos recebidos nos pacotes `N`, sem inventar ganhos.

No servidor antigo de referência, `unlimitedResources=true` gerava
1.000.000 para cada recurso. Se você ainda vir esse número, é quase
certo que outra instância Node continua na porta 8080. Feche a antiga
e use nosso iniciador; não desative a verificação `/mooquest/status`.

## Como lidar com mensagens

- **Servidor antigo na porta 8080:** feche a janela antiga do Node.
- **Arquivo `protocol-build.json` ausente:** verifique o console do
  `INICIAR-WINDOWS.bat`, que compara o arquivo com o build da sessão ativa.
- **Arte `hammer_1.png` inválida:** forneça um PNG válido em
  `assets/custom/img/weapons/hammer_1.png`. Não renomeie um arquivo
  quebrado para `.png`, pois isso não muda seu formato.
- **Erro no cliente Lua:** execute `TESTAR-WINDOWS.bat` e abra
  `RELATORIO-TESTES-LUA.txt`.

## Licença, privacidade e segurança

O servidor reconstruído foi importado do commit fixo do
[al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).
Veja [SERVER-ORIGIN.md](../SERVER-ORIGIN.md) e a licença Apache 2.0
preservada em `licenses/`.

**O cliente oficial e suas artes não foram incluídos no GitHub.**
As contas do Node continuam sendo um simulador inseguro de login local:
qualquer código de seis dígitos é aceito. Não hospede esta configuração
na internet com contas reais. O desenvolvimento do visual 1:1 continua
separado das correções de funcionamento.
