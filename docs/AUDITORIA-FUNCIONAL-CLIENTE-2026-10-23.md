# Auditoria funcional — cliente Moo-Quest (23/10/2026)

## Escopo verificado
- Cliente Lua/LÖVE: entrada V2 autenticada, emissão de pacotes, telas de menu, inventário, painéis, controles de movimento e ataque.
- Codec de transporte WebSocket/MessagePack e resposta da API V2 no servidor Node.
- Distribuição Windows: um inicializador `.bat`, arquivos do cliente e `assets/custom/img`.
- Integridade dos 176 PNGs fornecidos; comparação com os 180 nomes do catálogo.

## Defeitos confirmados e corrigidos
1. **Movimento após perda de foco ou abertura de painéis.** O cliente apagava teclas localmente, mas a API V2 guarda a direção recebida no comando `9`. O pacote `e` só zera o vetor atual; na próxima atualização, um comando `9` antigo podia permanecer vigente se a direção não fosse revogada. Agora chat, perfil, Shop/Tribe, clãs e perda de foco enviam `9(nil)`, `e` e `F(0)` e limpam os controles locais. O estado independente de ataque automático `K(1)` é preservado.
2. **Sem regressão para foco/overlay.** Novo módulo `pause_controls.lua` com teste Lua puro que verifica a sequência e impede que a pausa desative o ataque automático.
3. **Verificação gráfica insuficiente no CI.** O teste anterior validava nomes de arquivos; agora o teste headless do LÖVE também tenta abrir cada um dos **176 PNGs distribuídos**, incluindo acessórios, animais, chapéus e armas. Arquivos com extensão PNG e conteúdo incompatível falham no teste.
4. **Mensagem do menu obsoleta.** Referência ao antigo `INICIAR-WINDOWS.bat` substituída por instrução genérica válida na distribuição V2 de um único lançador.

## Artes
O pacote entregue tinha 176 PNGs. Conferência programática independente com Pillow: **176/176 abrem como PNG real**. Do catálogo de 180 sprites, 174 estão presentes; faltam **6** que não constavam do pacote de arte:
`animals/boar_1.png`, `animals/crab_1.png`, `animals/yeti_1.png`,
`hats/hat_59.png`, `hats/hat_60.png`, `hats/hat_61.png`.
Outros dois PNGs incluídos fora do catálogo são `favicon.png` e `promotion/banner_4.png`.
Os seis ausentes não foram copiados de um terceiro sem confirmação dos direitos de redistribuição.

## Arquitetura e limites atuais
- O servidor V2 é autoritativo e mantém movimento, dano, coleta e estado do personagem. A simples aparência semelhante não assegura correspondência integral com a lógica anterior.
- `main.lua` permanece extenso, concentrando UI, eventos e comunicação. Dividir abruptamente esse arquivo sem cobertura de ponta a ponta pode quebrar entrada em partida, câmera e teclas.
- O servidor `server-v2/src/world.js` contém lógica independente de física, IA e combate. Há testes de referência, mas a igualdade com todas as regras do servidor antigo não está demonstrada.
- Build online requer Node.js 22+ e LÖVE; o cliente fala com `app.snusnu.com.br` por relay HTTPS/WSS. **O login e o jogo online do usuário não foram testados aqui com conta real ou Windows nativo.**
- O ZIP `main.zip` no GitHub é **código-fonte** com utilitários `.bat` de desenvolvimento. O workflow `v2-client-online-package.yml` monta um ZIP cliente isolado contendo **apenas um `.bat`**.

## Critério de liberação
1. CI: testes Lua 5.1 e 5.4, teste LÖVE headless incluindo PNGs, testes Node V2 e empacotamento Windows.
2. Windows real: login, Play, confirmação `C/D`, caminhar, parar, abrir/fechar Shop/Tribe/Chat/Perfil, atacar e coletar, voltar ao jogo, minimizar/restaurar e reconectar.
3. Teste do servidor público e da VPS após implantar o commit. Não confundir código publicado com servidor remoto atualizado.
4. Comparação funcional com a referência para física, IA, colisão, ritmo do ataque, progressão e economia antes de anunciar paridade completa.
