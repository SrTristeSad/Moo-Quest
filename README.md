# Moo-Quest

Projeto de cliente desktop em **Lua + LÖVE 2D**, com objetivo de preservar a jogabilidade e os sistemas disponíveis na implementação de referência, antes de personalizar a experiência.

## Referência técnica
- https://github.com/al007ex/moomoo-clone
- O servidor JavaScript e os módulos compartilhados serão auditados para integração, sem assumir que todo o conteúdo do repositório tem direitos de reutilização.
- **Não importar nem redistribuir** `client-official/`, `client-official/source/`, bundles oficiais, marcas ou recursos da FRVR.

## Estratégia de implementação
1. Inventariar mensagens, estados e regras do servidor de referência.
2. Criar cliente nativo com LÖVE 2D e camadas separadas para renderização, entrada, rede e estado.
3. Implementar conexão local e validar a compatibilidade com o servidor.
4. Reproduzir as funcionalidades verificadas, sem substituir recursos por simulações silenciosas.
5. Integrar artes próprias ou licenciadas após os testes de comportamento.

## Situação
**Preparação do repositório.** Ainda não há cliente jogável, servidor integrado nem port completo.

## Plataforma inicial
Windows (LÖVE 2D). Android poderá ser considerado depois.

## Licenciamento
Este repositório não contém código ou recursos do cliente oficial do MooMoo.io. A inclusão de qualquer código de terceiros dependerá da verificação de sua licença e procedência.
