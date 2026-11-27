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

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
