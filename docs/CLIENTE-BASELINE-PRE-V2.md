# Cliente Moo-Quest: referência antes do servidor V2

## Snapshot protegido
- Último commit do cliente antes do início do server V2: `5ad8c32d1889dcb94e5645982acc2a0f2d570e09` (21/10/2026, 14:15 UTC).
- Branch de preservação: `archive/client-before-server-v2-2026-10-21`.
- Primeiro commit do servidor V2: `0d069ccbf81...` (21/10/2026, 16:06 UTC).

## Continuidade
O cliente atual reutiliza os módulos gráficos, HUD, jogabilidade, mapa, inventário,
loja, menus, animações, física e teste do cliente de antes do V2. Os principais
arquivos de renderização e gameplay em `src/game/` são mantidos, não refeitos do zero.

**Não substituir o cliente atual por todo o snapshot**: o anterior foi desenhado
para um backend Node original. O cliente online agora usa autenticação de conta
V2, emissão de tickets e sessão binária `src/protocol/v2_session.lua` via ponte
HTTPS/WSS. Uma substituição completa interromperia o login e a entrada online.

## Critérios para próximas modificações
1. Comparar interface, mundo e efeitos com o snapshot anterior antes de modificar.
2. Preservar os sistemas de combate, construção, clãs, loja, morte e respawn existentes.
3. Testar as mudanças em dois lados: cliente Lua e servidor V2.
4. A falta de PNGs decorre de arquivos de arte *não incluídos no GitHub*:
   não substituir por desenhos genéricos e não fingir que o pacote está completo.
   Usar `assets/custom/img/` com PNGs legítimos fornecidos pelo autor.
5. Não modificar mecânicas do jogo de referência sem decisão explícita do autor.
6. A lista de contas cadastradas no admin consulta PostgreSQL com autenticação
   administrativa, paginação, busca e sem expor senhas, tokens ou perfis privados.
