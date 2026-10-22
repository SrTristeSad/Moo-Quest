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
o bloqueio **permaneceu**. O código `server-v2/src/http.js` emite
**JSON para todas essas rotas**, inclusive erros e cadastros
desabilitados. Portanto a resposta HTML provavelmente vem
de uma regra de proxy, WAF ou roteamento antes de chegar ao
servidor Node.js. A confirmação do componente exato exige os
logs da VPS. Não conclua que esse bloqueio seja malware ou
um problema do parser Lua.

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
