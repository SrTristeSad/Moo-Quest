# Identidade própria, interoperabilidade e limites da entrega

Esta pasta `server-v2/` foi desenvolvida independentemente do antigo
`server/src/` e do BrowserQuest-Revived: não importa seus módulos, não inclui
assets nem distribui seus scripts. BrowserQuest-Revived foi uma referência de
**infraestrutura de administração e operação**, não de conteúdo do jogo.

## O que NÃO está previsto

- NPCs (personagens não jogáveis com diálogo/comércio/missão), história ou RPG.
- Editor de mapa ou sistema administrativo para modificar o terreno em produção.
- Importação automática de código, pacotes de sprites ou arquivos executáveis
  de outros jogos para o servidor novo.

## O que é necessário para o objetivo solicitado

- Motor servidor Node próprio para partidas multiplayer e PvP, movimentação,
  combate, árvores/pedras, animais, objetos e construções dos jogadores.
- Interface de rede que converse com o **cliente Lua já desenvolvido**;
  substituir todo seu desenho/renderização é fora do escopo.
- Painel de administração, instalador aaPanel, atualizações assinadas por
  nosso projeto, rollback, backups e testes de carga.

## Questões jurídicas

Uma implementação independente reduz a exposição decorrente de copiar código
protegido, mas **não torna o jogo automaticamente livre de reclamações**.
Marcas, identidade visual, nomes, textos, músicas e sprites do cliente antigo
exigem autorização/licença própria e avaliação antes da distribuição.
A reimplementação de formatos técnicos para interoperar deve ser analisada no
contexto jurídico efetivo de exploração do jogo e não equivale a licença sobre
os materiais artísticos.

A Lei brasileira nº 9.609/1998 (art. 6º, III) trata de semelhanças decorrentes
de características funcionais, normas técnicas e ausência de alternativas de
expressão, mas sua incidência depende de fatos concretos. O INPI explica que
proteção do programa recai sobre a expressão literal do código, não sobre
ideias abstratas. Consulte um profissional de propriedade intelectual para
analisar o produto concreto, o cliente e o pacote comercial. Referências:

- https://planalto.gov.br/ccivil_03/leis/l9609.htm
- https://www.gov.br/inpi/pt-br/acesso-a-informacao/perguntas-frequentes/programas-de-computador

## Condição de distribuição

**NÃO publicar o código `server-v2` como servidor de jogo pronto:** a versão
incluída é uma prévia experimental. Os sistemas ainda não têm paridade
integral nem foram submetidos a testes em Windows/LÖVE, análise jurídica,
pen-test, auditoria de carga ou revisão das artes do cliente.

As bibliotecas Node instaladas por npm (`ws`, etc.) têm suas próprias licenças;
confira e distribua os avisos exigidos ao empacotar dependências.
