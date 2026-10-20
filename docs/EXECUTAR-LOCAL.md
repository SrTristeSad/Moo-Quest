# Executar a primeira fatia local do Moo-Quest — Windows

> **Status: protótipo funcional integrado em código, SEM teste de execução confirmado.** Não é um port de 100% da referência e não deve ser anunciado como jogo completo. A arte geométrica é temporária e não copia os recursos da FRVR.

## Pré-requisitos

- **LÖVE 2D 11.5 para Windows**, a partir de https://love2d.org/.
- Uma cópia do repositório com `main.lua`, `src/`, `conf.lua` e `INICIAR-WINDOWS.bat` preservados na mesma estrutura.
- Nenhum Node.js ou navegador é necessário para executar o novo **fluxo local Lua**.
- A documentação oficial do LÖVE confirma que **LuaSocket já vem incluído com LÖVE**, sendo usado por `require("socket")`. Não precisa instalar separadamente no Windows quando usa o LÖVE oficial.

## Testar o Lua antes de jogar

Execute **`TESTAR-WINDOWS.bat`** na pasta do projeto, com LÖVE 2D 11.5 instalado. Um painel apresentará os testes com sucesso/falha; o relatório completo será salvo em `test-results.txt` no diretório de dados do LÖVE, identidade `moo_quest` (o painel exibe o caminho absoluto). Esses testes rodam no LuaJIT do LÖVE, sem precisar instalar Lua separadamente.

**Esta ferramenta testa módulos em memória e sockets simulados, NÃO comprova por si só uma partida ponta a ponta.** Depois de corrigir eventuais falhas, execute o jogo normalmente em `INICIAR-WINDOWS.bat` e percorra o checklist de integração abaixo.

## Iniciar

1. Extraia os arquivos do repositório e instale o LÖVE 2D 11.5.
2. Dê dois cliques em `INICIAR-WINDOWS.bat`.
3. O cliente deverá iniciar uma thread com servidor Lua no endereço `127.0.0.1:17017`, conectar-se e solicitar entrada automaticamente.
4. **WASD/setas**: mover; **mouse**: mirar; **botão esquerdo**: coletar/atacar com martelo. **1**: selecionar parede de madeira; clicar para construir. **2**: voltar ao martelo. **R**: renascer depois de morrer; **ESC**: sair.

## Como diferenciar conexão real de simulação

A tela deve informar `Mundo recebido do servidor Lua` e `Conectado ao servidor Lua`. Sem essas mensagens, o cliente ainda não entrou numa sessão do servidor. O mundo visível deve ser recebido via TCP em pacotes MessagePack, não gerado no `main.lua`.

### Etapas que precisam ser testadas

- [ ] O LÖVE abre sem erros de sintaxe ou dependências.
- [ ] A thread Lua escuta exclusivamente em `127.0.0.1:17017` e aceita a conexão.
- [ ] O cliente recebe mundo, ID e posição do jogador.
- [ ] WASD movimenta a posição do servidor; ao parar, o jogador desacelera.
- [ ] Câmera acompanha a posição devolvida pelo servidor.
- [ ] Coleta de rocha/árvore/arbusto altera recursos.
- [ ] Parede de madeira aparece como novo objeto após o servidor confirmar sua criação.
- [ ] Animais aparecem usando o estado enviado pelo servidor, se movem e recebem dano ao serem acertados.
- [ ] Animais hostis são capazes de causar dano ao jogador; **R** confirma renascimento real após a morte.
- [ ] Sair fecha a conexão e encerra a thread.
- [ ] Verificar limite e controles em pelo menos duas resoluções Windows.

Se houver erro, copie **o texto completo da mensagem** ou faça uma captura da janela. Não marcar nenhum item como aprovado sem executá-lo de verdade.

## Escopo limitado do protótipo

O servidor do fluxo local está numa thread do mesmo aplicativo LÖVE, mas usa **um socket TCP real** e mantém mundo e jogadores no lado do servidor. Já utiliza o gerador de recursos naturais, deslocamento base, coleta simples do martelo, a construção da primeira parede e uma implementação parcial de população/IA/combate contra animais. O protocolo de rede local foi definido especificamente para esse cliente e **não é compatível** com o WebSocket cifrado da referência.

**Falta:** testar a execução, todas as demais armas/estruturas, sprites e sons definitivos, mecânicas completas de animais e chefes (a IA do Crab King ainda não foi portada), combate PvP, efeitos especiais, sistemas sociais, dois mundos LC/MB, segurança e paridade detalhada. Este marco inicial **não** equivale à versão final descrita em `docs/REGRA-PRINCIPAL.md`.

## Problemas possíveis

- **`LOVE 2D nao encontrado`:** instale a versão 11.5, deixe `love.exe` no PATH ou coloque os binários oficiais do LÖVE na pasta.
- **`Address already in use` / `endereco em uso`:** outra aplicação já ocupa a porta 17017. Feche-a antes de iniciar.
- **`Falha TCP`:** verifique se o servidor aparece como `ready`; o executável pode ter bloqueado a conexão local.
- **Tela presa aguardando mundo:** não trate como sucesso; copie a mensagem da interface e logs.

## Licenças

Não redistribua arquivos `client-official/` ou os assets oficiais de terceiros. Apenas comportamento e parâmetros verificáveis são portados para o Lua; elementos gráficos deste marco foram desenhados por formas primitivas para testar o fluxo sem importar recursos proprietários.
