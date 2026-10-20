# Regra principal — Cliente Lua + servidor Node.js de referência

**Status:** esta regra substitui a antiga exigência de reescrever cliente e servidor em Lua. Decisão do usuário: **somente o cliente será em Lua; manter o servidor reconstruído em Node.js**, inicialmente local e, mais tarde, adaptado para jogo online.

## Referência congelada

- Repositório: https://github.com/al007ex/moomoo-clone
- Versão-base: `06f7c1ca965a7628671676c8d9a7efd3997bb5e7` (1.9.4-dev).
- Não alterar silenciosamente a versão-base sem comparar as diferenças.

## Escopo de paridade

O Moo-Quest deve **reproduzir as funcionalidades observáveis da referência** com o máximo de fidelidade de funcionamento, controles e apresentação antes de quaisquer modificações criativas. Não criar uma versão simplificada substituindo recursos reais por placeholders, números simulados, ícones genéricos ou objetos de mentirinha.

A referência será fonte das regras de mundo, spawn, colisões, coleta, inventário, armas, construções, ataques, dano, AI, animais, chefes, progressão, economia, multiplayer, clãs, chat, interface, menus, loja, contas, notificações e funcionalidades extras presentes no commit fixo. O servidor reconstruído pode conter diferenças em relação aos serviços oficiais de MooMoo.io; a meta é **esta referência**, não uma alegação de equivalência aos servidores oficiais.

## Arquitetura imutável até nova decisão

1. **Cliente Lua + LÖVE 2D 11.5**, no Windows. Responsável apenas pelas atividades de cliente: desenhos, interface, entradas, som, câmera e visualização de estado.
2. **Servidor Node.js original reconstruído**, usando seus módulos próprios de mundo, jogador, IA, itens, colisões, economia e serviços. Não reescrever ou substituir o servidor em Lua.
3. **Primeira fase local:** executar o servidor Node reconstruído em `127.0.0.1:8080` e uma ponte TCP nativa **somente em `127.0.0.1:17017`** para o cliente Lua. A ponte converte transporte e encaminha as mensagens ao `handlePacket` do servidor original. **Não adicionar uma simulação paralela de jogo** na ponte ou no cliente.
4. **Fase futura online:** reutilizar o servidor Node.js, criando transporte apropriado para internet com criptografia, autenticação e políticas de segurança. **Não expor a ponte TCP de desenvolvimento na internet**. Não pressupor que a verificação de integridade exclusiva do browser possa ou deva funcionar sem browser.
5. **Arte/licenças:** respeitar licenças. Não distribuir código, bundles, áudio, sprites nem logotipos proprietários do cliente oficial/FRVR sem autorização. Reproduzir a funcionalidade em código próprio e utilizar recursos visuais legalmente licenciados, minimizando diferenças percebidas sem copiar arquivos indevidos.

## Critérios de entrega

- **Primeira partida local:** inicia Node e LÖVE por `.bat`; a conexão é real, spawn confirmado pelo servidor Node, movimento, colisão, coleta, construção, ataque, morte e respawn são processados no `Game` original; estado verdadeiro é recebido e renderizado no cliente Lua.
- **Port funcional completo:** todos os elementos e ações relevantes da matriz `docs/PARIDADE.md` funcionam e foram testados ponta a ponta na versão da referência congelada. Onde direitos de terceiros impedirem cópia literal da arte, substituir com uma representação legalmente utilizável de qualidade comparável e registrar a diferença.
- **Não declarar sucesso apenas porque a janela abriu**, porque existe uma função Lua ou porque um teste isolado passou. Documentar testes feitos, ambiente e resultados.
- Priorizar conclusão real do cliente integrado ao servidor original, não desenvolvimento de estruturas de servidor Lua, redes alternativas ou demos.

## Fluxo de implementação

1. Auditar e testar o cliente Lua + adaptador Node e corrigir problemas reais de instalação, transporte, spawn e estado.
2. Concluir renderização de mundo/biomas, recursos, personagens, câmera, colisões e HUD com tamanho, posições e regras corretos.
3. Integrar comandos oficiais de inventário, armas, progressão, construção, combate, itens, animais e eventos.
4. Recriar interface completa, menus, loja, comunicação/social, contas, administração conforme aplicável.
5. Cobrir os casos de paridade e distribuição Windows; em etapa separada, projetar acesso online seguro no servidor Node.

**Esta regra prevalece sobre todos os documentos mais antigos que exigem 'servidor Lua'.**
