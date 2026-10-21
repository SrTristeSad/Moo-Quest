# Publicação de atualização assinada (equipe do projeto)

A VPS de jogo tem **somente a chave pública**. Mantenha a chave privada em
uma máquina da equipe com backup cifrado, nunca no GitHub nem na VPS.

1. Gere uma chave Ed25519 com `openssl genpkey -algorithm ED25519 -out private.pem`.
2. Exporte a pública: `openssl pkey -in private.pem -pubout -out public.pem`.
3. Após revisar e testar os arquivos, defina no computador do publicador:
   `MOO_SIGNING_PRIVATE_KEY_FILE`, `MOO_RELEASE_PUBLIC_BASE` (HTTPS) e,
   opcionalmente, `MOO_RELEASE_VERSION`.
4. Execute `node scripts/make-release.mjs`. Publica somente `src/*.js` e
   `public/*.(js,html,css)`, incluindo os hashes de cada arquivo num manifesto
   com assinatura Ed25519.
5. Faça upload do diretório gerado `release-output/` para **seu** servidor
   de atualizações HTTPS, servindo `/manifest.json` e `/releases/...` sem
   redirecionar para outro domínio.
6. Na VPS, configure `MOO_UPDATE_MANIFEST_URL` e
   `MOO_UPDATE_PUBLIC_KEY_FILE` no projeto aaPanel e reinicie para carregar
   a configuração. No painel do servidor, verifique/baixe/ative e reinicie
   novamente pelo aaPanel para usar o novo release.

O código de inicialização `bootstrap.js` e o diretório de dados `var/` não
podem ser substituídos por atualização remota. Em caso de falha precoce, o
bootstrap retorna à versão anterior; em outro tipo de erro, use o botão
Reverter no painel e reinicie via aaPanel.

A atualização não altera dependências npm. Para adicionar bibliotecas,
primeiro publique nova versão base pelo Git e execute `npm install` no
projeto aaPanel sob revisão da equipe.
