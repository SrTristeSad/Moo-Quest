# Aprovação parcial — auditoria e bloqueios (23/10/2026)

**Branch de trabalho:** `fix/reference-catalog-isolated-audit-20261023`. Sem PR, merge ou deploy. A branch `main` mantém `e330e2f`.

## Implementado dentro do escopo autorizado
- `src/reference-catalog.js`: lê diretamente `shared/config.js`, `shared/config/items.js`, `shared/config/store.js`, `server/src/moomoo/modules/aiManager.js` quando a árvore do repositório está presente.
- `src/world.js`: usa os catálogos derivados em vez das tabelas manuais de armas, receitas, loja, plano de animais, progressão e projéteis; remove o registro `depleted`, sem alterar a rotina de coleta.
- `src/store.js`: preços/restrições vêm do catálogo; efeitos especiais ainda não foram reescritos.
- `scripts/reference-sources.mjs`: copia **sem transformação de bytes** as seis fontes da referência para `src/reference-source/` na hora do empacotamento. `.js` ESM de IA tem dependências `ai.js` e `effects.js`; `.cjs` mantém CommonJS das configurações originais.
- `scripts/make-release.mjs`: usa árvore temporária com as seis fontes, registra SHA-256 individual de cada cópia e insere as fontes na lista do manifesto Ed25519 assinado.
- `src/updates.js` e `src/zip-release.js`: só aceitam release/ZIP contendo os seis arquivos de referência quando há um adaptador de catálogo. Continua proibida imagem não autorizada.
- `.github/workflows/aapanel-v2-package.yml`: copia as fontes também para o ZIP de instalação aaPanel e valida o upload/extração isolada.
- `test/reference-source-parity.test.js`: compara campos de cada arma, receitas, paredes, moinhos, limites por grupo, projéteis, alimentos, upgrades, loja e animais com os módulos reais. Testa assinatura, hash e importação fora da árvore `shared`/`server`.

## Provas automatizadas
- Verificação específica de catálogo + assinatura + carregamento isolado: https://github.com/SrTristeSad/Moo-Quest/actions/runs/40040233838 — **sucesso**.
- Empacotamento completo aaPanel com validação do ZIP: https://github.com/SrTristeSad/Moo-Quest/actions/runs/40040220930 — **sucesso**.
- Jogo V2 completo: https://github.com/SrTristeSad/Moo-Quest/actions/runs/40040220933 — **FALHOU**; a branch **não está homologada**.

O sucesso da assinatura em runner é uma prova de geração/verificação de **assinatura de teste**, não publicação de release, não utilização da chave privada real e não implantação na VPS.

## Divergências de jogabilidade NÃO aprovadas (não alterar sem ordem específica)

1. **Veneno dos espinhos.** A referência fornece `pDmg: 5` em `shared/config/items.js:503-508`; o servidor antigo aplica efeitos temporais em `server/src/moomoo/modules/player.js:256-259` e `706-714`. Na V2 `server-v2/src/world.js:1053-1061` procura `recipe.poison.seconds/damage`, enquanto o adaptador lê somente o campo comprovado `pDmg`. O antigo valor V2 de duração de veneno (6 segundos) não foi inventado como dado da referência. **Pendente de autorização para conciliar a semântica**, testes de veneno falham.
2. **Fazendas mine/sapling sem campo `health`.** A definição em `shared/config/items.js:574-593` não tem `health`; a referência atribui `data.health` em `server/src/moomoo/modules/gameObject.js:24`, e golpes no servidor antigo verificam existência de vida em `server/src/moomoo/modules/player.js:649-650`. A V2 `server-v2/src/world.js:661-667` aplica dano numérico ao campo `hp`, antes havia `350` hardcoded. **Não foi fabricado um HP inexistente.** Testes antigos de destruir fazenda falham e exigem decisão de regra.
3. **Dano dos espinhos comuns.** A referência determina `dmg: 20` em `shared/config/items.js:478-482`. A V2 calcula contato em `server-v2/src/world.js:1053`. Testes antigos exigem 10 de dano. A escolha entre preservação do jogo publicado e paridade de referência deve ser documentada antes de nova alteração.
4. **Cura da plataforma.** `shared/config/items.js:649-654` define `healCol: 15`. `server-v2/src/world.js` lê `recipe.heal` e o teste `server-v2/test/special-buildings.test.js:73-90` espera aumento de 10. Mudança de expectativa de gameplay está bloqueada sem aprovação.
5. **Outros efeitos.** `server-v2/src/store.js` retém `HEAD_EFFECTS` e `TAIL_EFFECTS` existentes. Não foram reescritos sem referência validada. Para qualquer diferença futura, apontar linha de `shared/config/store.js` e `server/src/moomoo/modules/effects.js` versus `server-v2/src/store.js`.

### Árvores
O teste `server-v2/test/native-survival-next.test.js:58-70` exige que uma árvore natural dê madeira em repetidos ataques, mantenha objeto/SID/HP, permaneça no mapa e **não use `depleted`**. A rotina de coleta da V2 não teve mecânica alterada.

## Identificação da build realmente rodando na VPS

`server-v2/bootstrap.js:16-24` lê `var/release-state.json` (ou pasta externa de dados definida por `MOO_DATA_DIR`) e inicia **exatamente** `<root>/src/index.js` para `active=builtin` ou `<dataDir>/releases/<active>/src/index.js` para release ativado. O nome da versão assinada e hashes SHA-256 do conteúdo não são automaticamente o SHA de commit Git.

No terminal da VPS, como usuário com permissão para inspecionar o Node:

```bash
ps -eo pid,ppid,args | grep '[n]ode' | grep -E 'bootstrap\.js|src/index\.js'
# Substitua pelo PID do filho que realmente executa src/index.js:
PID=12345
tr '\\0' ' ' < "/proc/$PID/cmdline"; echo
readlink -f "/proc/$PID/cwd"
# Opcional: diretorio do script na linha de comando identifica builtin ou releases/...
```

Depois consulte `release-state.json` no diretório de dados real. Se `active=builtin` e houver `.git` no projeto carregado, execute `git -C <diretório>/server-v2 rev-parse HEAD` (ou na raiz do repositório). Se for um release `active=versão`, verifique seu manifesto Ed25519 e hashes locais. **Se o pacote não registra o Git SHA, não é possível inferi-lo apenas pelo nome da versão.** Não adicionar SHA ao `/ping` sem autorização.

## Arte
Inventário completo de 176 PNGs e origem técnica + seis ausentes em `docs/INVENTARIO-PROVENIENCIA-ARTES-2026-10-23.md`. **Nenhum PNG modificado.** Licença individual não demonstrada.

## Controle de mudanças
Proibido merge na `main`, PR, atualização na VPS, mudanças de protocolo e outras regras de jogo sem nova confirmação explícita. A branch não deve ser publicada como release até a suíte geral voltar a passar com critérios aprovados.
