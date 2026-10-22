# Backup e restauração — PostgreSQL V2

Este é um procedimento **offline de operação** para o servidor
independente Moo-Quest V2 instalado no aaPanel. O PostgreSQL guarda
contas de jogadores (incluindo hashes de senha), clãs, progresso,
inventário, construções salvas, banimentos, painel e configurações.

## Pré-requisitos

- PostgreSQL 17+ no servidor e os utilitários **pg_dump** e **pg_restore**
  instalados no PATH do usuário de execução do Node.js. O script não tenta
  instalar pacotes como root nem alterar o aaPanel.
- `MOO_DATABASE_URL` deve apontar para o banco autoritativo V2.
- `MOO_BACKUP_DIR` é opcional; por padrão os arquivos ficam em
  `MOO_DATA_DIR/backups` ou `server-v2/var/backups`. O diretório deve
  ficar **fora do webroot** do Nginx/aaPanel e não ser acessível pela web.
- Nunca exponha backups, variáveis de ambiente, URLs com senha, chaves
  privadas ou tokens em GitHub, logs públicos ou arquivos de download.
- Preferencialmente coloque o jogo em manutenção e encerre o processo
  Node.js ordenadamente antes do backup. Isso garante que jogadores
  conectados tenham seus últimos snapshots gravados. Se o banco perder
  conexão, **não** considere o backup consistente com a partida em RAM.

## Criar um backup

Com o ambiente `MOO_DATABASE_URL` configurado:

```bash
cd server-v2
npm run db:backup
```

O comando cria dois arquivos privados:

```text
mooquest-<timestamp>-<random>.dump
mooquest-<timestamp>-<random>.dump.json
```

O primeiro é um *custom format* de `pg_dump` (PGDMP). O segundo
contém nome do banco, nome do arquivo, tamanho e SHA-256. A publicação
ocorre depois que `pg_restore --list` encontra as quatro tabelas
obrigatórias: `mq_admin_state`, `mq_player_accounts`,
`mq_clans`, `mq_clan_members`.

O script não aceita URLs externas para download, não passa a URL com
senha em argumentos da linha de comando e cria arquivos com permissões
restritas. Copie ambos os arquivos para um local **separado da VPS**,
preferencialmente cifrado, e automatize sua retenção no seu sistema
de backup. Um volume Docker não substitui backup externo.

## Verificar uma cópia

```bash
npm run db:verify -- /caminho/privado/mooquest-....dump
```

A verificação confere assinatura de formato PGDMP, arquivo de manifesto,
tamanho, SHA-256 e catálogo de tabelas do dump. Isso não exige conexão
ativa com o PostgreSQL, mas **não substitui um teste de restauração real
numa base PostgreSQL de homologação**.

## Restaurar (operação destrutiva)

1. Faça backup do banco atual e dos arquivos privados `var/` ou
   `MOO_DATA_DIR` (principalmente `mod-secret.key` e estado do
   atualizador). O dump **não** inclui esses arquivos.
2. **Pare o processo Node do Moo-Quest no aaPanel** e impeça acessos de
   clientes. Tenha certeza de que não há outra instância do jogo gravando
   no mesmo banco. Não pare o PostgreSQL: ele precisa estar acessível.
3. Verifique o backup usando `db:verify`.
4. Configure as confirmações explícitas para o nome correto do banco e
   execute a restauração:

```bash
export MOO_CONFIRM_RESTORE="RESTORE mooquest"
export MOO_SERVER_STOPPED=YES
npm run db:restore -- /caminho/privado/mooquest-....dump
unset MOO_CONFIRM_RESTORE MOO_SERVER_STOPPED
```

O comando se recusa a restaurar sem essas confirmações e também se houver
um serviço HTTP respondendo em `127.0.0.1:$MOO_PORT` (padrão 8100).
Emprega `pg_restore --clean --if-exists --single-transaction`, sem
restaurar permissões ou ownership originais. **Substitui objetos SQL
presentes no dump e pode apagar dados atuais**. Faça primeiro o
procedimento em um banco de testes separado e mantenha um backup
pré-restauração do banco de produção.

5. Inicie o Node novamente pelo aaPanel, confira `/ready`, o painel,
   contas e clãs, e faça uma partida controlada antes de abrir o jogo.

## Escopo e limites

- O banco inclui os últimos snapshots salvos de contas registradas,
  não as ações de convidados nem o mundo em RAM. O progresso ativo
  pode estar até ~30 segundos à frente do banco, ou mais durante falhas.
- Redis contém sessões, tokens e tickets efêmeros; **não** entra neste
  backup SQL. Após restore, revogue sessões antigas/considere girar
  credenciais no Redis conforme a política de segurança.
- O dump não inclui sprites, artes, código do cliente, arquivos em
  `var/`, configurações do Nginx, certificados, Docker ou segredos.
- Os testes automatizados verificam **o contrato dos comandos de
  backup/restauração com executáveis simulados**, sem destruir banco
  de produção. A recuperação completa em aaPanel/PostgreSQL reais
  ainda depende de ensaio operacional em ambiente isolado.
