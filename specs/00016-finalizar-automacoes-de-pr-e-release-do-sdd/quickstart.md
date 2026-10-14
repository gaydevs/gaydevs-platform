# Quickstart

This guide is for validating the future implementation of Issue #16. It does not
authorize implementation before plan approval.

## Prerequisites

- GitHub CLI authenticated for normal SDD work.
- Node.js 20+.
- PowerShell 7.
- Current branch:

```sh
git branch --show-current
```

Expected:

```text
techdebt/00016-finalizar-automacoes-de-pr-e-release-do-sdd
```

## Local sandbox validation

Run the official SDD suite:

```sh
node scripts/sdd/test.mjs
```

Expected after implementation:

- Existing SDD tests still pass.
- New PR/release tests run only against fake GitHub.
- No real GitHub network or writes occur.
- Parser `Refs`/`Spec`, PR manual valido, invalid references, terminal states,
  multi-Issue release, deduplication and idempotency are covered.

## PR contract check

Future read-only command shape:

```sh
node scripts/sdd/pr-check.mjs 123
```

Expected:

- Valid manual PR to `develop` with `Refs #ID` and required `Spec: NNNNN` passes.
- PR without Issue reference fails.
- Missing Issue fails.
- Issue outside SDD fails.
- Divergent `Spec` fails.
- Closing keyword for the Issue fails.
- The command performs no Project writes.

This command is the one a future `pull_request` workflow should run as a required
status check on `develop`. The check is an automatic SDD contract guardrail; it
does not replace another gdev's required review before merging to `develop` or
the administrative approval/merge gate for `main`.

## Assisted Project sync

Future work PR sync command:

```sh
node scripts/sdd/pr-sync.mjs 123
```

Expected:

- Open/reopened work PR: `In Progress -> Review`.
- Closed without merge: `Review -> In Progress`.
- Merged to `develop`: `Review -> Ready for Release`.
- Terminal `Rejected`, `Canceled` and `Done` are not reclassified.
- Incompatible non-terminal states fail visibly.

Future release sync command:

```sh
node scripts/sdd/release-sync.mjs 456
```

Expected:

- PR `develop -> main` closed without merge performs no writes.
- PR `develop -> main` merged discovers work PRs by selecting PRs merged into
  `develop` whose GitHub-persisted `merge_commit_sha` is in the release commit
  range, even when the release PR body is empty.
- Eligible Issues in `Ready for Release` become `Done` and close as `completed`.
- Duplicate Issues are applied once.

## Security review checklist

Before opening the implementation PR:

- Confirm the validation workflow uses normal `pull_request`, not a privileged
  PR event.
- Confirm the validation workflow does not move Project cards.
- Confirm no GitHub App or privileged Project token is introduced for Actions.
- Confirm body/comments/titles/branch names are parsed only as data.
- Confirm deploy secrets are not available to the PR validation workflow.
- Confirm `status.mjs` still rejects `Review`, `Ready for Release` and `Done`.

## Reusable SDD infrastructure checklist

For any repository adopting this SDD workflow:

- Confirm Settings > General > Pull Requests keeps Allow merge commits enabled.
- Confirm Allow squash merging is disabled.
- Confirm Allow rebase merging is disabled.
- Keep only merge commits enabled unless the release traceability strategy is
  explicitly replaced by another equivalent strategy.

## E2E technical validation

After sandbox success and human approval of implementation PRs:

1. Create or reuse a controlled technical SDD fixture Issue, not a product Feature.
2. Follow the normal SDD gates with explicit human approvals.
3. Open a work PR to `develop`; it may be manual, but must include `Spec: NNNNN`
   when applicable and `Refs #ID`.
4. Verify the automatic PR check validates the contract.
5. Run the assisted sync command through an agent or manually and verify
   `In Progress -> Review`.
6. Have another gdev review and merge the PR to `develop` using Create a merge
   commit. Squash and rebase are not supported for SDD work PRs in this flow.
7. Run assisted sync and verify `Review -> Ready for Release` and Issue remains
   open.
8. Open the human/admin promotion PR `develop -> main`; the body may be empty.
9. Merge only after the existing human gates.
10. Run release sync and verify it discovers Issues without the release PR body,
    sets `Done`, and closes as `completed`.
11. Record the live validation in `docs/sdd-implementation.md`.

Deploy success is not part of the Done gate for this phase, and deploy failure
must not automatically reopen or reclassify the Issue.
