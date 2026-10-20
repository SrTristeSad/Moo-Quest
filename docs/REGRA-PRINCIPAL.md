# REGRA PRINCIPAL — PARIDADE FUNCIONAL TOTAL, LUA E JOGO LOCAL

**Status: requisito obrigatório do produto; precedência sobre documentação antiga.**
**Fonte de referência:** https://github.com/al007ex/moomoo-clone
**Commit de referência congelado:** `06f7c1ca965a7628671676c8d9a7efd3997bb5e7` (v1.9.4-dev, 2026-10-16). Atualizações futuras da referência devem passar por auditoria de diferença e decisão explícita, sem mudar silenciosamente esta meta.

## 1. Produto final obrigatório

Moo-Quest deverá reproduzir **100% das funcionalidades que o projeto de referência oferece**, observáveis em uma instalação local, com comportamento e regras equivalentes. Não se trata de adaptar a ideia nem criar uma demo visual: trata-se de portar integralmente o jogo e sua infraestrutura funcional local para **Lua**.

- **Cliente:** Lua + LÖVE 2D para Windows.
- **Servidor:** implementado em Lua, local (localhost), autoritativo para mundo, entidades, dano, recursos e progressão. Pode usar bibliotecas nativas de transporte/armazenamento, mas o código de lógica do jogo deve ser Lua.
- **Instalação local:** jogo utilizável sem internet, sem conta externa, sem depender de serviços FRVR, browser, npm ou servidor JavaScript no produto entregue; serviços que a referência simula localmente também devem funcionar localmente.
- **Uso do servidor JavaScript de referência:** permitido apenas durante testes de comparação ou como etapa temporária de migração; **não cumpre a definição de entrega final**.
- **Jogo acessível primeiro:** priorizar partida local real com mapa, personagem, movimentação, coleta, construção e combate em lugar de sucessivas camadas de infraestrutura isolada.

## 2. Princípio de paridade 100%

A matriz `docs/PARIDADE.md` é o controle de escopo. **Todo comportamento existente na referência congelada é obrigatório**, inclusive comportamentos reconstruídos pelo autor (não afirmar que são necessariamente iguais aos servidores oficiais). A matriz deve cobrir:

1. Inicialização local, servidor LC, servidor MB, entradas guest/conta, presença e múltiplos jogadores locais.
2. Geração e geometria do mundo, mapa completo, câmera, zonas/biomas, neve/deserto, rio/correnteza, área secreta, piscinas/cachoeira e obstáculos.
3. Jogador, aparência permitida, spawn, morte, respawn, WASD, direção do mouse, ataque, alcance, colisão, hitbox, movimento, velocidade e física.
4. Árvores, arbustos, rochas, ouro, recursos, coleta, inventário, experiência, eras/idades, desbloqueios, upgrades e economia.
5. Todas as armas, variantes, munições, projéteis, estruturas construíveis, posicionamento, custos, limites, reparo, durabilidade, moinho, torres e acessórios/chapéus da referência.
6. Animais, IA, agressividade, dano, drop, animações, mobs especiais, chefes (incluindo Crab King) e padrões de ataque conforme a referência.
7. Interface de jogo, barras, textos, minimapa, placar, loja, menus, ajustes, configurações de teclas, chat, grupos/tribos, clãs e demais interações.
8. Serviços locais de identidade e sociais existentes na referência: contas, nomes, perfis, amigos, mensagens, convites, notificações, rankings, clãs, denúncias e controles de privacidade.
9. Ferramentas administrativas e eventos especiais: console, teleporte, invocação de entidades, comandos, moderação, banimentos, avisos, reinícios, atualização de estado e modos especiais.
10. Validação/segurança relevante ao ambiente Lua: servidor autoritativo, verificação de mensagens, autenticação local, limites de frequência e proteção contra ações inválidas. Verificações exclusivas do navegador (ex.: detecção de DevTools/extensões) não se aplicam a um cliente nativo e serão documentadas com equivalentes apropriados — nunca descritas como implementadas de modo idêntico.
11. Áudio, feedback visual, efeitos, configuração e experiência jogável que a referência apresenta.

**Não substituir:** entidades por círculos fictícios, cenários por grades vazias, colisões por aparências, combate por valores simulados ou mensagens de sucesso por um estado não confirmado pelo servidor.

## 3. Regra de qualidade e conclusão

- Cada função terá referência verificável, implementação Lua, cenário de teste e registro de resultado.
- Estados permitidos: `não iniciado`, `em desenvolvimento`, `implementado sem teste`, `verificado localmente`, `bloqueado`.
- Apenas `verificado localmente` conta como concluído.
- Um teste unitário isolado **não** comprova funcionamento ponta a ponta.
- Não dizer '100%', 'completo', 'jogável' ou 'funcionando' se o critério correspondente não passou.
- Não inventar funcionalidades, regras, artefatos, nomes, sistemas, dependências ou assets que não existam na referência sem autorização do usuário. Portes internos e substitutos técnicos podem diferir quando necessários, desde que o comportamento percebido seja equivalente.
- Corrigir defeitos da referência somente se impedirem o jogo, documentando precisamente a diferença e, quando possível, mantendo o comportamento original.
- O usuário quer um jogo: o teste de ponta a ponta é prioridade, não somente arquitetura, documentação ou módulos independentes.

## 4. Definições de entrega

**Primeira versão local jogável:** instalador/pacote ou instruções Windows verificadas + iniciar servidor Lua local + iniciar cliente LÖVE + spawn confirmado pelo servidor + mundo e personagem visíveis + WASD/mouse + colisão + coleta de recurso + construção + dano/combate reais + morte/respawn, com evidência e testes registrados.

**Port completo 100%:** todas as linhas da matriz de escopo `docs/PARIDADE.md` estão `verificado localmente` e as exceções de plataforma/licença estão explicitadas e aceitas. As funções sociais e administrativas da referência também contam, não apenas o combate.

## 5. Licenças e proveniência (obrigatório)

A referência contém um arquivo `LICENSE` Apache-2.0, mas seu README identifica `client-official/` e o material de FRVR/MooMoo.io como propriedades de terceiros. **A presença da licença no repositório não autoriza automaticamente copiar esses materiais.**

- Não incorporar nem redistribuir bundles, imagens, fontes, marcas, SDKs ou conteúdo proprietário do cliente oficial sem licença/autorização aplicável.
- Reimplementar comportamento com código Lua próprio, usando a lógica do servidor reconstruído e outras fontes quando seus direitos permitirem; manter avisos/licenças necessários nas partes efetivamente reaproveitadas.
- Obter/criar gráficos, sons e UI com autorização de uso apropriada. **Meta: equivalência funcional de 100%; cópia literal de material protegido não é requisito e não está autorizada.**
- Não contornar proteção de serviços de terceiros. Implementar autenticação local própria e controles nativos adequados ao servidor do projeto.

## 6. Ordem de execução obrigatória

1. Fixar a referência, mapear TODAS as funcionalidades e artefatos utilizáveis; montar testes de paridade.
2. Criar servidor Lua mínimo real (partida local e estado autoritativo) e completar rede/serialização necessárias; resolver dependências Windows; executar testes reais.
3. Integrar cliente Lua e servidor Lua numa partida local com mapa e spawn reais; controles, colisões e câmera.
4. Completar ciclo jogável: coleta, itens, estruturas, combate, animais, inventário, progressão e UI.
5. Completar TODOS os sistemas e extras da referência: chefes, biomas especiais, perfis, loja, social, administração, moderação e configurações.
6. Automatizar regressões, empacotar Windows, certificar a paridade e só depois fazer alterações criativas.

**Se uma decisão técnica conflitar com o objetivo de 100% das funcionalidades em Lua para jogo local, prevalece esta regra e o conflito deve ser explicitamente informado.**
