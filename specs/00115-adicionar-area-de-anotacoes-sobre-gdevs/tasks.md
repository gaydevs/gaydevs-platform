# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/115 · Plano: [plan.md](plan.md)

- [x] T001 Validar checkpoint humano Medium Risk antes de implementar.
- [x] T002 Implementar tabela 1:1, modelo, rotas protegidas e validação de conteúdo.
- [x] T003 Implementar submenu, cards alfabéticos e ficha com editor básico responsivo, reutilizando padrões das Enquetes.
- [ ] T004 Testar permissões, persistência/limpeza, formatação segura e fluxos mobile/desktop. Testes automatizados passaram; conferência visual em navegador mobile/desktop pendente.
- [x] T005 Executar verificações aplicáveis, revisar diff e publicar PR de trabalho conforme SDD.

## Revisão de escopo após PR #120
- [x] T006 Obter novo checkpoint humano Medium Risk.
- [x] T007 Criar ícone e marca /gdevs/notes; replicar layout principal/secundário de Enquetes e prévia limitada nos cards.
- [x] T008 Integrar editor Tiptap visual com BubbleMenu e serialização Markdown segura.
- [x] T009 Implementar autosave sequencial, estados, proteção de saída e modal de espera/cancelamento/retry.
- [ ] T010 Validar acesso, prévia, segurança, formatação, autosave e navegação; verificar layout mobile/desktop; atualizar PR. Teste de logout passou; conferência visual completa do app em navegador real pendente.

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
- [ ] T024 Testes de integração e regressão, build, publicar revisão. Código publicado em 5e1e8f7; 59 testes diretamente relacionados aprovados, inclusive login, Ignorar, refresh e proteção de sessão; backend 177 passaram, 2 ignorados. Suite completa frontend interrompida por timeout do Gateway sob carga; build final não executado nessa tentativa. TypeScript e ESLint aprovados. Project voltou a Backlog e pr-sync recusou a transição.

- [x] T025 Modal Área restrita sobre skeleton, Home/X/Escape, sem sobreposição com login; 48 testes relacionados aprovados (6 novos), TypeScript e ESLint aprovados. Sem mudança de backend.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
