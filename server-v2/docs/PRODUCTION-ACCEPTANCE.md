# Critério verificável para liberar a V2

A V2 possui validações automáticas de Redis/PostgreSQL, WebSocket binário
e gameplay. Agora também executa `test/forty-native-clients.test.js`: 40
clientes WebSocket simultâneos, cada um com handshake MessagePack/HMAC,
spawn, atualizações de posição, exclusão do 41º, desconexão e nova entrada.

Isso **não** equivale a 40 usuários reais em uma VPS pública: o teste usa
tickets controlados por fixture e roda localmente no runner GitHub Actions.
Redis, sessões de conta e PostgreSQL são testados separadamente.

## Para autorizar produção

- Implantar o commit exato testado na VPS via aaPanel e preservar `.env`,
  `var/` ou `MOO_DATA_DIR`, PostgreSQL e Redis, após backup verificado.
- O domínio HTTPS deve responder JSON em `/ping`,
  `/api/capabilities` e em POST inválido de login. HTML 403/404 de
  Nginx/Cloudflare não é resposta correta da API.
- O proxy WebSocket deve encaminhar `/s/LC` com `Upgrade`/Connection e
  não exigir desafio HTML; verificar rota social `/api/social/ws` também.
- Testar login, ticket de uso único, partida, movimento e reconexão pelo
  **cliente Lua empacotado**, em pelo menos duas redes/dispositivos.
- Confirmar salvamento/recuperação de contas e clãs após reiniciar o Node.
- Executar teste de estabilidade e carga na própria VPS, acompanhar CPU,
  RAM, latência e falhas Redis/PostgreSQL.

Se qualquer item falhar, o servidor permanece **não homologado**, mesmo
com CI verde. O GitHub não consegue aplicar configurações de Cloudflare
ou aaPanel automaticamente.
