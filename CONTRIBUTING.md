# Contributing

This document is for people changing the `e2ectl` codebase.

If you are using the CLI, start with [README.md](./README.md) and the [user guides](./docs/user-guides/index.md). If you own CI, promotion readiness, or release execution, use [docs/maintainers/maintaining.md](./docs/maintainers/maintaining.md) and [docs/maintainers/releasing.md](./docs/maintainers/releasing.md).

## Requirements

- Node.js 24+
- npm

## Local Setup

```bash
npm install
make lint
make test
make build
npm run docs:check
npm run test:integration
```

Useful commands:

```bash
make dev
make coverage
npm run coverage:unit
npm run coverage:integration
npm pack --dry-run
node dist/app/index.js --help
```

## Branch Target

- `develop` is the normal target for feature work.
- `main` is the release branch.
- Use a release-only branch or PR target only when maintainers explicitly ask for it.

## Repository Layout

```text
src/
  app/
  core/
  myaccount/
  config/
  project/
  node/
  dbaas/
  reserved-ip/
  security-group/
  volume/
  vpc/
  ssh-key/
docs/
  user-guides/
  maintainers/
```

## Architecture Rules

- `command.ts` defines CLI flags and delegates immediately.
- `service.ts` owns validation, defaults, prompts, and orchestration.
- `client.ts` owns reusable API paths and response parsing.
- `formatter.ts` owns human-readable output and deterministic `--json` output.
- `types/` owns interfaces and type aliases only.
- Shared transport and API failure handling stay in `src/myaccount/`.
- Keep changes explicit and local. Avoid speculative abstractions and broad refactors.

For larger command families, prefer these supporting files when the domain needs them:

- `constants.ts`: shared domain constants such as validation patterns, supported option values, and pagination limits. Keep client-only endpoint constants private to `client.ts`.
- `normalizers.ts`: value-level validation and normalization, such as parsing IDs, trimming strings, validating flags, or converting empty API values to `null`.
- `mappers.ts`: structured data mapping, such as API response objects to service command-result objects.

Keep the service readable as orchestration:

```text
normalize input -> call client -> map response -> return command result
```

Type-only files should live under a domain `types/` folder so coverage tools can exclude them consistently.

## Verification Before Review

Run this local gate before asking for review:

```bash
make lint
make test
make build
npm run docs:check
npm run coverage:unit
npm run test:integration
npm pack --dry-run
```

What each command covers:

- `make lint`: Prettier check, ESLint, and TypeScript `--noEmit`
- `make test`: default unit test lane
- `make build`: production build of the CLI
- `npm run docs:check`: repo-local Markdown link and anchor verification
- `npm run coverage:unit`: unit coverage gate
- `npm run test:integration`: integration suite against the built CLI
- `npm pack --dry-run`: publishable package preview

## Testing Expectations

- Put unit tests under `tests/unit/<domain>/`.
- Put integration tests under `tests/integration/<domain>/`.
- Update tests in the domain you changed.
- Treat `--json` output as a contract.
- Manual live lanes are opt-in only. Do not run destructive live smoke as part of normal feature work.
- For exact live-lane commands and env contracts, use [docs/maintainers/maintaining.md](./docs/maintainers/maintaining.md).

## Documentation Contract

Route updates by audience:

- [README.md](./README.md) is the product-facing front door for operators and evaluators.
- [docs/user-guides/](./docs/user-guides/index.md) is the canonical home for operator task guides, command-family guides, troubleshooting, and automation recipes.
- [CONTRIBUTING.md](./CONTRIBUTING.md) is the canonical home for contributor workflow, architecture, and verification expectations.
- [docs/maintainers/](./docs/maintainers/maintaining.md) is the canonical home for CI policy, promotion readiness, and release runbooks.

Keep one canonical home for each recurring fact. Prefer linking to the source-of-truth page instead of re-explaining the same workflow in multiple places.

### Docs Safety Contract

- Never use real-looking API keys, auth tokens, or config payloads in examples.
- Always use obvious placeholders such as `<api-key>`, `<auth-token>`, `<project-id>`, and `<node-id>`.
- Never tell users to paste raw secrets or full config files into issues, chats, or troubleshooting output.
- Troubleshooting guidance must explain what to redact before sharing command output.
- Automation examples should avoid patterns that leak secrets into shell history, CI logs, or screenshots.

## Pull Requests

- Keep changes small and reviewable.
- Avoid unrelated cleanup in the same PR.
- Include the verification commands you actually ran.
- Call out any user-visible docs updates.
- Use Conventional Commits such as `feat:`, `fix:`, `refactor:`, or `chore:`.

## Release Automation

- Release Please owns [CHANGELOG.md](./CHANGELOG.md) and package version updates on `main`.
- Do not hand-edit `package.json` versions or changelog entries in normal feature work.
- If release automation changes, update [docs/maintainers/releasing.md](./docs/maintainers/releasing.md) in the same PR.
