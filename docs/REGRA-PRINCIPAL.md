# Regra principal — SOMENTE o cliente em Lua

**Regra definida pelo usuario e obrigatoria.**

## Arquitetura

1. Cliente grafico: Lua + LÖVE 2D, no Windows.
2. Servidor: **codigo ORIGINAL de al007ex/moomoo-clone, em Node.js, intacto**. O servidor roda localmente por enquanto.
3. Ligacao: **protocolo WebSocket ja fornecido pelo proprio servidor**, em `ws://127.0.0.1:8080/s/LC`, incluindo requisitos nativos de entrada, sessao e pacotes autenticados. Nao alterar o servidor para aceitar atalhos.
4. Futuro: evoluir a infraestrutura de conexao do servidor Node.js para acesso online, numa etapa futura, com avaliacao separada de seguranca e hospedagem. Nao usar a ponte TCP anterior nem abri-la remotamente.
5. Escopo: reproduzir tudo que o projeto de referencia oferece no cliente Lua antes de adicionar mecanicas proprias, respeitando direitos de terceiros sobre arte, assets, bundles e marcas.

Referencia imutavel durante auditoria:
[al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7](https://github.com/al007ex/moomoo-clone/tree/06f7c1ca965a7628671676c8d9a7efd3997bb5e7).

## Proibicoes especificas

- **NAO** criar ou rodar simulacao do servidor em Lua.
- **NAO** criar `nativeBridge.js`, um servidor proxy/adaptador proprio, protocolo TCP alternativo ou rota customizada.
- **NAO** editar os arquivos JavaScript do servidor, retirar sua autenticacao, mudar anticheat, criar dados falsos no cliente ou simular sucesso sem resposta autenticada.
- **NAO** classificar um WebSocket aberto, um `io-init` ou sprites renderizados como partida jogavel. Somente spawn real no servidor original prova isso.
- **NAO** importar assets protegidos da FRVR/cliente oficial sem licenca apropriada.

## Entrega parcial vs entrega completa

Uma etapa parcial precisa ser descrita como parcial, com evidencias/testes registrados. A primeira partida local so estara verificada quando a conexao original cumprir ingresso, spawn, mundo, WASD/mira, coleta, construcao, dano/morte/respawn **calculados pelo servidor original**, mostrados pelo cliente Lua. A versao completa exigira tambem 100% dos sistemas do jogo de referencia que se aplicam ao cliente: HUD, biomas, inimigos e chefes, armas, efeitos, visual, loja, contas, social, chat, clã e menus.

## Problema de origem

O commit de referencia **importa** `server/src/anticheat/config.js` mas o arquivo nao foi localizado na arvore Git congelada. O Moo-Quest **nao vai inventar/configurar as regras de seguranca do servidor por conta propria**. Para seguir com o jogo, sera preciso uma copia original completa e funcional ou uma correcao publicada pelo autor. Enquanto isso e possivel desenvolver e testar os modulos do cliente Lua sem declarar jogabilidade concluida.
