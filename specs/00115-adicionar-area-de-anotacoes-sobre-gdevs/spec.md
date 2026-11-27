# 00115 — Adicionar área de anotações sobre gdevs

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115
Estado: fast-track Medium Risk com checkpoint humano aprovado.
Fast-track risk: Medium

## Objetivo
Registrar informações livres sobre cada gdev, permitindo que padrões emerjam do uso sem antecipar campos estruturados.

## Escopo e critérios de aceite
- Nova área Anotações, como área funcional da plataforma, com submenu e acesso restritos ao perfil admin, pelo mecanismo existente.
- Listar os gdevs em ordem alfabética, em cards com nome, avatar circular contendo as iniciais e começo da anotação (prévia curta, sem sintaxe Markdown). Omitir a prévia quando vazia; a primeira linha do nome fica centralizada verticalmente em relação ao avatar, inclusive para nomes longos.
- Selecionar um card abre a ficha individual, inicialmente vazia quando ainda não houver anotação.
- Um único campo por membro, com edição visual de texto rico (negrito, itálico, títulos H1, H2 e H3 e listas), sem mostrar código-fonte. Ao selecionar texto, apresentar menu flutuante de formatação. Reabrir a ficha recupera o conteúdo formatado.
- Salvar automaticamente após alterações, sem indicador de salvamento na ficha; estados de salvamento e falha são exibidos apenas no modal de saída. Não exibir botões Voltar ou Salvar. Navegação de saída durante alterações não persistidas abre modal padronizado de salvamento em curso; após sucesso, prosseguir para o destino. Cancelar mantém a ficha aberta; em caso de falha, oferecer Tentar de novo, sem perder o texto.
- Seguir o padrão visual das Enquetes: marca grande com ícone próprio e letreiro /gdevs/notes na tela principal; marca compacta no submenu fixo da tela secundária, com comportamento de scroll equivalente. Cards e ficha seguem as respectivas superfícies, tipografia e espaçamentos das Enquetes, em mobile e desktop. Durante o carregamento, utilizar esqueletos com o shimmer das Enquetes na lista e na ficha, inclusive enquanto o editor é carregado.
- Fora do escopo: histórico, tags, campos estruturados, fotos, múltiplas anotações e compartilhamento público.

## Risco e aprovação
Fast-track aprovado por um gdev antes da implementação (conversa de 2026-11-27, após avaliação Medium Risk). Um checkpoint humano adicional é obrigatório antes da implementação.

Revisão de escopo solicitada pelo gdev após a abertura do PR #120: paridade visual com Enquetes, prévia nos cards, editor visual e salvamento automático com proteção de navegação. Checkpoint explícito da revisão aprovado em 27/11/2026 (commit c318ed7); a aprovação original fica preservada no histórico.

Refinamentos de interface solicitados diretamente em 27/11/2026, sem alteração do modelo de dados ou autorização: omitir estados vazios e indicadores de salvamento na ficha, alinhar nome/avatar e usar esqueletos. Cobertura automatizada exigida para todos os ajustes.
