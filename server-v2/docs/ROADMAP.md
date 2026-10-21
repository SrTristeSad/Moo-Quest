# Desenvolvimento do servidor autoral

## Etapa 1 — fundação independente (esta entrega)

- Node.js 22+, aaPanel, proxy HTTPS, instalador por código local.
- Painel de administração: status, configuração, anúncios, sessões, jogadores,
  expulsão/bloqueio persistente por origem criptográfica, auditoria.
- Atualizador com manifesto Ed25519, HTTPS mesmo domínio, SHA-256 por arquivo,
  staging isolado e rollback após reinício pelo aaPanel.
- Arena mínima independente com WebSocket JSON (protocolo V2 ALFA), sem sprites.
- Testes de instalação, login, segurança, world ticks e conexão real.

## Etapa 2 — motor de jogo autoral

- Mapa em coordenadas contínuas, regiões e biomas configuráveis;
- colisão espacial eficiente de círculos/estruturas;
- instâncias e gestão de salas; filas e limites;
- combate determinístico (cadência, alcance, dano, defesa, morte, respawn);
- recursos, árvores, rochas, inventário e construção com persistência;
- mobs/NPCs e IA completamente novos;
- testes autoritativos de colisão e segurança em carga.

## Etapa 3 — painel completo e persistência

- Painel de salas, logs, jogadores, bans por conta/dispositivo + apelação;
- contas reais e autenticação HTTPS com verificação;
- editor de mundo, NPCs, mobs, eventos, itens, receitas e economia;
- backups automatizados e restore, migrações versionadas;
- PostgreSQL/Redis opcionais em escala, sem exigir na instalação básica;
- tarefas agendadas e alertas de infraestrutura.

## Etapa 4 — protocolo do cliente e publicação

- Definir nova documentação e versão de protocolo;
- adaptar cliente Lua mediante etapa separada, sem alterar arte existente;
- smoke de jogo real Windows/Linux, VPS aaPanel, load tests e rollback;
- revisão das licenças, do branding, da segurança e dos termos do produto.

**A entrega 1 não é o jogo completo nem um painel administrativo completo.**
Não incluir arquivos do servidor anterior, código de terceiros ou artes no
pacote final de distribuição. O repositório atual mantém o sistema antigo em
outra pasta apenas para preservar histórico e permitir migração planejada.
