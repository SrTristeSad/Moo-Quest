# Moo-Quest

**Objetivo principal inegociável:** recriar em **Lua**, para jogar **localmente no Windows**, **100% das funcionalidades** verificadas do projeto [al007ex/moomoo-clone](https://github.com/al007ex/moomoo-clone), sem inventar mudanças nem chamar protótipos de jogo pronto.

- **Regra principal:** [docs/REGRA-PRINCIPAL.md](docs/REGRA-PRINCIPAL.md) — prevalece sobre planos/documentos anteriores em caso de conflito.
- **Matriz de paridade:** [docs/PARIDADE.md](docs/PARIDADE.md) — lista os sistemas e seus testes de aceitação.
- **Referência congelada:** `06f7c1ca965a7628671676c8d9a7efd3997bb5e7` (v1.9.4-dev). Atualizações de referência exigem comparação explícita.
- **Auditoria do estado atual:** [docs/AUDITORIA-2026-10-20.md](docs/AUDITORIA-2026-10-20.md).

## Escopo fechado

- **Cliente:** Lua + LÖVE 2D (Windows).
- **Servidor final:** Lua local, autoritativo. JavaScript somente como referência de comportamento/teste durante o desenvolvimento, não como dependência de execução do produto final.
- **Funcionalidades:** todo jogo-base, mundo/biomas, controles, coleta, combate, estruturas, itens, progressão, animais/chefes, UI, áudio, chat, clãs, social, loja, contas, administração e extras oferecidos pela referência.
- **Prioridade:** primeiro a partida local real funcionando; depois alcançar paridade total; só então fazer alterações próprias.
- **Sem 'faz de conta':** interfaces vazias e módulos isolados não contam como recursos concluídos.

## Situação verdadeira

**Primeira integração local escrita, ainda NÃO validada por execução em Windows.** A versão atual inclui um servidor Lua em thread LÖVE na porta TCP local `127.0.0.1:17017`, geração e transmissão do mundo, spawn real no servidor, movimentação autoritativa básica, coleta com o martelo padrão e construção de parede de madeira. O cliente recebe o estado do servidor e renderiza representações geométricas temporárias. **Isso não é um port completo nem prova que a execução está funcionando.** Ainda faltam teste de partida, combate, animais, restante dos itens e da interface, serviços sociais e muitas outras funções da referência.

**Executar no Windows:** veja [docs/EXECUTAR-LOCAL.md](docs/EXECUTAR-LOCAL.md) e execute `INICIAR-WINDOWS.bat` com LÖVE 11.5 instalado. O fluxo local Lua não precisa de Node.js. O antigo adaptador experimental WebSocket continua no repositório para auditoria e não é usado nessa execução.

## Licenciamento

A referência contém arquivos do cliente oficial e recursos atribuídos a MooMoo.io/FRVR, que não podem ser automaticamente redistribuídos só porque o repositório inclui uma licença Apache-2.0. Recriar toda a **funcionalidade** com código Lua próprio e artes autorizadas; não copiar bundles, imagens ou marcas proprietárias sem permissão. Preservar licenças/avisos aplicáveis aos componentes efetivamente reaproveitados.

## Desenvolvimento

Todos os avanços devem registrar funcionalidade, evidência de teste e situação em `docs/PARIDADE.md`. O critério final é rodar o jogo **localmente no Windows, sem dependência de servidor JavaScript nem serviços externos**.
