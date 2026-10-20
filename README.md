# Moo-Quest

**Decisao do projeto:** o Moo-Quest tera **apenas o CLIENTE desenvolvido em Lua/LÖVE 2D**. A simulacao, as regras, os animais, o combate, a construcao, os itens, as contas e os demais sistemas continuam no **servidor original de [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone)**, executado primeiro localmente e depois possivelmente online.

**Regra obrigatoria:** usar o motor Node.js original, sem criar outro servidor, ponte TCP ou protocolo alternativo. O preparador **apenas complementa um arquivo de configuracao que o autor nao publicou**, sem sobrescrever nenhum arquivo do upstream. Essa configuracao e apenas para desenvolvimento local.

Referencia congelada: [commit 06f7c1c](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

## Status real

- **Implementado em codigo:** cliente LÖVE, MessagePack, WebSocket RFC6455, consulta `GET /ping`, tentativa de conexao direta ao servidor original, reconhecimento de `io-init`, leitura sem edicao de parametros de build, derivacao de chaves/tabelas e codecs de pacotes autenticados com HMAC. Testes de vetores do protocolo foram adicionados; integracao fim a fim nao validada.
- **Nao implementado:** ingresso autenticado por `/api/join` (ticket/conta), verificacao de integridade da aplicacao web quando exigida (seal 2), resposta a sondagens de integridade, envio do spawn apos ingresso valido, renderizacao de gameplay, menus, artes licenciadas, inventario, armas, som e recursos visuais equivalentes.
- **Nao jogavel ainda.** Abrir a janela LÖVE ou concluir o handshake WebSocket NAO significa que o jogador entrou no mundo. O cliente nao usa mais a antiga simulacao Lua nem a ponte `nativeBridge.js`.

### Bloqueio encontrado na propria referencia

No commit original, `server/src/anticheat/config.js` **nao foi publicado** e o `.gitignore` contem `config.js`. **O instalador corrigido supre apenas esse arquivo ausente usando `support/local-anticheat-config.js`, sem substituir o motor Node nem sobrescrever arquivos existentes.** Os valores desta configuracao de compatibilidade sao nossos, nao os valores privados do autor, e **nao devem ser usados em um servidor publico**. Veja [docs/CONFIG-LOCAL.md](docs/CONFIG-LOCAL.md).

O cliente Lua pode tentar conectar com **qualquer instancia original ja funcionando em `127.0.0.1:8080`**, sem modifica-la. Caso o servidor aceite apenas o cliente web oficial, a tela mostrara o erro retornado; nao existe simulacao de sucesso.

## Windows

Necessarios LÖVE 2D 11.5 e Node.js 20+ (para executar o servidor).

1. Extraia [o ZIP atualizado](https://github.com/SrTristeSad/Moo-Quest/archive/refs/heads/main.zip).
2. Se voce ja tem o servidor original funcionando localmente em `127.0.0.1:8080`, **nao precisa preparar outro**. Abra `INICIAR-WINDOWS.bat`.
3. Execute `PREPARAR-SERVIDOR.bat` atualizado, inclusive se o download anterior ja existe. Ele **reaproveita `node-runtime/`**, acrescenta somente `config.js` quando ausente, instala dependencias e testa o **servidor original** localmente por `/ping`, sem mudar outros arquivos JavaScript.
4. `TESTAR-WINDOWS.bat` executa os testes do cliente Lua; isso nao substitui teste de conexao e gameplay.
5. O cliente mostra a etapa real da conexao e possiveis codigos de recusa (4001, 4002, 4003, 4004).

Leia [docs/EXECUTAR-LOCAL.md](docs/EXECUTAR-LOCAL.md), [docs/REGRA-PRINCIPAL.md](docs/REGRA-PRINCIPAL.md) e [docs/PARIDADE.md](docs/PARIDADE.md).

## Licenciamento

A referencia contem materiais da FRVR e do cliente oficial identificados como de terceiros. Os arquivos do cliente oficial nao serao copiados para o Moo-Quest ou redistribuidos por este repositorio sem a autorizacao necessaria. Somente arte e codigo com licenca apropriada podem ser usados na versao final.

## Proxima implementacao

Validar a inicializacao no Windows apos o reparo da configuracao, completar o ingresso por **ticket autentico da API existente** e integridade apropriada ao cliente nativo; verificar spawn real antes de renderizar mundo. Nenhuma simulacao Lua ou substituicao do servidor.
