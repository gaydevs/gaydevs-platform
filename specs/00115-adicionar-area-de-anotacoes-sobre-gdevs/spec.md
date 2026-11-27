# 00115 — Adicionar área de anotações sobre gdevs

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115
Estado: High Risk; fast-track interrompido e SDD normal obrigatório.
Fast-track risk: High
## Objetivo
Registrar informações livres sobre cada gdev, permitindo que padrões emerjam do uso sem antecipar campos estruturados.

## Escopo e critérios de aceite
- Nova área Anotações, como área funcional da plataforma, com submenu e acesso restritos ao perfil admin, pelo mecanismo existente.
- Listar os gdevs em ordem alfabética, em cards com nome, avatar circular contendo as iniciais e começo da anotação (prévia curta, sem sintaxe Markdown). Omitir a prévia quando vazia; a primeira linha do nome fica centralizada verticalmente em relação ao avatar, inclusive para nomes longos.
- Selecionar um card abre a ficha individual do autor autenticado, inicialmente vazia quando esse autor ainda não houver criado sua própria anotação sobre o membro.
- Um único campo por combinação de autor autenticado e membro, com edição visual de texto rico (negrito, itálico, títulos H1, H2 e H3 e listas), sem mostrar código-fonte. Ao selecionar texto, apresentar menu flutuante de formatação. Reabrir a ficha recupera o conteúdo formatado.
- Salvar automaticamente após alterações, sem indicador de salvamento na ficha; estados de salvamento e falha são exibidos apenas no modal de saída. Não exibir botões Voltar ou Salvar. Navegação de saída durante alterações não persistidas abre modal padronizado de salvamento em curso; após sucesso, prosseguir para o destino. Cancelar mantém a ficha aberta; em caso de falha, oferecer Tentar de novo, sem perder o texto.
- Seguir o padrão visual das Enquetes: marca grande com ícone próprio e letreiro /gdevs/notes na tela principal; marca compacta no submenu fixo da tela secundária, com comportamento de scroll equivalente. Cards e ficha seguem as respectivas superfícies, tipografia e espaçamentos das Enquetes, em mobile e desktop. Durante o carregamento, utilizar esqueletos com o shimmer das Enquetes na lista e na ficha, inclusive enquanto o editor é carregado.
- Fora do escopo: histórico, tags, campos estruturados, fotos, múltiplas anotações do mesmo autor sobre o mesmo membro e compartilhamento.

## Risco e aprovação
Fast-track aprovado por um gdev antes da implementação (conversa de 2026-11-27, após avaliação Medium Risk). Um checkpoint humano adicional é obrigatório antes da implementação.

Revisão de escopo solicitada pelo gdev após a abertura do PR #120: paridade visual com Enquetes, prévia nos cards, editor visual e salvamento automático com proteção de navegação. Checkpoint explícito da revisão aprovado em 27/11/2026 (commit c318ed7); a aprovação original fica preservada no histórico.

Refinamentos de interface solicitados diretamente em 27/11/2026, sem alteração do modelo de dados ou autorização: omitir estados vazios e indicadores de salvamento na ficha, alinhar nome/avatar e usar esqueletos. Cobertura automatizada exigida para todos os ajustes.

## Revisão de privacidade — isolamento por autor (27/11/2026)

**Estado:** aguardando aprovação humana da spec revisada. As aprovações anteriores não cobrem a alteração de propriedade dos dados.

### Cenários de usuário e critérios de aceite

**P1 — Anotações privadas por autor**
1. Dois admins podem manter anotações independentes sobre o mesmo gdev. Cada um só lê, altera e limpa a própria anotação.
2. Na listagem, cada admin vê somente a prévia da anotação escrita por ele, nunca o conteúdo ou a existência da anotação de outro autor.
3. Ao abrir uma ficha para a qual apenas outro autor possui anotação, o admin vê um campo vazio.
4. O autor é determinado pela sessão autenticada no servidor; parâmetros de cliente não podem selecionar, substituir ou falsificar o autor.
5. Um admin não consegue sobrescrever a anotação de outro por URL direta, payload manipulado ou gravações repetidas.
6. Uma anotação escrita sobre um admin não é visível para esse admin apenas por ele ser o membro anotado.

**P1 — Restrição de acesso**
1. Somente o perfil admin vê o menu e acessa a área.
2. Todos os endpoints de listagem, leitura e gravação exigem autenticação e perfil admin ativo, inclusive por acesso direto.
3. Visitantes, membros comuns e admins inativos não conseguem obter ou alterar notas nem suas prévias.

### Requisitos e limites
- Uma ficha por par (autor, membro); a unicidade deve ser garantida na persistência.
- A identidade do autor nunca é fornecida pelo frontend como fonte de autorização.
- Não introduzir acesso global, compartilhamento ou exceções para admins específicos.
- Não atribuir notas preexistentes de autor desconhecido a um usuário por inferência; preservar dados e não expô-los indevidamente. A estratégia depende da verificação de ambientes e será definida no plano.
- Preservar UI, formatação e autosave já acordados; verificar troca de sessão e ausência de conteúdo residual.
- Testes automatizados obrigatórios para os cenários de autorização, isolamento de leitura/prévia/escrita, unicidade e tentativa de falsificar autor.

### Critérios de sucesso
- Nenhum acesso cruzado entre autores em todos os endpoints; zero possibilidade de sobrescrever outra ficha por troca de parâmetros.
- Regressões de menu, autorização, autosave e persistência aprovadas.
- Nenhum dado legado sem autoria comprovada exposto ou reassociado arbitrariamente.

### Risco
High Risk por alteração de autorização em nível de registro e confidencialidade, conforme constitution. A feature ainda não consta em develop; PR #120 permanece aberto. A implementação desta revisão está pausada até aprovação da spec e, posteriormente, do plano, conforme SDD normal. O plano e tasks anteriores são históricos para o escopo já aprovado, não autorização para esta revisão.
