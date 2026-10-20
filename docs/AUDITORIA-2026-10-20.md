# Auditoria técnica — Moo-Quest — 2026-10-20

## Veredito

**Não atende ao objetivo solicitado.** O pedido é preservar, no cliente Windows em Lua + LÖVE, a funcionalidade existente na referência `al007ex/moomoo-clone`, antes de personalizar o jogo. O repositório atual contém um esqueleto gráfico e implementações isoladas do transporte, não um port jogável.

Auditoria estática do conteúdo de `main` nesta data. **Não foram executados testes de unidade, compilação, servidor nem partida real**. Não confundir arquivos de teste com resultados de testes.

## Evidências reproduzíveis

- `main.lua` mostra exclusivamente grade, textos de diagnóstico e status. Não importa nem instancia `src/net/websocket_client.lua`; não cria, atualiza ou desenha entidades do jogo; não chama `camera:follow`.
- `src/input.lua` lê WASD/setas e botões, mas não envia entradas para o servidor nem realiza movimentação.
- `src/protocol.lua` tem apenas `implementedCount() return 0`. `src/protocol/constants.lua` cataloga mensagens, sem executá-las nem preservar a ordem dos arrays que a referência precisa para permutação.
- `src/protocol/msgpack.lua` só cobre inteiros 32 bits, strings, bools e arrays. **Não codifica mapas/objetos nem números de ponto flutuante**. No servidor de referência, o pacote `M` de spawn exige um objeto `{name, moofoll, skin, anon}`, e `D`/ `9` usam ângulos numéricos, potencialmente fracionários.
- `src/protocol/bootstrap.lua` interpreta apenas o primeiro `io-init`, mas não a sessão autenticada.
- `src/net/websocket_client.lua` tem código não bloqueante de WebSocket, mas falta conectar LuaSocket e fonte de aleatoriedade criptográfica, além de integrar o módulo ao cliente. Não suporta WSS, fragmentação ou protocolo de pacotes autenticado. `src/net/state.lua` e `src/net/url.lua` não estão ligados ao fluxo de aplicação.
- `tests/websocket_client.lua` usa um socket simulado e força `c.expected=accept` em vez de derivar/verificar o hash do nonce no fluxo completo; isso não demonstra conexão real.
- Não existe `.github/workflows/` com testes automatizados, script de build do cliente Windows ou pacote de dependências do jogo.
- Não existe lógica de mapa, renderizador de entidades, inventário, combate, progressão, itens, construções, HUD funcional, áudio ou persistência do cliente.
- Não foi copiado, configurado nem adaptado o servidor de referência para permitir acesso nativo com protocolo próprio.

## Dificuldade estrutural da referência

- O README de `al007ex/moomoo-clone` diz expressamente que o servidor é **reconstruído**, não o código real do MooMoo.io.
- A versão principal da referência utiliza material do cliente oficial em `client-official/`; **não é adequado importar/redistribuir esses bundles e artes sem autorização**.
- O diretório `client/` é um cliente webpack antigo, descrito pelo próprio autor como **protocolo antigo**, mantido só para referência.
- `server/src/network/connection.js` valida origem, `?b=`, `?u=`, ticket e sessão. `server/src/protocol/session.js` exige HMAC-SHA256, sequência, mascaramento e tabelas de pacotes por build, com selagem opcional do cliente. Apenas aceitar HTTP 101 não possibilita jogar.
- O repositório da referência tem arquivo LICENSE Apache-2.0, mas contém também material identificado pelo autor como pertencente à FRVR; a licença do repositório não transfere os direitos sobre esse material. Confirmar licença e proveniência dos componentes reaproveitados antes de publicar o jogo.

## Estado funcional por subsistema

| Subsistema | Estado |
| --- | --- |
| Inicialização de janela LÖVE | Código presente, execução não verificada |
| Leitura local de WASD e mouse | Código presente, sem integração com a simulação |
| Câmera | Transformações simples sem acompanhamento integrado |
| MessagePack | Parcial, sem tipos essenciais ao gameplay |
| WebSocket | Implementação experimental desconectada da aplicação |
| Autenticação de sessão | Ausente |
| Servidor local adaptado | Ausente |
| Interpretação de pacotes de jogo | Ausente |
| Mapa e biomas | Ausentes |
| Jogador local/remoto, spawn/movimento | Ausentes |
| Recursos/coleta, armas, combate, animais | Ausentes |
| Construções/inventário/progressão | Ausentes |
| HUD, menus, loja, times, chat e social | Ausentes |
| Teste de partida local real | Não realizado |

## Defeitos de processo

1. Foram criados módulos pequenos, sem integrar uma cadeia vertical executável, adiando o teste real.
2. Foram comunicadas implementações parciais sem critérios de aceitação nem provas de funcionamento.
3. A compatibilidade com a referência atual depende de decisões importantes sobre servidor e licenciamento, ainda não tomadas.
4. Não há suíte de testes automatizada em CI nem validação em Windows.
5. O inventário de funcionalidades da versão de referência não virou uma matriz de paridade validada.

## Correção de rumo proposta

### P0: Fundação que realmente conecta
1. Fixar commit da referência e inventariar explicitamente mecânicas, API e dados de jogo que serão preservados, distinguindo reconstrução da referência e comportamento original.
2. Escolher estratégia técnica: preferencialmente uma **cópia autorizada do servidor reconstruído**, com um endpoint/fluxo **nativo explícito** para o cliente Lua, sem fingir identidade do bundle oficial. Manter autenticação apropriada, validação de entrada, rate limits e autoridade do servidor.
3. Empacotar dependências de LÖVE/LuaSocket para Windows, prover aleatoriedade segura e executar testes de transporte com servidor local.
4. Completar MessagePack (mapas, floats, demais tipos realmente usados) e testes com vetores gerados pelo servidor.
5. Integrar rede ao `main.lua`, receber eventos reais e tratar erros e desconexão.

### P1: Primeira partida jogável, sem placeholders
6. Entrar no jogo por um spawn real, receber estado do servidor, desenhar o mapa real e personagem, enviar WASD/mouse em formato compatível e receber posição confirmada pelo servidor.
7. Testar colisão, dano e coleta reais. Entregar build Windows reproduzível e evidência de teste ponta a ponta.

### P2: Paridade funcional antes de trocar artes
8. Portar construções, itens/armas, inventário, progressão, projéteis, animais, biomas, HUD, chat, times e recursos adicionais do cliente de referência, um a um.
9. Matriz de paridade + regressão. Sem declarar 100% até todos os critérios testáveis da versão fixada passarem.

## Critério objetivo de 'jogável localmente'

Em um Windows limpo com dependências distribuídas, executar o servidor e o cliente, conectar, entrar via spawn verdadeiro, ver o estado correto do mapa e jogador, movimentar com WASD, coletar recurso, colocar estrutura e lutar contra entidade real, sem estados simulados. Registrar logs e evidência de execução.

## Critério objetivo de 'port completo'

Cada comportamento incluído na versão de referência fixada deve ter uma implementação correspondente e um teste de aceitação documentado. Sistemas que dependem de recursos exclusivos do cliente oficial requerem recriação independente ou decisão explícita de escopo/licença — nunca alegação silenciosa de paridade.

## Arquivos principais conferidos

Moo-Quest: `README.md`, `main.lua`, `src/input.lua`, `src/camera.lua`, `src/protocol.lua`, `src/protocol/constants.lua`, `src/protocol/msgpack.lua`, `src/protocol/bootstrap.lua`, `src/net/websocket_client.lua`, `src/net/websocket_frames.lua`, `src/net/upgrade.lua`, `tests/*.lua`.

Referência: `README.md`, `LICENSE`, `client/src/index.js`, `server/src/index.js`, `server/src/network/connection.js`, `server/src/network/packets.js`, `server/src/protocol/session.js`, `server/src/protocol/build.js`, `server/src/protocol/constants.js`, `shared/config.js`.
