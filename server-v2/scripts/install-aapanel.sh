#!/usr/bin/env bash
# Optional local setup; does not modify aaPanel settings or require root.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null; then echo 'Instale Node.js 22+ no aaPanel.'; exit 1; fi
node -e 'const x=+process.versions.node.split(".")[0];if(x<22)throw Error("Node.js 22+ obrigatório")'
if ! command -v npm >/dev/null; then echo 'npm indisponível.'; exit 1; fi
npm install --omit=dev --no-audit --no-fund
mkdir -p var
chmod 700 var
printf '\n[MOOQUEST] Dependências preparadas. Configure no aaPanel:\n'
printf '  Diretório do projeto: %s\n  Inicialização: node bootstrap.js\n  Porta local: 8100\n' "$(pwd)"
printf '  Ambiente: MOO_HOST=127.0.0.1, MOO_PORT=8100, MOO_PUBLIC_HTTPS=1, MOO_TRUST_PROXY=1\n'
printf '  Use HTTPS no domínio, via reverse proxy, e abra /setup.\n'
