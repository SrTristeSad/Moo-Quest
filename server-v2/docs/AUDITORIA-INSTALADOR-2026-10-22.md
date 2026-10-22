# Auditoria do instalador aaPanel e API V2 — 22/10/2026

Escopo: `bootstrap.js`, `setup-server.js`, HTML/CSS/JS do assistente,
configuração PostgreSQL/Redis, CLI de backup e produção do ZIP completo.
Esta auditoria **não** substitui pentest, ensaio de recuperação em VPS real
nem revisão funcional integral de todos os pacotes do jogo.

## Defeitos confirmados e corrigidos

1. **Instalador renderizado sem estilo.** A interface empregava uma tag
   `<style>` bloqueada pela própria política
   `Content-Security-Policy: style-src 'self'`. O navegador exibiu
   campos e botões no layout padrão. Corrigido com stylesheet externo,
   rota HTTP explícita com MIME `text/css`, novo layout responsivo
   para desktop e celular e nenhuma dependência de `unsafe-inline`.
2. **Formulário anterior sem hierarquia visual.** Reconstruídos cabeçalho,
   etapas, grupos de credenciais e administração, estilos de foco,
   feedback acessível e estados de erro. Nenhuma imagem/artes externas.
3. **Conexão PostgreSQL TLS sem garantia explícita de hostname.**
   O instalador utilizava `sslmode=require`, alterado para
   `sslmode=verify-full` quando TLS está selecionado. Isso exige
   certificado válido e configuração correta na instância remota.
   Redis remoto ainda exige `rediss://`.
4. **CLI de backup desconectada do fluxo de instalação web.** Ao
   configurar o banco apenas por `/setup`, `npm run db:backup`
   exigia `MOO_DATABASE_URL` manual. Agora lê a conexão persistida
   pela instalação guiada, mantendo validação das permissões `0600`.
5. **Falha HTTP fora do tratamento de erros.** Oprocessamento do caminho da URL
   foi deslocado para dentro do bloco `try/catch` no instalador.
6. **Regressões automatizadas.** Testes HTTP verificam entrega de
   HTML/JS/CSS e aplicação segura da CSP; testes de normalização
   de conexões validam certificado/hostname e verificam backup
   após instalação guiada sem duplicar senhas em variáveis de ambiente.

## Estado e pendências

- O ZIP inclui o runtime do servidor Node.js e dependências npm
  Linux, painel, instalador, scripts e documentação; **não** inclui
  executáveis Node, PostgreSQL e Redis nem dados privados. Estes
  precisam estar disponíveis na VPS.
- O navegador deve acessar `/setup` por HTTPS através de Nginx.
  Mantenha a porta Node e os serviços de banco disponíveis apenas
  internamente. Preferir `MOO_DATA_DIR` fora do diretório público
  do domínio; credenciais **nunca** devem ficar expostas pelo Nginx.
- Durante o upgrade, **preserve** `var/`, `MOO_DATA_DIR`,
  `.env`, bancos e backups. O ZIP não contém os dados de uma
  instalação anterior.
- Continuidade do multiplayer e paridade completa do protocolo
  Lua/LÖVE com VPS, HTTPS/WSS para o cliente remoto, interfaces
  públicas do Turnstile, capacidade da VPS, testes de resistência e
  restauração real do PostgreSQL não foram validados por este PR.
- Se o PostgreSQL ou Redis não estiver ativo, o assistente
  devolve falha e não simula uma conexão bem-sucedida.
- O botão de instalação mantém código temporário mostrado apenas
  nos logs, com limitação das tentativas inválidas.
