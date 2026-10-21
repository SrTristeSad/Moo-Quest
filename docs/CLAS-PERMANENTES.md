# Clãs permanentes no cliente Lua

Atualizado em 21/10/2026.

O Moo-Quest agora distingue **dois sistemas originais do servidor reconstruído**:

- **Tribe (aliança):** grupo temporário dentro da partida, pelo
  WebSocket original (`L`, `N`, `b`, `P`, `Q` e notificações
  `A`, `g`, `1`, `2`, `3`, `4`).
- **Clan (clã):** organização permanente ligada à conta, mantida
  pelo Node em `server/data/accounts.json`, via `POST /api/name`
  e `POST /api/clan/:action`.

A implementação usa **as operações reais do Node**, sem guardar
membros fictícios no cliente Lua.

## Como usar

1. Abra o Moo-Quest pelo `INICIAR-WINDOWS.bat` e entre ou cadastre uma
   **conta local** na tela inicial.
2. Clique em **Meu clã**, ao lado de **Sair da conta**. Durante a partida
   também existe o botão **Clan**, separado de **Tribe** e **Shop**.
3. Se a conta não tiver nome registrado, escolha um nome permanente de
   3 a 15 caracteres. O Node valida e confirma.
4. Use **Criar** e escolha uma sigla alfanumérica de **3 ou 4 caracteres**;
   alternativamente, use **Solicitar** para enviar pedido a um clã
   existente, ou **Convites** para aceitar ou recusar convites.
5. Quando membro de um clã, veja **Membros**; se tiver permissão, use
   **Pedidos** e **Administrar** para aprovar membros, enviar convites,
   promover oficiais, transferir liderança, expulsar, abrir/fechar
   solicitações ou dissolver o clã.
6. Excluir um clã exige **dois cliques de confirmação**. O Node só aceita
   a operação da conta que realmente for líder.

O Node atualiza o nome/tag de clã do personagem de uma partida
**quando a conexão entra no servidor**. Depois de alterar o clã
durante uma partida já aberta, será necessário entrar novamente
para que a nova tag apareça no mundo. O cadastro permanente já
fica salvo imediatamente no servidor (gravado em disco com pequeno
atraso de agrupamento).

## Arquivos e testes

- `src/net/json.lua`: decodificação/codificação JSON nativa, com
  verificação de limites e sem execução de código recebido.
- `src/net/local_auth.lua`: autenticação local, consulta de conta,
  escolha de nome e solicitações autenticadas do clã.
- `src/game/account_clans.lua`: interface LÖVE do clã permanente,
  aberta no menu ou na partida.
- `tests/json.lua`, `tests/clan_api.lua`,
  `tests/account_clans.lua`: testes de módulo com Lua 5.1 e 5.4.
- `tools/check-clan-api.mjs`: teste integrado contra o Node rodando,
  envolvendo convites, cargos, pedidos, expulsões e dissolução.
- `src/test_clan_integration.lua`: teste integrado da interface
  **Lua + LÖVE + Node** que cria nome e clã pelo painel.
- `server/test/account-clan-persistence.test.mjs`: testa
  a permanência das informações depois de reabrir o armazenamento
  `accounts.json`.

## Limitação de segurança

O mecanismo de contas do servidor reconstruído é um **simulador para
desenvolvimento local**. Ele aceita qualquer código de seis números
na tela de login, sem confirmação de e-mail real. **Não é adequado
para oferecer cadastro público nem hospedar na Internet**.

Também não se deve publicar `server/data/`: ela contém contas locais
e chaves de assinatura de sessão, ignoradas pelo Git.
