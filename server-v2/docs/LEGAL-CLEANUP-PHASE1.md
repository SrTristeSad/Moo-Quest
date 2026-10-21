# Separacao do legado — fase 1 (21/10/2026)

## Resultado da verificacao
A pasta `server-v2/` e um runtime independente (Node.js, PostgreSQL,
Redis) com `/ping`, `/api/join` e WebSocket `/s/LC` para interoperabilidade
experimental com o cliente Lua. Testes automatizados de protocolo nao
substituem validar partida completa no Windows/LÖVE, VPS e aaPanel.

**NAO esta pronto para substituir definitivamente o legado em producao.**
A UI do cliente ainda traz dependencias e referencias do protocolo anterior,
e a cobertura de mecanicas, tela de conta, arte, efeitos e fluxo remoto ainda
nao foi certificada. O CAPTCHA booleano e apenas de desenvolvimento;
`MOO_PUBLIC_MODE=1` exige Turnstile real, que o cliente Lua atual ainda
nao fornece para convidados.

## Limite de distribuicao criado nesta fase
- `server-v2/scripts/check-release-boundary.mjs` verifica todo o runtime
  `src/` e `public/`, barra arquivos inesperados (incluindo imagens),
  links simbolicos e imports JS para fora do `src/` do servidor independente.
- O publicador de atualizacoes assinadas usa exatamente a lista aprovada
  pelo verificador. `server/`, `shared/`, `support/`,
  `tools/sync-reference-art.mjs` e clientes de terceiros NAO fazem
  parte do pacote de atualizacao V2.
- A verificacao roda no GitHub Actions e possui testes negativos.
- `INICIAR-V2-WINDOWS.bat` e separado do inicializador antigo: recusa
  a porta 8080 caso outro backend responda e nao importa imagens
  de referencia. Exige PostgreSQL/Redis e instalacao inicial em /setup.

## Continuacao: protocolo V2 do cliente
- Em modo V2, `src/protocol/v2_session.lua` calcula os IDs de comando
  e evento do servidor nativo e autentica seus quadros MessagePack com
  HMAC-SHA256 (incluindo sequencia e MAC de 6 bytes). Usa o SHA-256 da
  instalacao LÖVE, nunca dados recebidos do servidor como segredo externo.
- Vetores deterministas conferem IDs de sessoes do Node e o quadro
  binario exato emitido para um teste conhecido, em Lua 5.1/5.4.
- A sessao e selecionada exclusivamente no caminho `MOOQUEST_REQUIRE_V2=1`.
  O transporte legado continua disponivel apenas para compatibilidade
  de testes enquanto ocorre a substituicao.
- A tela de contas V2 usa credenciais PostgreSQL, e ingresso com Bearer Redis.
  A interface administrativa legada de clãs ainda depende das antigas APIs;
  a V2 deve usar a tribo do mundo ate uma UI propria ser concluida.

## Proximas etapas para desativar o codigo anterior
1. Validar no LÖVE real: entrada, movimento, inventario, coleta, armas,
   morte, loja, cla, equipar e restauracao de contas.
2. Fazer com que o cliente Lua utilize unicamente o protocolo e autenticacao
   proprios, retire caminhos de download/sincronizacao de artes de terceiros
   e use imagens com licenca verificada ou arte original.
3. Atualizar o fluxo de instalacao padrao para `server-v2/` e remover
   `server/` e `shared/` do estado atual do repositorio quando nao
   houver mais dependencia. Preservar os avisos Apache-2.0 e o historico.
4. Auditar codigos Lua transcritos, textos, nomes de itens, designs,
   marcas, imagens e licencas de cada asset; obter parecer profissional
   antes da comercializacao.

**Limite desta fase:** este controle prova isolamento do pacote assinado,
nao a originalidade absoluta de todo o codigo nem autorizacao juridica para
explorar artes ou identidade visual. `git` conserva historico; excluir
arquivos posteriormente nao reescreve commits publicos antigos.
