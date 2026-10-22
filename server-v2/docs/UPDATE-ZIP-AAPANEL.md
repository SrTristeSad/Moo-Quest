# Atualização do Moo-Quest V2 por ZIP no próprio painel

Esta versão permite atualizar sem `sudo`, terminal Ubuntu nem reinstalar
PostgreSQL, Redis ou o instalador web. Faça a **primeira instalação**
com o ZIP completo para aaPanel (ele contém `bootstrap.js`,
`node_modules/`, `src/`, `public/`, `setup-server.js`).

## Primeira instalação usando o aaPanel

1. No **aaPanel → Arquivos**, abra a pasta do site/projeto
   (por exemplo `/www/wwwroot/app.snusnu.com.br`).
2. Se for uma instalação existente, **preserve `.env`, `var/`,
   `MOO_DATA_DIR`, PostgreSQL e Redis**. Faça backup da pasta e
   também do banco de dados antes de substituir arquivos.
3. Envie o ZIP completo fornecido pelo projeto e extraia **na raiz
   do projeto**, de modo que `bootstrap.js` fique diretamente ali;
   não crie uma pasta `server-v2/server-v2`.
4. No aaPanel, configure o projeto Node.js (Node >=22) para executar
   `node bootstrap.js` na porta interna configurada (normalmente 8100);
   reinicie. Uma instalação já inicializada não precisa refazer `/setup`.
5. Abra `https://SEU_DOMINIO/admin` e autentique-se.

## Próximas atualizações sem terminal

1. Abra **Painel → Atualizações**.
2. Em **Atualização por arquivo ZIP**, selecione o novo ZIP completo
   **do servidor Moo-Quest V2**. O limite é **16 MB**.
3. Confirme que o arquivo veio de uma fonte confiável.
4. Clique **Enviar e preparar ZIP**. A API valida estrutura e limites,
   verifica arquivos exigidos, descarta dependências e configurações
   não pertinentes, calcula SHA-256 e grava a nova versão em
   `MOO_DATA_DIR/releases/`.
5. Clique **Ativar versão preparada**.
6. **Reinicie o projeto Node.js pelo aaPanel** para efetivar a ativação.
7. Se houver problemas, abra o painel (se disponível), clique
   **Reverter** e reinicie novamente. Em falhas iniciais, o bootstrap
   também mantém mecanismo de reversão automática.

É possível **Descartar atualização preparada** antes de ativá-la.
O painel não substitui PostgreSQL/Redis, não grava `.env`, não altera
`MOO_DATA_DIR/infrastructure.json` e não pede senha sudo para
o upload. O ZIP instalado inicialmente oferece também a atualização
assinada via HTTPS que já existia.

### Integridade, origem e limitações

Um ZIP enviado manualmente por administrador é um **deploy de código**.
O SHA-256 verifica a integridade do arquivo recebido, e o leitor ZIP
bloqueia arquivos fora de `src/*.js` e `public/*.js|css|html`,
diretórios maliciosos, links, entradas duplicadas e volumes excessivos.
**Essas verificações não provam que o código é confiável**. A opção de
ZIP manual não exige assinatura Ed25519; use somente ZIP oficial ou
gerado do seu repositório de confiança. Em ambientes sensíveis,
prefira o fluxo de atualizações assinadas por Ed25519.

O upload não aplica patches do banco nem troca executáveis Node,
PostgreSQL ou Redis. Pacotes futuros com novas dependências
necessitarão atualizar o ZIP base no aaPanel manualmente ou
instalar as dependências; o estágio por ZIP só substitui a árvore
`src/` e `public/`. O primeiro ZIP desta versão já inclui
`yauzl`, exigido pelo leitor de arquivos ZIP.

Se a solicitação `/api/admin/updates/upload-zip` voltar como
**HTML 403**, consulte os eventos Cloudflare e Nginx/aaPanel.
Não desligue a segurança global do site.
