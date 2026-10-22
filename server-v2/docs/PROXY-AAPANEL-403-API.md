# Diagnóstico de bloqueio 403 no aaPanel — API V2

Data da investigação: **22/10/2026**.
Sintoma no cliente Windows: `Resposta da API V2 inválida:
src/net/json.lua:129: invalid JSON value` ao tentar cadastrar ou entrar.

## Evidência pública, sem criar contas

Sonda segura do GitHub Actions, através da mesma ponte HTTPS usada
pelo cliente, enviando apenas dados JSON vazios (sem login/senha):

| Endpoint | HTTP | Resposta |
| --- | --- | --- |
| `GET /ping` | 200 | JSON, `mqv2native` |
| `GET /api/capabilities` | 200 | JSON |
| `POST /api/account/register` (`{}`) | **403** | **HTML** |
| `POST /api/account/login` (`{}`) | **403** | **HTML** |
| `POST /api/join` (`{}`) | **403** | **HTML** |
| `GET /api/account/login` | **403** | **HTML** |

Trocando o User-Agent para `Mozilla/5.0` na rota de cadastro,
o bloqueio **permaneceu**. Também foi confirmado que
`GET /api/status` retorna 403 HTML, mas
`GET /api/capabilities` retorna 200 JSON.

**Todas essas respostas públicas incluem `Server: cloudflare` e
um identificador de borda Cloudflare (`cf-ray`).**
Isso confirma que o domínio usa **proxy Cloudflare**; não identifica
sozinho se a regra 403 é do WAF Cloudflare ou foi transmitida pelo
Nginx/aaPanel na origem. A inspeção de eventos Cloudflare e logs
da VPS distingue as camadas. O código `server-v2/src/http.js` emite
**JSON para todas essas rotas**, inclusive erros e cadastros
desabilitados. Portanto a resposta HTML provavelmente vem
de uma regra de proxy, WAF ou roteamento antes de chegar ao
servidor Node.js. A confirmação do componente exato exige os
logs da VPS. Não conclua que esse bloqueio seja malware ou
um problema do parser Lua.

## Verifique primeiro os eventos do Cloudflare

Na conta que gerencia `app.snusnu.com.br`, abra
**Security → Events** (ou eventos/analytics do WAF na interface
atual) e filtre pelo hostname, horário do erro e rotas
`/api/account/register`, `/api/account/login`,
`/api/join` e `/api/status`. Verifique se há ações
`Block`, `Managed Challenge` ou `JS Challenge`
das regras gerenciadas, personalizadas ou mitigação de bots.

Se o Cloudflare estiver bloqueando indevidamente essas rotas,
**corrija somente a regra responsável**, mantendo os limites de
taxa e outras proteções ativas. Clientes de jogo Lua não
conseguem resolver desafios HTML do navegador. Não use
`under attack mode` indiscriminadamente nas rotas JSON,
não desabilite a proteção do domínio inteiro, nem inclua
credenciais em logs ou capturas.

Se os eventos do Cloudflare não mostrarem bloqueio, confira
os logs Nginx/WAF do aaPanel, que podem estar originando
o HTML 403 retransmitido pelo Cloudflare.

## Primeiro compare Node local e domínio público

No **terminal da VPS** (nunca envie senhas reais), execute
usando a porta realmente configurada no projeto do aaPanel:

```sh
curl -si -X POST -H 'Content-Type: application/json' \
  --data '{}' http://127.0.0.1:8100/api/account/login
curl -si -X POST -H 'Content-Type: application/json' \
  --data '{}' https://app.snusnu.com.br/api/account/login
```

Se o primeiro retornar **401 com Content-Type: application/json**
e `{"error":"invalid_credentials"}`, enquanto o segundo
retornar **403 com Content-Type: text/html**, a requisição foi
bloqueada **entre o domínio e o Node**. Também confira
`/api/account/register`; cadastro desabilitado deve produzir
`403 JSON {"error":"registration_disabled"}` e não página HTML.

Se ambos retornarem HTML, verifique a porta e o processo correto
antes de mudar o Nginx.

## Ajustar pelo aaPanel (sem desligar todo o WAF)

1. **Website → app.snusnu.com.br → Reverse Proxy**:
   confira que o domínio HTTPS aponta para
   `http://127.0.0.1:8100` (ou porta real do Node), com
   **encaminhamento de todas as rotas**, inclusive
   `/api/account/*`, `/api/join` e `/s/LC`.
2. **Website → Config**: inspecione blocos
   `location /api`, `location /api/account`, regras
   `deny`, `return 403`, `try_files`, prioridades
   `location ^~` e **rewrites** que desviem requisições para
   uma página HTML. A regra de proxy deve encaminhar **POST**
   e GET; não somente `/ping`.
3. Para configurações personalizadas, a configuração usual
   **dentro do server HTTPS existente** tem esta forma de
   referência (não crie outro `server` nem remova certificados):

```nginx
location / {
    proxy_pass http://127.0.0.1:8100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 10s;
    proxy_read_timeout 60s;
}
location = /s/LC {
    proxy_pass http://127.0.0.1:8100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

Estes blocos são **apenas referência**: o aaPanel pode gerar
configuração equivalente automaticamente. Não crie duplicatas
de `location /` ou `location = /s/LC`. Faça backup do
Nginx antes de editar e use **nginx -t** antes de recarregar.

4. Se o aaPanel/WAF/Cloudflare estiver interceptando
   `/api/account/*`, consulte o log da regra 403.
   Corrija uma falsa classificação com uma **exceção restrita
   às rotas/condições legítimas** e mantenha proteção,
   controle de taxa e HTTPS. Não desabilite o WAF globalmente,
   não publique a porta do Node nem o PostgreSQL/Redis.
5. Teste novamente as duas requisições acima, sem credenciais.
   Quando o domínio retornar JSON estruturado, prossiga
   com login/cadastro de uma conta V2.
6. Se o JSON de cadastro indicar `registration_disabled`,
   habilite cadastro no painel administrativo, caso deseje
   inscrições públicas. Isso é uma configuração separada
   do bloqueio HTML 403.

## Mudança correspondente no cliente

`src/net/v2_response.lua` identifica resposta HTML, corpo
vazio, `Content-Type` não JSON e compressão inesperada.
A tela passa a mostrar `API V2 HTTP 403: pagina HTML em
vez de JSON; verifique o proxy HTTPS/Nginx da VPS`, sem
mostrar conteúdo bruto (que poderia conter valores sensíveis).
O cliente envia `Accept: application/json` e
`Accept-Encoding: identity`. O protocolo de conta não é
substituído, a ponte continua exigindo TLS com certificado
válido e tokens não são expostos nos logs.

**Limite da correção:** nenhum commit no GitHub modifica
automaticamente as configurações do aaPanel na sua VPS.
É preciso corrigir a regra do proxy/WAF se o domínio
continuar retornando HTML 403.


## Falha apos login V2: WebSocket /s/LC com HTTP 404

Em 22/10/2026 um teste HTTPS/WebSocket usando **somente um ticket
deliberadamente invalido** obteve HTTP 404 no dominio publico em
`/s/LC?b=mqv2native&token=tk:<ticket_invalido>`, embora
`/ping`, `/api/capabilities`, login e cadastro com respostas de
validacao estivessem chegando normalmente a API HTTP.

Um ticket invalido no Node V2 resulta em socket encerrado antes do
upgrade, nao uma pagina HTTP 404. Isso aponta para roteamento,
WebSocket desabilitado ou headers `Upgrade`/`Connection` omitidos no
proxy, ou outra intermediacao equivalente. Nao conclua que o Redis
de tickets esteja quebrado a partir desse 404.

**Solucao grafica:** no aaPanel, procure **Website → Proxy Project →
[dominio] → Modify → URL Proxy → Websocket** e habilite o recurso,
ou habilite o suporte na configuracao de proxy atual. Confirme
`proxy_pass http://127.0.0.1:8100` (porta real do Node), preserve
a terminacao TLS no site e encaminhe os headers WebSocket. Salve e
recarregue Nginx usando as opcoes do painel. Nao altere o banco nem
crie contas novas para resolver este erro.

O teste invalido **nao testa uma entrada autenticada bem-sucedida**:
depois que /s/LC chegar ao Node, pode aparecer outro erro de
ticket/IP ou sessao e exigir diagnostico especifico. Consulte os logs
da VPS caso isso ocorra.

## Conta conectada, mas Play desativado depois do login

O login e o ingresso na partida são operações distintas:
`POST /api/account/login` autentica o usuário,
`POST /api/join` cria um ticket de entrada temporário e
`GET /s/LC?b=mqv2native&token=tk:...` abre o WebSocket.

**Possível erro com Cloudflare e aaPanel:** a CDN pode encaminhar
o pedido `/api/join` e o handshake `/s/LC` à VPS por
IPs diferentes. Antes desta revisão, o Redis exigia que o IP
do ticket fosse **idêntico** ao IP da conexão WebSocket,
inclusive para contas autenticadas, e destruía a conexão
se fossem diferentes, sem resposta de erro útil para o
cliente Windows.

A revisão usa a identidade autenticada já associada ao
ticket da conta V2. Ela preserva: segredo aleatório com
144 bits, **uso único por Redis GETDEL**, 30 segundos de
validade, geração/revogação por conta e política de
manutenção/lotação. **Tickets de convidados continuam
vinculados ao endereço IP**.

Aplique o ZIP completo do servidor V2 pelo painel
**Administração → Atualizações → Enviar ZIP → Ativar**,
reinicie o Node pelo aaPanel e pressione `R` na tela do
cliente Windows (sem precisar sair da conta) para tentar
a entrada de novo.

Se ainda aparecer erro, clique em **Detalhes** no cliente.
Uma falha de `/api/join` é diferente de erro no
WebSocket. Se o proxy estiver recusando `/s/LC`, garanta
que o aaPanel encaminha os cabeçalhos `Upgrade` e
`Connection: upgrade` por HTTPS e que o Cloudflare
permite WebSockets para o domínio. Corrija apenas a regra
necessária, sem desabilitar o WAF inteiro.

## WebSocket 404 confirmado no domínio público — 22/10/2026

A sondagem do cliente Windows, usando a mesma ponte TLS verificada,
enviou um **handshake WebSocket real** para a rota
`/s/LC?b=mqv2native&token=tk:000…` (ticket propositalmente
inválido, sem dados de conta). A resposta foi **HTTP 404**.
Já `/ping` e as rotas HTTP da API responderam em JSON normalmente.
Isso indica que o ingresso por WebSocket **não está chegando ao
tratamento de upgrade do Node.js** como esperado.

O Node.js V2 encerra a conexão para um ticket inválido, em vez
de devolver uma página 404. Logo, a publicação do proxy deve
ser verificada primeiro. O 404 também pode surgir se o Nginx
retirar o cabeçalho `Upgrade`, transformando o pedido em
GET HTTP comum que o Node responde 404.

### Correção no aaPanel sem terminal

1. Abra **aaPanel → Website → app.snusnu.com.br → Reverse Proxy**.
   Localize a regra que aponta ao servidor Node (`127.0.0.1:8100`,
   ou a porta real configurada).
2. Ative **WebSocket** nessa regra caso o aaPanel ofereça a opção.
   Se não oferecer, faça backup do arquivo de configuração do site
   e abra a configuração Nginx do domínio.
3. No bloco HTTPS `server { … }` já existente, dentro dele
   e **sem criar outro server nem duplicar location existente**,
   adicione um bloco dedicado à rota WS:

```nginx
location = /s/LC {
    proxy_pass http://127.0.0.1:8100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

4. Confirme que `/api/join` e `/api/account/*` continuam
   encaminhados ao mesmo Node. Se já houver `location = /s/LC`,
   **edite o existente** em vez de criar outro.
5. Salve, faça o teste/validação da configuração do Nginx
   no aaPanel antes de aplicar e recarregue o serviço. Se
   houver erro de sintaxe, restaure o backup. No Cloudflare,
   mantenha WebSockets permitidos e revise regras que neguem
   `/s/LC` e qualquer challenge incompatível com cliente nativo.
6. No cliente Windows que já está autenticado, pressione
   **R** na tela inicial para reconectar e tente **Play**.

Não precisa alterar o banco de dados, o registro da conta
ou o aplicativo Android/Windows para corrigir a rota. Se o
domínio continuar retornando 404 mesmo após ajustar Nginx,
verifique a configuração e eventos da borda Cloudflare:
a resposta HTTP pode ter sido produzida antes de chegar ao Node.
