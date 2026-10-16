# Plano técnico

Issue: https://github.com/gaydevs/gaydevs-platform/issues/17 · Spec: [spec.md](spec.md)
Aprovação da spec: gdev `luvittor`, 2026-10-16,
https://github.com/gaydevs/gaydevs-platform/issues/17#issuecomment-6222425865

## Abordagem

Criar `scripts/sdd/pr-create.mjs` para abrir PRs da branch SDD atual para
`develop`, reutilizando as validações e funções de `scripts/sdd/core.mjs`.
Aceitar `--title TITULO` e `--body TEXTO`; sem título, usar o da Issue. Sem
prompts, push, commit ou atualização automática do Project.

O comando extrai da branch um ID de pelo menos cinco dígitos e um prefixo SDD
válido (`feat`, `fix`, `refactor` ou `techdebt`), consulta a Issue e confirma
que está aberta, tem tipo/marcador SDD e corresponde ao prefixo. Resolve a spec
pelo ID: Feature exige `spec.md`; nos demais tipos, a referência é incluída
quando houver uma spec completa. Ambiguidade ou ausência obrigatória interrompe
a operação.

Compor o corpo adicional com `Spec: NNNNN` quando aplicável e `Refs #ID`.
Validar o corpo final antes de qualquer escrita; referências conflitantes,
duplicadas ou closing keywords causam erro, sem remoção silenciosa. A branch
deve já estar publicada. Criar o PR com uma chamada `gh api`, `head` na branch
atual e `base: develop`; exibir falhas da API sem alegar sucesso.

## Arquivos e validação

- Estender `core.mjs` apenas para compartilhar a resolução/validação necessária;
  adicionar `pr-create.mjs` e `pr-create.test.mjs`.
- Adaptar `sandbox/fake-gh.cjs` e `sandbox/index.mjs` para simular a criação e
  permitir validar o PR criado com `pr-check`.
- Documentar uso, branch publicada e gates humanos em
  `docs/development-workflow.md`, `CONTRIBUTING.md` e `docs/sdd-sandbox.md`.
- Cobrir criação com e sem spec, título/body, payload para `develop`, branch ou
  Issue inválida, prefixo incompatível, spec obrigatória ausente/ambígua e body
  conflitante. Confirmar que falhas não fazem POST, PR criado passa no check e
  PR manual continua válido e read-only.
- Executar `node scripts/sdd/test.mjs` e `git diff --check`. A sandbox não
  comprova permissões nem criação real no GitHub e deve continuar bloqueando
  gh real e rede.

## Constitution check e aprovação

Issue, branch e spec mantêm o ID `00017`; não criar Issues/specs adicionais.
Review e merge permanecem humanos; o comando não aprova, revisa, mergeia ou
sincroniza Status.

Spec aprovada por `luvittor` em 2026-10-16 (referência acima). Aprovação do plan
por `luvittor` em 2026-10-16:
https://github.com/gaydevs/gaydevs-platform/issues/17#issuecomment-6222618340
