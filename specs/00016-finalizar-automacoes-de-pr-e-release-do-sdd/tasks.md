# Tasks

Issue: https://github.com/gaydevs/gaydevs-platform/issues/16 · Plano aprovado: [plan.md](plan.md)
Aprovacao do plan: gdev `luvittor`, 2026-10-13, comentario https://github.com/gaydevs/gaydevs-platform/issues/16#issuecomment-6156088956

## User Stories

- US1: Validar automaticamente o contrato SDD de PRs de trabalho para `develop`, sem mover Project.
- US2: Sincronizar PRs de trabalho para `develop` por comando assistido por agente/gdev.
- US3: Finalizar releases `develop -> main` por comando assistido, descobrindo Issues sem body do PR de release.
- US4: Atualizar documentacao permanente e validar o fluxo tecnico final sem Feature de produto.

## Phase 1: Setup

- [x] T001 Inspect current SDD script exports and gh API helpers in `scripts/sdd/core.mjs`
- [x] T002 [P] Inspect current sandbox fake GitHub state and mutation helpers in `scripts/sdd/sandbox/fake-gh.cjs`
- [x] T003 [P] Inspect current sandbox fixture helpers in `scripts/sdd/sandbox/index.mjs`
- [x] T004 [P] Inspect existing CLI coverage patterns in `scripts/sdd/cli.test.mjs`
- [x] T005 [P] Inspect existing safety guard coverage in `scripts/sdd/safety.test.mjs`
- [x] T006 [P] Inspect current deployment workflow permissions in `.github/workflows/deploy.yml`

## Phase 2: Foundational

- [x] T007 Add shared PR contract parsing helpers for `Refs #ID`, `Spec: NNNNN`, and closing keyword rejection in `scripts/sdd/core.mjs`
- [x] T008 Add shared PR read helpers for GitHub Pull Request payloads and REST pagination in `scripts/sdd/core.mjs`
- [x] T009 Add shared terminal-status and event-transition helpers for `Review`, `Ready for Release`, `Done`, `Rejected`, and `Canceled` in `scripts/sdd/core.mjs`
- [x] T010 Add `setStatusIfNeeded` helper that reads current Project Status before mutating in `scripts/sdd/core.mjs`
- [x] T011 Add `closeCompleted` helper that closes Issues with `state_reason: completed` idempotently in `scripts/sdd/core.mjs`
- [x] T012 Extend fake GitHub fixtures with pull requests, merge commits, release commits, and completed Issue closure in `scripts/sdd/sandbox/index.mjs`
- [x] T013 Extend fake GitHub API routing for pull request reads, PR listings by base/merged state, compare/range commit reads, and completed Issue PATCH in `scripts/sdd/sandbox/fake-gh.cjs`
- [x] T014 Add sandbox mutation assertions for Project Status `Review`, `Ready for Release`, `Done`, and Issue `completed` closure in `scripts/sdd/cli.test.mjs`
- [x] T015 Add regression coverage that `status.mjs` still rejects `Review`, `Ready for Release`, and `Done` as normal manual transitions in `scripts/sdd/cli.test.mjs`

## Phase 3: User Story 1 - PR Contract Guardrail

Goal: a manual or agent-created PR targeting `develop` has a read-only required check that validates SDD traceability without moving Project cards.

Independent test criteria: `node scripts/sdd/test.mjs` covers valid manual PRs, missing references, missing Issues, non-SDD Issues, divergent specs, closing keywords, ambiguous references, and no Project writes from the check.

- [x] T016 [P] [US1] Add tests for valid PR body with one `Refs #ID` and matching `Spec: NNNNN` in `scripts/sdd/pr-check.test.mjs`
- [x] T017 [P] [US1] Add tests for PR without `Refs #ID`, multiple `Refs`, invalid Issue number, and ambiguous references in `scripts/sdd/pr-check.test.mjs`
- [x] T018 [P] [US1] Add tests for missing Issue, PR number instead of Issue, missing SDD marker, and unsupported native type in `scripts/sdd/pr-check.test.mjs`
- [x] T019 [P] [US1] Add tests for missing `Spec: NNNNN` when spec is required and divergent `Spec`/`Refs` IDs in `scripts/sdd/pr-check.test.mjs`
- [x] T020 [P] [US1] Add tests rejecting `Closes`, `Fixes`, `Resolves`, and variants for PRs targeting `develop` in `scripts/sdd/pr-check.test.mjs`
- [x] T021 [US1] Implement read-only `node scripts/sdd/pr-check.mjs PR_NUMERO` command in `scripts/sdd/pr-check.mjs`
- [x] T022 [US1] Wire `pr-check.mjs` to shared contract parser and Issue eligibility validation in `scripts/sdd/pr-check.mjs`
- [x] T023 [US1] Ensure `pr-check.mjs` exits non-zero on invalid contract and performs no GraphQL Project mutations in `scripts/sdd/pr-check.mjs`
- [x] T024 [US1] Add normal `pull_request` workflow for target `develop` that runs `pr-check.mjs` with read-only permissions in `.github/workflows/sdd-pr-check.yml`
- [x] T025 [US1] Add workflow fixture/guard assertions for no Project token, no GitHub App, no privileged PR event, and no Project writes in `scripts/sdd/pr-check.test.mjs`

## Phase 4: User Story 2 - Assisted Work PR Sync

Goal: a gdev or agent can synchronize a real work PR to Project Status without automating review, merge, approval, or release gates.

Independent test criteria: `node scripts/sdd/test.mjs` covers `In Progress -> Review`, `Review -> In Progress`, `Review -> Ready for Release`, terminal no-ops, incompatible-state errors, idempotent reruns, and Issue remaining open after develop merge.

- [x] T026 [P] [US2] Add tests for opened/reopened work PR moving `In Progress -> Review` and `Review -> no-op` in `scripts/sdd/pr-sync.test.mjs`
- [x] T027 [P] [US2] Add tests for closed unmerged work PR moving `Review -> In Progress` in `scripts/sdd/pr-sync.test.mjs`
- [x] T028 [P] [US2] Add tests for merged work PR moving `Review -> Ready for Release` while leaving the Issue open in `scripts/sdd/pr-sync.test.mjs`
- [x] T029 [P] [US2] Add tests for terminal `Rejected`, `Canceled`, and `Done` no-ops in `scripts/sdd/pr-sync.test.mjs`
- [x] T030 [P] [US2] Add tests for incompatible non-terminal states failing visibly without mutation in `scripts/sdd/pr-sync.test.mjs`
- [x] T031 [US2] Implement `node scripts/sdd/pr-sync.mjs PR_NUMERO` command in `scripts/sdd/pr-sync.mjs`
- [x] T032 [US2] Reuse PR contract validation before any Project write in `scripts/sdd/pr-sync.mjs`
- [x] T033 [US2] Implement allowed work PR transition matrix in `scripts/sdd/pr-sync.mjs`
- [x] T034 [US2] Implement idempotent Project Status writes through `setStatusIfNeeded` in `scripts/sdd/pr-sync.mjs`
- [x] T035 [US2] Ensure `pr-sync.mjs` never closes Issues, approves reviews, merges PRs, or records human approval in `scripts/sdd/pr-sync.mjs`

## Phase 5: User Story 3 - Assisted Release Sync

Goal: a gdev or agent can finalize a merged `develop -> main` PR by discovering delivered SDD Issues from work PR `merge_commit_sha` values, then setting `Done` and closing Issues as `completed`.

Independent test criteria: `node scripts/sdd/test.mjs` covers release PR closed without merge no-op, release PR with empty body, multiple Issues, duplicate Issues, terminal states, incompatible states, idempotent reruns, completed closure, and discovery by work PR `merge_commit_sha`.

- [x] T036 [P] [US3] Add tests for `develop -> main` PR closed without merge performing no writes in `scripts/sdd/release-sync.test.mjs`
- [x] T037 [P] [US3] Add tests for release PR body being empty while Issues are discovered from work PRs in `scripts/sdd/release-sync.test.mjs`
- [x] T038 [P] [US3] Add tests selecting PRs merged into `develop` whose GitHub-persisted `merge_commit_sha` is in the release commit set in `scripts/sdd/release-sync.test.mjs`
- [x] T039 [P] [US3] Add tests proving `commits/{sha}/pulls` is not the primary merge commit resolution mechanism in `scripts/sdd/release-sync.test.mjs`
- [x] T040 [P] [US3] Add tests for multiple Issues and deduplication by Issue number in `scripts/sdd/release-sync.test.mjs`
- [x] T041 [P] [US3] Add tests for `Ready for Release -> Done` plus Issue `closed` with `state_reason: completed` in `scripts/sdd/release-sync.test.mjs`
- [x] T042 [P] [US3] Add tests for `Rejected`, `Canceled`, and already `Done` terminal no-ops in `scripts/sdd/release-sync.test.mjs`
- [x] T043 [P] [US3] Add tests for eligible Issues not in `Ready for Release` failing visibly without arbitrary jumps in `scripts/sdd/release-sync.test.mjs`
- [x] T044 [US3] Implement `node scripts/sdd/release-sync.mjs PR_NUMERO` command in `scripts/sdd/release-sync.mjs`
- [x] T045 [US3] Implement release commit range discovery for merged `develop -> main` PRs in `scripts/sdd/release-sync.mjs`
- [x] T046 [US3] Implement paginated PR listing for PRs effectively merged with base `develop` in `scripts/sdd/release-sync.mjs`
- [x] T047 [US3] Filter work PRs by persisted `merge_commit_sha` membership in the release commit set in `scripts/sdd/release-sync.mjs`
- [x] T048 [US3] Reuse PR contract parser to read `Refs #ID` and `Spec: NNNNN` from discovered work PRs in `scripts/sdd/release-sync.mjs`
- [x] T049 [US3] Revalidate each discovered Issue against current GitHub SDD eligibility and Project Status in `scripts/sdd/release-sync.mjs`
- [x] T050 [US3] Apply idempotent `Done` Status and `completed` closure only to Issues currently in `Ready for Release` in `scripts/sdd/release-sync.mjs`
- [x] T051 [US3] Surface partial failures with enough PR/Issue context for safe rerun in `scripts/sdd/release-sync.mjs`

## Phase 6: User Story 4 - Documentation, Sandbox, and E2E

Goal: gdevs and agents can operate the simplified SDD automation with or without IA, and the final technical validation proves the flow without a product Feature.

Independent test criteria: documentation describes the actual commands and merge settings, `node scripts/sdd/test.mjs` passes, and the final E2E uses a technical fixture with human gates preserved.

- [x] T052 [P] [US4] Document PR manual requirements, `Refs #ID`, `Spec: NNNNN`, and assisted sync commands in `CONTRIBUTING.md`
- [x] T053 [P] [US4] Document the Issue -> spec -> plan -> tasks -> PR -> release workflow with optional/recommended agent usage in `docs/development-workflow.md`
- [x] T054 [P] [US4] Document sandbox PR/release coverage, fake GitHub endpoints, and no-network/no-real-write guarantees in `docs/sdd-sandbox.md`
- [x] T055 [P] [US4] Document 2C implementation state, repo merge settings, simplified architecture, and deploy separation in `docs/sdd-implementation.md`
- [x] T056 [P] [US4] Document new official SDD commands and agent responsibilities in `AGENTS.md`
- [x] T057 [P] [US4] Document reusable SDD infrastructure merge settings and onboarding guidance in `docs/development-workflow.md`
- [x] T058 [US4] Audit the historical planning document for still-useful permanent content and migrate it into `CONTRIBUTING.md`, `docs/development-workflow.md`, or `docs/sdd-implementation.md`
- [x] T059 [US4] Remove the historical planning document only after migration is complete and validated
- [x] T060 [US4] Run `node scripts/sdd/test.mjs` and record sandbox results in `docs/sdd-implementation.md`
- [ ] T061 [US4] Execute controlled E2E with technical SDD fixture, manual/agent PR contract validation, assisted `pr-sync`, human review/merge, manual release PR, and assisted `release-sync`
- [ ] T062 [US4] Record E2E evidence, human gate references, and no product Feature scope in `docs/sdd-implementation.md`
- [x] T063 [US4] Verify no frontend/backend functional changes are present in final diff

## Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 blocks US1, US2, and US3.
- US1 should complete before US2 and US3 because `pr-sync` and `release-sync` reuse the PR contract parser.
- US2 should complete before the E2E part of US4 because the E2E needs assisted work PR synchronization.
- US3 should complete before the E2E part of US4 because the E2E needs assisted release finalization.
- Documentation tasks in US4 can run in parallel with implementation after command names and behavior are stable.

## Parallel Execution Examples

- US1: T016, T017, T018, T019, and T020 can run in parallel before T021.
- US2: T026, T027, T028, T029, and T030 can run in parallel before T031.
- US3: T036, T037, T038, T039, T040, T041, T042, and T043 can run in parallel before T044.
- US4: T052, T053, T054, T055, T056, and T057 can run in parallel after command behavior is stable.

## Implementation Strategy

1. MVP first: complete US1 so invalid manual PRs to `develop` are blocked by a read-only guardrail.
2. Add US2 to support assisted Project synchronization for work PRs.
3. Add US3 to support assisted release finalization and completed Issue closure.
4. Finish US4 documentation, sandbox evidence, E2E fixture validation, and historical planning document migration/removal.

## Validation

- [x] Run `node scripts/sdd/test.mjs`
- [x] Confirm all tasks use checked markdown checklist format with IDs and file paths.
- [x] Confirm no Issues were generated automatically from this task list.
- [x] Confirm implementation preserves human gates for spec, plan, review, develop merge, and main release.

Tasks permanecem neste arquivo; não gerar Issues automaticamente.
