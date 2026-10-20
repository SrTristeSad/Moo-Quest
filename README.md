# Moo-Quest

**Objetivo:** reproduzir no **cliente nativo Lua + LÖVE 2D (Windows)** a experiência e os recursos funcionais do projeto [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone), usando o **servidor reconstruído original em Node.js**. Primeiro rodará na própria máquina; futuramente o mesmo servidor Node poderá ser adaptado para hospedagem online.

**Versão-base fixa:** [al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

A documentação [docs/REGRA-PRINCIPAL.md](docs/REGRA-PRINCIPAL.md) contém os requisitos atualizados. A [matriz de paridade](docs/PARIDADE.md) mostra o que ainda falta.

## Arquitetura aprovada

- **Cliente:** Lua + LÖVE 2D 11.5. Responsável por renderização, HUD, menus, controles, animações e áudio.
- **Servidor:** Node.js original da referência, preservando as regras de física, spawn, recursos, combate, construções, progresso e animais. Não há mais duplicação da lógica do servidor em Lua no fluxo de jogo.
- **Ligação nativa local:** adaptador `node-bridge/nativeBridge.js`, instalado no servidor baixado, escutando **somente 127.0.0.1:17017**. Recebe comandos idênticos aos pacotes de jogo (`M`, `9`, `D`, `F`, `z`, etc.) e os passa ao **handlePacket original**. O servidor responde com eventos originais, interpretados em `src/net/node_protocol.lua`.
- **Futuro online:** manter o servidor Node.js, mas construir uma conexão remota autenticada, criptografada e com segurança apropriada. A ponte TCP atual é estritamente local: **não expor a porta 17017 à internet**.
- **Legado:** `src/server/` mantém estudos antigos em Lua para comparação, mas **não é iniciado pelo cliente** e não é a fonte da lógica do jogo.

## Iniciar no Windows

Pré-requisitos: Node.js 20+ com npm, LÖVE 2D 11.5 e PowerShell (Windows).

1. Baixe/extraia o repositório Moo-Quest.
2. Rode **`PREPARAR-SERVIDOR.bat`** uma vez com internet: baixa o commit-base, extrai apenas `server/` e `shared/`, instala as dependências Node e aplica a ponte de cliente Lua.
3. Rode **`TESTAR-WINDOWS.bat`** para verificar os módulos locais Lua (não substitui teste real).
4. Rode **`INICIAR-WINDOWS.bat`**: inicia o Node numa janela separada e abre o cliente LÖVE.
5. Com o Node já rodando, abra **`TESTAR-NODE-WINDOWS.bat`** para verificar por uma segunda conexão que o Game original confirmou spawn e movimentação.

O script de preparação não inclui nem redistribui os assets do cliente oficial. Veja [docs/EXECUTAR-LOCAL.md](docs/EXECUTAR-LOCAL.md).

## Status verificável

**Integração escrita, ainda NÃO validada em Windows após esta mudança de arquitetura.** O cliente envia spawn, direção de movimento, mira, ataque contínuo, seleção do martelo/parede e respawn ao servidor Node reconstruído e interpreta os eventos de jogadores, objetos, animais e recursos recebidos. Os desenhos continuam provisórios e **não equivalem visualmente ao jogo de referência**. Ainda faltam muitos sistemas do cliente: menus, inventário completo, equipamentos, armas secundárias, UI, biomas avançados, efeitos, animações, sons, chat/clãs, contas e funcionalidades sociais.

Os testes automáticos anteriores do GitHub Actions registraram `failure` sem logs de passos disponíveis. A partida local **ainda precisa ser executada e auditada**.

## Licenças e limites

O código reconstruído da referência tem suas próprias condições de uso; o README upstream adverte que `client-official/` contém código e materiais de terceiros. **Não redistribuir bundles/arte protegida do cliente oficial sem licença apropriada.** O cliente Lua será uma implementação própria com recursos visuais autorizados.

Não afirmar paridade completa até que todos os itens da matriz tenham testes de aceitação aprovados.
