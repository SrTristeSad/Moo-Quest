# Teste do Moo-Quest com o SERVIDOR 1

**Esta distribuição usa somente `server/src/index.js` (Node original mantido no projeto).**
O `server-v2` não faz parte do pacote e não será utilizado.
O cliente é `main.lua` (LÖVE2D), conectado ao servidor local via
`ws://127.0.0.1:8080/s/LC`.

## Executar no Windows

1. Extraia o ZIP **inteiro** em uma pasta comum, como `C:\Jogos\Moo-Quest`.
2. Instale [Node.js LTS](https://nodejs.org/) e [LÖVE2D 11.5](https://love2d.org/).
3. Execute **`TESTAR-SERVIDOR-1.bat`**. Isso chama `INICIAR-WINDOWS.bat`
   para instalar as dependências npm, iniciar o primeiro servidor e
   abrir o cliente no LÖVE2D.
4. Na primeira execução, uma conexão à internet será necessária para
   instalar dependências e **recuperar as imagens de referência** que não
   são distribuídas neste ZIP. O utilitário
   `tools/sync-reference-art.mjs` usa a cópia original fixada e converte
   os WebP identificados como PNG para PNG verdadeiro.
5. Use **Play** para entrar em uma partida local. Para executar testes
   automáticos do Lua, use `TESTAR-WINDOWS.bat`.

## Como saber que o servidor 1 foi iniciado

Abra `http://127.0.0.1:8080/mooquest/status` enquanto a janela Node
estiver aberta. O primeiro servidor responde com
`"project":"Moo-Quest"`, `"server":"vendored-node"` e
`"economy":"gather"`. O build `mqv2native` pertence ao **servidor 2**,
que este pacote **não usa**.

Se a porta 8080 já estiver ocupada pelo V2 ou por outro servidor, o
inicializador exibirá erro **em vez de fingir uma conexão válida**.
Encerre o processo antigo e execute `TESTAR-SERVIDOR-1.bat` novamente.

Para conferir manualmente o acesso local e o processo de autenticação,
use `VERIFICAR-CONEXAO.bat` e `VERIFICAR-PARTIDA-NODE.bat`.

## Conteúdo

- `server/` — **primeiro servidor Node real** (inclui lógica do jogo, loja,
  tribos, contas, anticheat e rotas de conexão).
- `shared/` — configurações e definições do servidor original.
- `src/`, `main.lua` e `conf.lua` — cliente Lua/LÖVE2D.
- `tools/`, `support/` — busca do build original, extração de arte e testes.
- `TESTAR-SERVIDOR-1.bat` e `INICIAR-WINDOWS.bat` — inicialização
  exclusiva do servidor 1.
- `licenses/` e `SERVER-ORIGIN.md` — créditos e detalhes de origem.

**Limite:** a autenticação e a configuração anticheat são destinadas a
testes locais. Não publique a porta 8080 na internet ou em um VPS
enquanto o subsistema não estiver protegido. Testes de CI verificam a
conexão com Node e cliente Lua; ainda é necessária a validação manual
do visual na máquina final.
