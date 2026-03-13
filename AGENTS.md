# e2ectl AGENTS.md

This file is the repo-specific operating guide for `e2ectl`.

The organization-wide `AGENTS.md` remains the baseline. This file keeps the important operating rules that matter inside this repository and removes unrelated company-wide material.

## Scope

- Treat this repository as a TypeScript CLI for E2E Networks MyAccount.
- Current v1 scope includes config/auth management, node commands, VPC commands, SSH key commands, and deterministic `--json` output for automation.
- Keep edits scoped to this repo. Do not make cross-repo changes unless the user explicitly asks.

## Working Style

For non-trivial work, follow this lifecycle exactly:

`PLAN -> EXECUTE -> VERIFY -> DOCUMENT -> COMMIT`

Rules:

- Surface assumptions before implementation for non-trivial tasks:

```text
ASSUMPTIONS I'M MAKING:
1. ...
2. ...
-> Correct me now or I'll proceed with these.
```

- If requirements conflict or behavior is ambiguous, stop and ask one precise question.
- Prefer the boring, obvious implementation over clever abstractions.
- Do not introduce placeholder abstractions or speculative patterns.

## Safety Rules

- Never use destructive commands without explicit approval: `git reset --hard`, `git checkout --`, `git restore --source`, broad `rm`.
- Do not revert changes you did not create.
- If unexpected edits appear in files you are actively touching, stop and ask.
- Use `trash` for file deletion workflows when deletion is explicitly required.
- Prefer `rg`/`rg --files` for search.
- Do not hand-edit generated `dist/` output unless the task is specifically about built artifacts or release packaging.

## Canonical Commands

Use the Make targets as the default entry points:

- `make dev` - run the CLI in development mode
- `make up` - no-op for this repo
- `make down` - no-op for this repo
- `make lint` - format check, ESLint, and typecheck
- `make test` - unit tests
- `make build` - production compile
- `make _clean` - remove generated artifacts

Additional repo-specific commands:

- `npm run test:integration` - compiled CLI integration lane with fake API and packaging smoke checks
- `npm run test:manual` - opt-in live API checks only
- `npm pack --dry-run` - verify publishable package contents
- `node dist/app/index.js --help` - inspect the built CLI surface

## Verification Contract

Default local gate before handoff:

```bash
make lint
make test
make build
```

Full maintainer/release gate:

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

Rules:

- Do not skip relevant checks silently.
- If a check fails, report the exact command and error text.
- `npm run test:manual` is never part of normal CI. Run it only when the user explicitly asks for live verification.

## Architecture Contract

Keep the source tree organized around these domains:

- `src/app` - bootstrap, Commander wiring, runtime, shared dependencies
- `src/core` - low-level shared primitives only
- `src/myaccount` - transport, API envelope typing, credential validation, centralized API failure handling
- `src/config` - alias storage, imports, default alias/context resolution
- `src/node` - node workflows
- `src/vpc` - VPC workflows
- `src/ssh-key` - SSH key workflows

Rules:

- Commands stay thin; business logic belongs in services.
- Services orchestrate validation, defaults, prompts, and resolution. They should not own rendering.
- Clients own endpoint paths and response parsing.
- Formatters own human-readable output and deterministic `--json` output.
- Keep generic API execution and failure handling centralized in `src/myaccount/transport.ts`.
- Cross-domain imports should go through each domain's `index.ts`.

## Documentation Contract

Update docs whenever behavior changes:

- `README.md` - operator-facing usage and examples
- `CONTRIBUTING.md` - contributor workflow and architecture rules
- `docs/MAINTAINING.md` - CI and maintenance policy
- `docs/RELEASING.md` - release and npm publishing workflow

Rules:

- Every user-visible behavior change requires tests and docs updates.
- Review deterministic `--json` output carefully before changing machine-facing fields.
- Do not hand-edit `CHANGELOG.md` in normal feature work; Release Please owns release-note generation.
- Do not hand-edit `package.json` versions outside the release flow.

## Git And Release Topology

Remotes:

- `origin` -> company GitHub repo: `https://github.com/e2enetworks-oss/e2ectl`
- `personal-origin` -> personal GitHub repo for testing purposes and testing github action workflows and publishing automation : `https://github.com/hitesh9320/e2ectl`

Package naming:

- Company/canonical package: `e2ectl`
- Personal fork test package: `e2ectl-hitesh-test`

Branch roles:

- `develop` - staging branch for pre-v1 integration and hardening
- `main` - release branch

Rules:

- Detect remotes before PR/CI operations.
- Both configured remotes are GitHub remotes, so use `gh` for PR and Actions workflows unless the remote configuration changes.
- Use Conventional Commits for merged work.
- Release Please owns versioning and release PR generation on `main`.
- The canonical public package for v1 is `e2ectl` on the company `origin` remote.
- Use the personal fork/package only when the user explicitly wants fork-specific testing or publish rehearsal.

## Live Testing Credentials

When live API testing is explicitly requested, credentials may be loaded from a local configuration source containing alias-based `api_key` and `auth_token` pairs.

Rules:

- Prefer selecting aliases from local config rather than copying secrets.
- Never print full secrets into logs or output.
- Never commit credentials or local config files.
- Keep live tests read-only unless create/delete operations are explicitly requested.

## Repo-Specific Defaults

- Read `README.md`, `CONTRIBUTING.md`, and the relevant docs before changing behavior you do not fully understand.
- Keep `README.md` focused on operators; keep contributor/release internals in `CONTRIBUTING.md` and `docs/`.
- Keep changes small and reviewable.
