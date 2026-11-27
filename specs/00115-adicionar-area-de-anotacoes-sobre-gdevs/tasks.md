# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115 · Plano: [plan.md](plan.md)

- [x] T001 Validar checkpoint humano Medium Risk antes de implementar.
- [x] T002 Implementar tabela 1:1, modelo, rotas protegidas e validação de conteúdo.
- [x] T003 Implementar submenu, cards alfabéticos e ficha com editor básico responsivo, reutilizando padrões das Enquetes.
- [x] T004 Testar permissões, persistência/limpeza, formatação segura e fluxos mobile/desktop. Testes automatizados aprovados; validação manual informada pelo gdev e layout Chromium validado em nove larguras (T033).
- [x] T005 Executar verificações aplicáveis, revisar diff e publicar PR de trabalho conforme SDD.

## Revisão de escopo após PR #120
- [x] T006 Obter novo checkpoint humano Medium Risk.
- [x] T007 Criar ícone e marca /gdevs/notes; replicar layout principal/secundário de Enquetes e prévia limitada nos cards.
- [x] T008 Integrar editor Tiptap visual com BubbleMenu e serialização Markdown segura.
- [x] T009 Implementar autosave sequencial, estados, proteção de saída e modal de espera/cancelamento/retry.
- [x] T010 Validar acesso, prévia, segurança, formatação, autosave e navegação; verificar layout mobile/desktop; atualizar PR. Validação manual informada pelo gdev; regressões aprovadas e layout da lista validado em Chromium (T033).

## Refinamento visual
- [x] T011 Omitir textos vazios e estados de autosave fora do modal; ajustar alinhamento e esqueletos nas duas telas.
- [x] T012 Cobrir os quatro ajustes com testes automatizados e verificar a geometria do card em navegador. 26 testes frontend relacionados passaram, incluindo os quatro refinamentos e logout. Fixture de layout isolada em Chromium: 320, 390, 768 e 1440 px; primeira linha alinhada ao centro do avatar (0 px de diferença). Revisão visual completa da aplicação ainda pendente.

- [x] T013 Expor H1, H2 e H3 no menu flutuante e testar aplicação, alternância e serialização Markdown de cada nível.

## Isolamento por autor (High Risk)
- [x] T014 Registrar aprovações da spec (4577cea) e plano (38af8fc).
- [x] T015 Corrigir migration inicial, UUIDv7, unicidade e modelo.
- [x] T016 Restringir todos os endpoints ao autor autenticado; validar identidade esperada e campos de propriedade.
- [x] T017 Vincular requisições e autosave ao autor esperado; limpar estado na troca de sessão.
- [x] T018 Testar isolamento, autorização, integridade, troca de sessão e regressões. Backend: 177 passaram, 2 ignorados, 1.097 assertions; frontend: 160 passaram, após repetir dois timeouts sob carga com menos workers. Teste MySQL e revisão visual completa pendentes.
- [x] T019 Executar verificações e publicar revisão no PR #120. Commit ddf7b4c, TypeScript, ESLint nos arquivos alterados, Pint e build aprovados; build alerta para chunk lazy do editor >500 kB. Project retornou a Specifying; revisão seguinte pendente.

## Refinamento de navegação e refresh
- [x] T020 Registrar aprovação da spec (15eb617) e plano (ff7e31a).
- [x] T021 Reutilizar login obrigatório e skeleton das seções.
- [x] T022 Implementar Ignorar e invalidar gravações da ficha abandonada.
- [x] T023 Atualizar listagem a cada 15s e ao retornar à aba.
- [x] T024 Testes de integração e regressão, build, publicar revisão. Código publicado em 5e1e8f7; 59 testes diretamente relacionados aprovados, inclusive login, Ignorar, refresh e proteção de sessão; backend 177 passaram, 2 ignorados. Suite completa frontend interrompida por timeout do Gateway sob carga; build final não executado nessa tentativa. TypeScript e ESLint aprovados. Project voltou a Backlog e pr-sync recusou a transição naquela tentativa. Pendências de suíte completa/build/MySQL sanadas pela CI verde em f462113.

- [x] T025 Modal Área restrita sobre skeleton, Home/X/Escape, sem sobreposição com login; 48 testes relacionados aprovados (6 novos), TypeScript e ESLint aprovados. Sem mudança de backend.

- [x] T026 Revisar cobertura de comportamento após validação manual do gdev: 27 novos testes frontend (62 + 32 aprovados, 94 no total nesta revisão), demora e erros simulados, retry repetido, Ignorar, formatação, autorização, restauração e refresh; integração com cliente HTTP real e rede simulada. Sem alterar o código de produção. Validação manual de todos os casos informada pelo gdev; automação em navegador real ainda não executada.

- [x] T027 Extrair RestrictedAccessDialog e PendingSaveDialog com ciclo de vida compartilhado, sem alterar comportamento; 53 testes aprovados (5 novos), TypeScript e ESLint aprovados. Refatoração global registrada na issue #122, dependente de #115.

## Revisão final e responsividade
- [x] T028 Preservar estado pendente após falha de gravação (35790c6): 1 novo teste de regressão, 17 relacionados aprovados.
- [x] T029 Recuperar autosave após falha de logout ignorado (17b211e): 6 novos testes, 43 relacionados aprovados.
- [x] T030 Compartilhar histórico de login e proteger restauração/navegação (f5330ea): 9 novos testes, 48 relacionados aprovados.
- [x] T031 Compartilhar ciclo de vida e contenção de foco dos oito modais (5196cf1): 12 novos testes, 105 relacionados aprovados.
- [x] T032 Preservar seleção ao colar conteúdo sem texto (de8a324): 6 novos testes, 47 relacionados aprovados. Cinco threads CodeRabbit resolvidas no GitHub após correções e validação manual.
- [x] T033 Grade responsiva de cards/skeletons (5565471): 2 novos testes, 59 relacionados aprovados; Chromium com dados simulados em 320, 390, 639, 640, 768, 1023, 1024, 1180 e 1440px sem overflow; gdev confirmou teste manual.
- [x] T034 Corrigir SonarQube S3516 e S8786 (f462113): 17 novos testes, 51 relacionados aprovados. SonarQube: S3516, S8786 e S6853 FIXED; Quality Gate aprovado.
- [x] T035 Confirmar CI completa no commit de código f462113: backend SQLite/MySQL, lint/auditoria, frontend testes/lint/auditoria/build, contrato SDD e SonarCloud aprovados. CodeRabbit SKIPPED nessa execução.
- [ ] T036 Nova revisão CodeRabbit do diff atualizado, tratar achados relevantes e obter aprovação humana antes do merge em develop.

## Integridade concorrente (High Risk)
- [x] T037 Registrar aprovação de spec (66c652c) e plano (eb6da36).
- [x] T038 Implementar migration, CAS atômico e contrato de conflito privado. Versionamento inteiro e atualização condicional; criação protegida pela chave única; conflito tipado e conteúdo exato.
- [ ] T039 Testar concorrência real, ordem invertida, autorização e contrato em SQLite/MySQL. Testes implementados; SQLite: 15 testes, 169 assertions, incluindo dois processos independentes para criação/atualização. MySQL aguarda CI.
- [x] T040 Implementar revisão e reconciliação no autosave e cliente HTTP.
- [x] T041 Implementar modal bloqueante, resolução e proteção de rascunho/navegação.
- [ ] T042 Cobrir todos os cenários da spec, executar regressões e publicar evidências. 30 novos testes (6 backend, 24 frontend); 138 testes frontend relacionados aprovados em execuções locais, TypeScript, ESLint e Pint aprovados. Suíte completa local interrompida por EXECUTOR_LOST; dois novos testes App repetidos e aprovados. CI completa, MySQL e validação manual do novo modal pendentes. Dois achados Minor permanecem separados.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
