# e2ectl AGENTS.md

This guide is for contributors and coding agents working in `e2ectl`.

Keep changes small, reviewable, and aligned with the current CLI behavior.

## Scope

- `e2ectl` is a TypeScript CLI for the E2E Networks MyAccount platform.
- Current v1 surface includes config/auth management, node commands, volume commands, VPC commands, SSH key commands, and deterministic `--json` output for automation.
- Keep edits scoped to this repository unless the user explicitly asks for cross-repo work.

## Working Style

For non-trivial work, follow this lifecycle:

`PLAN -> EXECUTE -> VERIFY -> DOCUMENT -> COMMIT`

Rules:

- Surface assumptions before implementation:

```text
ASSUMPTIONS I'M MAKING:
1. ...
2. ...
-> Correct me now or I'll proceed with these.
```

- If requirements conflict or behavior is ambiguous, stop and ask one precise question.
- Prefer the boring, obvious implementation over clever abstractions.
- Avoid placeholder abstractions, speculative patterns, and opportunistic refactors.

## Safety Rules

- Never use destructive commands without explicit approval, including `git reset --hard`, `git checkout --`, `git restore --source`, or broad file deletion.
- Do not revert changes you did not create.
- If unexpected edits appear in files you are actively touching, stop and ask before proceeding.
- Prefer `rg` and `rg --files` for search.
- Do not hand-edit generated `dist/` output unless the task is specifically about packaging or built artifacts.

## Environment And Verification

- Runtime baseline is Node.js `24+`.
- Default local gate before handoff:

```bash
make lint
make test
make build
```

- Full maintainer/release gate:

```bash
make lint
make test
make build
npm run test:integration
npm run coverage:unit
npm pack --dry-run
```

- Do not skip relevant checks silently.
- If a check fails, report the exact command and error text.
- GitHub CI is centered on the `verify` workflow; keep local verification aligned with that gate.
- `npm run test:manual` is opt-in only and should be run only when live verification is explicitly requested.

## Architecture Contract

Keep the source tree organized around these domains:

- `src/app` - bootstrap, Commander wiring, runtime, shared dependencies
- `src/core` - low-level shared primitives only
- `src/myaccount` - transport, API envelope typing, credential validation, centralized API failure handling
- `src/config` - alias storage, imports, default alias/context resolution
- `src/node` - node workflows
- `src/volume` - block storage workflows
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

- Update docs whenever behavior changes.
- `README.md` is for operators and users.
- `CONTRIBUTING.md` and `docs/` are for contributor and maintenance workflow.
- Treat deterministic `--json` output as a machine-facing contract.
- Do not hand-edit `CHANGELOG.md` or package versions during normal feature work; release automation owns those.

## Git And Release

- Use `gh` for PR and GitHub Actions workflows in this repository.
- Unless the user asks otherwise, raise feature PRs against `develop`.
- Use Conventional Commits when committing.
- Release Please owns versioning and release PRs on `main`.

## Secrets And Live Testing

- Never commit credentials or local config files.
- Never print full secrets in logs or output.
- Live API checks should stay read-only unless create/delete behavior is explicitly requested.
