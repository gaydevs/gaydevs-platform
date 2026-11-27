# 00115 — Adicionar área de anotações sobre gdevs

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115
Estado: High Risk; spec e plano do refinamento aprovados.
Fast-track risk: High
## Objetivo
Registrar informações livres sobre cada gdev, permitindo que padrões emerjam do uso sem antecipar campos estruturados.

## Escopo e critérios de aceite
- Nova área Anotações, como área funcional da plataforma, com submenu e acesso restritos ao perfil admin, pelo mecanismo existente.
- Listar os gdevs em ordem alfabética, em cards com nome, avatar circular contendo as iniciais e começo da anotação (prévia curta, sem sintaxe Markdown). Omitir a prévia quando vazia; a primeira linha do nome fica centralizada verticalmente em relação ao avatar, inclusive para nomes longos.
- Selecionar um card abre a ficha individual do autor autenticado, inicialmente vazia quando esse autor ainda não houver criado sua própria anotação sobre o membro.
- Um único campo por combinação de autor autenticado e membro, com edição visual de texto rico (negrito, itálico, títulos H1, H2 e H3 e listas), sem mostrar código-fonte. Ao selecionar texto, apresentar menu flutuante de formatação. Reabrir a ficha recupera o conteúdo formatado.
- Salvar automaticamente após alterações, sem indicador de salvamento na ficha; estados de salvamento e falha são exibidos apenas no modal de saída. Não exibir botões Voltar ou Salvar. Navegação de saída durante alterações não persistidas abre modal padronizado de salvamento em curso; após sucesso, prosseguir para o destino. Ignorar prossegue imediatamente sem confirmar a gravação; avisar que alterações pendentes podem não ser salvas. Em caso de falha, oferecer Ignorar e Tentar de novo. Fechar o modal pelo X ou Escape mantém a ficha aberta.
- Seguir o padrão visual das Enquetes: marca grande com ícone próprio e letreiro /gdevs/notes na tela principal; marca compacta no submenu fixo da tela secundária, com comportamento de scroll equivalente. Cards e ficha seguem as respectivas superfícies, tipografia e espaçamentos das Enquetes, em mobile e desktop. Durante o carregamento, utilizar esqueletos com o shimmer das Enquetes na lista e na ficha, inclusive enquanto o editor é carregado.
- Fora do escopo: histórico, tags, campos estruturados, fotos, múltiplas anotações do mesmo autor sobre o mesmo membro e compartilhamento.

## Risco e aprovação
Fast-track aprovado por um gdev antes da implementação (conversa de 2026-11-27, após avaliação Medium Risk). Um checkpoint humano adicional é obrigatório antes da implementação.

Revisão de escopo solicitada pelo gdev após a abertura do PR #120: paridade visual com Enquetes, prévia nos cards, editor visual e salvamento automático com proteção de navegação. Checkpoint explícito da revisão aprovado em 27/11/2026 (commit c318ed7); a aprovação original fica preservada no histórico.

Refinamentos de interface solicitados diretamente em 27/11/2026, sem alteração do modelo de dados ou autorização: omitir estados vazios e indicadores de salvamento na ficha, alinhar nome/avatar e usar esqueletos. Cobertura automatizada exigida para todos os ajustes.

## Revisão de privacidade — isolamento por autor (27/11/2026)

**Estado:** spec revisada aprovada explicitamente por um gdev em 27/11/2026, na conversa após a publicação do commit 4577cea. Aprovação não se estende ao plano técnico.

### Cenários de usuário e critérios de aceite

**P1 — Anotações privadas por autor**
1. Dois admins podem manter anotações independentes sobre o mesmo gdev. Cada um só lê, altera e limpa a própria anotação.
2. Na listagem, cada admin vê somente a prévia da anotação escrita por ele, nunca o conteúdo ou a existência da anotação de outro autor.
3. Ao abrir uma ficha para a qual apenas outro autor possui anotação, o admin vê um campo vazio.
4. O autor é determinado pela sessão autenticada no servidor; parâmetros de cliente não podem selecionar, substituir ou falsificar o autor.
5. Um admin não consegue sobrescrever a anotação de outro por URL direta, payload manipulado ou gravações repetidas.
6. Uma anotação escrita sobre um admin não é visível para esse admin apenas por ele ser o membro anotado.

**P1 — Restrição de acesso**
1. Somente o perfil admin vê o menu e acessa o conteúdo da área. Visitantes em acesso direto à listagem ou ficha recebem o fluxo de login #login, com esqueleto por baixo do modal, conforme Enquetes. Após autenticação, um não admin recebe Área restrita; um admin acessa seu próprio conteúdo. Fechar o login sem autenticar retorna à home.
2. Todos os endpoints de listagem, leitura e gravação exigem autenticação e perfil admin ativo, inclusive por acesso direto.
3. Visitantes, membros comuns e admins inativos não conseguem obter ou alterar notas nem suas prévias.

### Requisitos e limites
- Uma ficha por par (autor, membro); a unicidade deve ser garantida na persistência.
- A identidade do autor nunca é fornecida pelo frontend como fonte de autorização.
- Não introduzir acesso global, compartilhamento ou exceções para admins específicos.
- Funcionalidade ainda não lançada e sem anotações antigas, conforme confirmação do gdev em 27/11/2026. Não há requisito de migração de dados preexistentes.
- Preservar UI, formatação e autosave já acordados; verificar troca de sessão e ausência de conteúdo residual.
- Testes automatizados obrigatórios para os cenários de autorização, isolamento de leitura/prévia/escrita, unicidade e tentativa de falsificar autor.

### Critérios de sucesso
- Nenhum acesso cruzado entre autores em todos os endpoints; zero possibilidade de sobrescrever outra ficha por troca de parâmetros.
- Regressões de menu, autorização, autosave e persistência aprovadas.
- O esquema inicial já nasce com isolamento obrigatório por autor.

### Risco
High Risk por alteração de autorização em nível de registro e confidencialidade, conforme constitution. A feature ainda não consta em develop; PR #120 permanece aberto. Plano revisado aprovado explicitamente por um gdev em 27/11/2026 após commit 38af8fc; implementação autorizada conforme SDD normal. As tasks anteriores são históricas para o escopo já aprovado.


## Refinamento de navegação e atualização da listagem (27/11/2026)

Refinamento aprovado explicitamente pelo gdev em 27/11/2026, na conversa após commit 15eb617, incluindo a possibilidade de perda de alterações ao escolher Ignorar. As aprovações anteriores permanecem válidas para o isolamento por autor.

- Reutilizar a experiência de autenticação obrigatória das Enquetes: durante restauração da sessão e login exibir exclusivamente esqueleto, sem buscar dados privados. Manter a rota original após autenticação; cancelar o login retorna à home da plataforma. Somente após autenticar um não admin exibir Área restrita em modal padronizado sobre o mesmo esqueleto do login; Home, X e Escape retornam à home da plataforma. Não sobrepor os dois modais.
- Substituir o botão Cancelar no modal de saída por Ignorar. Ignorar prossegue imediatamente ao destino original, inclusive histórico/logout, sem confirmação de persistência. Informar possibilidade de perda de alterações pendentes. Uma requisição já recebida pelo servidor pode concluir depois da saída; não iniciar novos envios ou retries da ficha abandonada. X/Escape continuam mantendo a ficha aberta. Sessão divergente não pode salvar em outra conta.
- Atualizar automaticamente a listagem a cada 15 segundos enquanto estiver aberta e visível, além da consulta imediata ao retornar da ficha e ao voltar à aba. Atualização silenciosa sem esqueletos após a carga inicial; preservar lista em falhas transitórias e evitar sobreposição de requisições. Em perda de autorização/troca de sessão, remover conteúdo privado da listagem. Todas as prévias continuam limitadas ao autor autenticado.
- Testes obrigatórios: visitante em ambas as rotas, login/cancelamento/admin/não admin; Ignorar durante gravação pendente, falha, histórico/logout, conclusão tardia e ausência de reenvio; atualização periódica, retorno à lista/aba, falhas, descarte de respostas obsoletas, ausência de requisições concorrentes e isolamento por autor.

Plano do refinamento aprovado explicitamente pelo gdev em 27/11/2026 após commit ff7e31a; implementação autorizada.

Refinamento visual solicitado diretamente pelo gdev: modal Área restrita sobre os esqueletos existentes, com botão Home, sem alteração da política de autorização aprovada. Respostas 403 de leitura usam o mesmo aviso.


## Refinamentos finais de revisão (27/11/2026)

- Listagem responsiva de gdevs e esqueletos: uma coluna abaixo de 640px, duas de 640 a 1023px e três a partir de 1024px; preservar ordenação alfabética, ordem de teclado e prévia de até duas linhas.
- Se o salvamento falhar, manter a proteção de saída mesmo quando o texto atual coincidir com a última versão confirmada: o estado remoto pode ser incerto. Se o logout falhar após Ignorar, restaurar o autosave e a proteção de navegação enquanto a ficha permanecer aberta.
- Preservar a entrada correta do histórico ao atravessar rotas de login com alterações pendentes; permitir salvar, ignorar ou cancelar, com recuperação caso o navegador não confirme a travessia.
- Todos os oito modais existentes devem conter foco por teclado, preservar o fechamento específico de cada modal e compartilhar o ciclo de vida de foco/scroll.
- Colagem sem texto (incluindo imagem) não altera conteúdo nem seleção nem dispara autosave; colagem de texto puro continua disponível.

Refinamentos e respectivos testes autorizados pelo gdev na conversa de 27/11/2026. Correções de revisão não alteram o modelo de dados, contratos de API ou autorização.

## Revisão de integridade concorrente (27/11/2026)

**Estado:** revisão de escopo High Risk; spec aprovada explicitamente pelo gdev em 27/11/2026 na conversa após commit 66c652c. Plano técnico aguarda aprovação separada. Achado Major da segunda revisão CodeRabbit (PR #120, discussão 4723530517). Manter o isolamento por autor e a mesma branch/issue. Não implementar histórico de versões nem polling do editor.

### Critérios de aceite
- Cada ficha tem uma revisão monotônica; uma gravação concorrente baseada em revisão obsoleta não pode sobrescrever uma versão já confirmada. A criação concorrente de uma ficha vazia também respeita essa garantia. O servidor continua responsável pela identidade do autor e pela validação atômica da revisão.
- Ao abrir a ficha, obter conteúdo e revisão; cada autosave usa a revisão conhecida. Atualizar a revisão após confirmação. Sem requisições periódicas ou consultas adicionais no caminho normal de salvamento.
- Diferenciar conflito de versão de perda de sessão/autorização; não retornar dados privados a uma identidade divergente. Em conflito, devolver somente conteúdo e revisão da ficha do autor autenticado.
- Se o conteúdo remoto coincidir com a versão enviada ou com a edição local atual, reconciliar silenciosamente a confirmação quando seguro; preservar alterações locais posteriores. Se houver divergência não reconciliável com segurança, preservar o rascunho e abrir o modal de conflito, suspendendo o autosave.
- Modal de conflito bloqueante no padrão visual existente, sem X, Escape ou fechamento pelo fundo. Exibir que a anotação foi alterada em outra gravação/sessão. Duas ações: Recarregar (descartar local somente após obter o remoto com sucesso) e Sobrescrever (salvar o rascunho local sobre a revisão remota apresentada, mediante escolha explícita do gdev). Sobrescrever também valida a revisão; se houver nova alteração concorrente, manter modal e rascunho, apresentar conflito atualizado e exigir nova escolha. Sem sobrescrita incondicional.
- Enquanto o conflito estiver aberto ou sua resolução em andamento, impedir edição por trás do modal, gravações duplicadas e saída interna silenciosa; preservar a proteção de fechamento/reload da aba e a política de perda de sessão. Não permitir que um salvamento tardio mude o estado de outro editor ou autor. Retomar o autosave normal após resolução bem-sucedida; preservar rascunho e informar falha transitória na resolução, permitindo nova tentativa. Se havia saída pendente, só prosseguir quando a resolução confirmar persistência ou descarte explícito.

### Cenários obrigatórios de teste
1. Criação inicial, edição sequencial, limpeza, unicidade e revisão correta; revisão ausente/inválida; concorrência na criação e na atualização com somente um vencedor atômico (SQLite e MySQL).
2. Gravação antiga B abortada localmente e concluída depois de C, inclusive logout ignorado que falha; B não sobrescreve C. Ordem inversa: B vence, C detecta conflito e mantém rascunho; nunca confirmação falsa. Testar ordem efetiva de persistência, não apenas ordem das respostas.
3. Duas abas do mesmo autor com a mesma revisão: uma salva, outra recebe conflito e mantém sua edição. Dois autores continuam independentes; tentativa de usar identidade ou campos de propriedade indevidos continua bloqueada.
4. Resposta perdida depois de commit: reconciliar conteúdo coincidente, atualizar revisão e preservar edição posterior. Resposta perdida sem commit: retry com revisão conhecida; falhas transitórias preservam rascunho e proteção de saída. Respostas tardias e requisições abortadas não atualizam outra ficha/sessão.
5. Modal: não fecha por X, Escape ou backdrop; foco contido; edição e saída interna bloqueadas; Recarregar e Sobrescrever funcionam; falha de rede em cada ação mantém rascunho; cliques repetidos não duplicam gravação; terceiro write durante sobrescrita gera novo conflito; nenhuma sobrescrita automática de conteúdo diferente. Validar beforeunload e saída pendente durante resolução.
6. Fluxo normal: debounce e autosave serializado, sem polling adicional, sem regressão de login, logout, histórico, editor/Markdown, privacidade e listagem.

Os outros dois achados Minor da segunda revisão (foco anterior ao login e edição após saída aprovada) permanecem em aberto e serão tratados separadamente, sem ampliar a refatoração #122.
