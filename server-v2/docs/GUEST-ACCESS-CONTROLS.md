# Controle de convidados e cadastro — servidor V2

O painel `/admin` agora permite decidir **se jogadores podem entrar
sem conta** e **se novos usuários podem se cadastrar**. Essas são duas
permissões independentes, distintas do modo de manutenção.

## No painel

Abra **Configurações → Salvar configurações**:

- **Permitir jogadores convidados (sem conta)**: ativado por padrão em
  instalações antigas e novas, por compatibilidade. Desative para
  exigir contas existentes. Essa mudança é imediata: bloqueia
  `POST /api/join` dos convidados com
  `HTTP 403 {"error":"guests_disabled"}`, rejeita tickets
  de convidado ainda não utilizados e desconecta convidados que
  já estejam em partida. Conexões autenticadas continuam.
- **Permitir cadastro de novas contas V2**: desativado por padrão.
  Habilite quando desejar que o cliente Windows consiga criar contas
  por usuário/senha. Desativar novamente impede novos cadastros,
  mas usuários existentes continuam podendo entrar.
- **Modo de manutenção**: continua sendo um controle separado que
  bloqueia novas entradas independentemente do tipo de conta.

A política é salva no estado do PostgreSQL, e o servidor registra
um evento de auditoria quando alterada. Também existem as mesmas
opções pela API de administrador autenticada, com cookie de sessão
e token CSRF já exigidos anteriormente. Não exponha tokens de admin.

## Como o cliente consulta o estado

`GET /api/capabilities` devolve:
```json
{
  "build": "mqv2native",
  "guestEnabled": false,
  "guestAdmission": "disabled",
  "registrationEnabled": true
}
```

A resposta de fato também contém outros campos de versão e
capacidade. Quando convidados são permitidos, `guestAdmission`
é `verified_challenge` em produção pública ou
`direct_loopback_only` em testes locais.

**Habilitar convidados não equivale a desativar a proteção
anti-bot.** O modo público `MOO_PUBLIC_MODE=1` continua exigindo
Cloudflare Turnstile, segredo e hostname configurados, e a
verificação real de um token. O cliente LÖVE Windows atual ainda
não implementa esse desafio: nele, é melhor usar conta V2
até essa parte estar pronta. `captcha:true` sozinho é
autorizado apenas no loopback real de desenvolvimento, nunca
na rota pública do aaPanel.

## Bloqueio HTTP 403 do domínio

A configuração de convidados e cadastros **não** corrige o
bloqueio HTML 403 da camada de proxy. O servidor retorna erros
de política em JSON. Se o cliente receber uma **página HTML
403** ao chamar `/api/account/login`,
`/api/account/register` ou `/api/join`, há uma regra de
Cloudflare, aaPanel/Nginx ou WAF interrompendo o acesso antes
da resposta da API. Não confunda `guests_disabled` com esse
problema.

Consulte [PROXY-AAPANEL-403-API.md](PROXY-AAPANEL-403-API.md) para
comparar a API local com a pública, inspecionar os eventos Cloudflare
e ajustar somente a regra ou rota necessária. O repositório
não altera automaticamente a configuração Cloudflare da VPS.
