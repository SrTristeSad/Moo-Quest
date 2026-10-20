# Executar Moo-Quest local: cliente Lua + servidor original Node.js

**Status:** caminho de cliente/servidor implementado em código, **ainda precisa de teste de ponta a ponta no Windows**. A interface gráfica do cliente continua provisória. Não é uma cópia visual completa.

## Requisitos

- Windows 10 ou 11.
- LÖVE 2D **11.5** instalado: https://love2d.org/
- Node.js **20 ou mais recente**, com npm: https://nodejs.org/
- PowerShell (incluso no Windows).
- Internet **uma vez** para baixar a versão-base e instalar dependências. Depois o jogo roda localmente.

## Preparação (uma vez)

1. Baixe o ZIP do repositório https://github.com/SrTristeSad/Moo-Quest/archive/refs/heads/main.zip.
2. Extraia o ZIP numa pasta comum, sem abrir os `.bat` dentro do próprio arquivo compactado.
3. Abra `PREPARAR-SERVIDOR.bat` e aguarde. Ele baixa **o servidor reconstruído da referência** no commit congelado, copia apenas `server/`, `shared/` e licença, instala as dependências npm e aplica a ponte nativa em `node-runtime/server/src/network/nativeBridge.js`.
4. Quando aparecer `[OK] Servidor pronto`, execute `TESTAR-WINDOWS.bat` para checar os módulos do cliente.
5. Inicie a partida com **`INICIAR-WINDOWS.bat`**. Ele abre o Node.js numa janela separada e inicia o LÖVE. Não feche a janela Node.js durante a partida.
6. Com o Node em execução, rode **`TESTAR-NODE-WINDOWS.bat`** para fazer uma conexão independente que envia o spawn original e confirma, pelos pacotes devolvidos, que o servidor Node processa movimento. Isso testa a ponte e o Game original, além dos testes Lua.

**Importante:** `node-runtime/` é gerado localmente e ignorado pelo Git. O instalador **não** importa os bundles/recursos oficiais de terceiros; não redistribua `client-official/`.

## Como a conexão funciona

- Servidor reconstruído Node.js: HTTP em `127.0.0.1:8080`.
- Ponte do cliente Lua: **TCP binário local em `127.0.0.1:17017`**.
- O cliente manda pacotes originais de jogabilidade (`M` spawn, `D` mira, `9` movimento, `F` ação, `z` seleção de item). A ponte entrega ao `handlePacket` do servidor original.
- O servidor devolve pacotes de entidades, posição, vida, recursos e objetos; `src/net/node_protocol.lua` converte-os para o renderizador LÖVE.
- O servidor **não é substituído por Lua**. Os antigos módulos de servidor Lua foram retirados da árvore atual e permanecem recuperáveis apenas no histórico do GitHub.
- **A ponte TCP não pode ser aberta à internet**. A fase online precisará de TLS, autenticação, validação de sessão, políticas de proteção e um transporte público distinto.

## Controles desta etapa

- WASD/setas: movimentar.
- Mouse: mirar; clique esquerdo mantido: martelo/ataque.
- `1`: selecionar parede de madeira; clique esquerdo: posicionar (se o servidor permitir).
- `2`: selecionar martelo.
- `R`: solicitar renascimento após morrer.
- `ESC`: fechar apenas o cliente Lua. Para parar o Node, feche também a janela do servidor.

## Checklist de teste REAL (não concluído)

- [ ] `PREPARAR-SERVIDOR.bat` baixa/extrai a base, instala dependências e informa pronto.
- [ ] Node inicia sem erro e informa `Lua client connection ready on 127.0.0.1:17017`.
- [ ] `TESTAR-NODE-WINDOWS.bat` informa `[OK]` após confirmar spawn e movimento pelo servidor real.
- [ ] Cliente LÖVE estabelece conexão TCP e recebe `A`, `C`, `D` / `a`.
- [ ] O mundo e as entidades vistos na tela realmente vieram do servidor Node.
- [ ] WASD move o personagem, e a câmera segue a posição atualizada pelo servidor.
- [ ] Coletar árvore/rocha altera recursos transmitidos.
- [ ] Seleção e posicionamento de parede geram um objeto confirmado pelo servidor.
- [ ] Animais recebem golpes e podem causar dano; morte e renascimento seguem as regras do Node.
- [ ] Cliente fica ocioso por mais de 60s sem perder a sessão.
- [ ] Fechar o cliente remove sua sessão do mundo Node.
- [ ] Não há regressão em duas resoluções da janela.

**Se falhar**, envie a mensagem do LÖVE, a saída da janela Node e/ou o `test-results.txt` gerado por `TESTAR-WINDOWS.bat`.

## Limitações que não devem ser ocultadas

A apresentação visual Lua ainda é um protótipo; faltam sprites autorizados, HUD completo, efeitos, armas adicionais, painel de upgrades, chat/clãs, menus, contas, social e outros recursos. A simulação real desses sistemas **já existe no servidor Node de referência**, mas seu controle e sua visualização não foram todos implementados no cliente Lua.

Mesmo que Node e Lua se conectem, **não afirmar que a paridade visual/funcional está pronta** até testar cada item documentado.

## Problemas comuns

- `'node' nao e reconhecido`: instale Node.js LTS e reinicie o prompt do Windows.
- `LOVE 2D nao encontrado`: instale LÖVE 11.5 ou coloque seus binários oficiais no PATH.
- `node-runtime ainda nao foi preparado`: rode `PREPARAR-SERVIDOR.bat` primeiro.
- `Address already in use`: outro processo ocupa 8080 ou 17017; feche o servidor anterior.
- `Aguardando servidor Node.js`: confira a janela Node e a mensagem de inicialização da ponte TCP.
- Erro de caminho terminando em aspas: atualize os `.bat`. A versão atual usa `GAME_DIR=%~dp0.` para evitar a barra invertida final junto da aspas.
