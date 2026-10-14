# Contract: SDD PR Contract and Assisted Sync

This contract defines the future command surfaces for the simplified
architecture. GitHub Actions only validates PR metadata. Project synchronization
is explicit and can be run by an agent or manually by a gdev.

## PR Contract Check

Command shape:

```sh
node scripts/sdd/pr-check.mjs PR_NUMERO
```

Expected GitHub Actions use:

- Event: `pull_request`
- Target branch: `develop`
- Writes: none
- Project credentials: none

Validation:

- PR target is `develop`.
- PR body contains exactly one `Refs #ID`.
- Referenced number exists.
- Referenced number is an Issue, not a Pull Request.
- Issue is SDD eligible: native type is known and body marker matches type.
- If the Issue requires spec, PR body contains exactly one `Spec: NNNNN`.
- `Spec: NNNNN` corresponds to the same Issue number as `Refs #ID`.
- PR body does not use `Closes`, `Fixes`, `Resolves` or variants for the Issue.
- Ambiguous or invalid references fail.

Exit behavior:

- `0`: PR contract is valid.
- non-zero: contract invalid, Issue invalid/ineligible, GitHub API failure, or
  unsafe ambiguity.

## Work PR Sync

Command shape:

```sh
node scripts/sdd/pr-sync.mjs PR_NUMERO
```

Preconditions:

- Caller has normal SDD permissions through `gh`.
- The command can read PR, Issue and Project state from GitHub.
- The PR contract check passes.

Effects:

- Open/reopened PR to `develop`:
  - `In Progress -> Review`
  - `Review -> no-op`
- Closed PR to `develop` without merge:
  - `Review -> In Progress`
  - terminal states -> no-op
- Merged PR to `develop`:
  - `Review -> Ready for Release`
  - `Ready for Release -> no-op`
  - Issue remains open

Invalid states:

- Non-terminal states outside the allowed matrix fail visibly.
- The command must not jump arbitrary steps.

## Release Sync

Command shape:

```sh
node scripts/sdd/release-sync.mjs PR_NUMERO
```

Preconditions:

- PR is `develop -> main`.
- Caller has normal SDD permissions through `gh`.
- Release PR may have an empty body.

Effects:

- Closed without merge: no-op.
- Merged:
  - Determine the set of commits delivered by the release range and not already
    in `main` before the release.
  - Query pull requests effectively merged with base `develop`, using REST or
    GraphQL, whichever is simpler and paginates cleanly.
  - Select only work PRs whose GitHub-persisted `merge_commit_sha` belongs to
    the release commit set.
  - Read `Refs #ID` and `Spec: NNNNN` from each work PR.
  - Revalidate each Issue.
  - Deduplicate by Issue number.
  - For each eligible Issue in `Ready for Release`, set Project Status `Done`
    and close Issue as `completed`.

Invalid states:

- `Rejected`, `Canceled` and already `Done` are terminal no-ops.
- Eligible Issues not in `Ready for Release` fail visibly instead of being
  advanced arbitrarily.
- Missing/ambiguous `merge_commit_sha` traceability fails visibly for human
  review.

## Merge Commit Premise

PRs of work branches into `develop` must use Create a merge commit. Squash and
rebase are not supported in this SDD release flow because they remove the chosen
release traceability.

The release sync must not infer delivered Issues from:

- release PR body;
- title;
- similar branch name;
- free-form commit message;
- merge date alone;
- `commits/{sha}/pulls` as the primary way to resolve a merge commit after it has
  reached `main`.

## Idempotency

All commands use `read -> validate -> decide -> write if needed`.

Repeated runs must not duplicate cards, corrupt Status, close Issues twice, or
reopen terminal Issues. Partial release completion must support a safe rerun.
