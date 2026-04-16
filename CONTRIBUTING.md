# Contributing

This document is for people changing the `e2ectl` codebase.

If you are using the CLI, start with [README.md](./README.md). If you own CI or promotion readiness, use [docs/MAINTAINING.md](./docs/MAINTAINING.md). If you are cutting a release, use [docs/RELEASING.md](./docs/RELEASING.md).

## Requirements

- Node.js 24+
- npm

## Local Setup

```bash
npm install
make lint
make test
make build
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
  reserved-ip/
  security-group/
  volume/
  vpc/
  ssh-key/
```

### Architecture Rules

- `command.ts` defines CLI flags and delegates immediately.
- `service.ts` owns validation, defaults, prompts, and orchestration.
- `client.ts` owns reusable API paths and response parsing.
- `formatter.ts` owns human-readable and `--json` output.
- Shared transport and API failure handling stay in `src/myaccount/`.
- Keep changes explicit and local. Avoid speculative abstractions and broad refactors.

## Verification Before Review

Run this local gate before asking for review:

```bash
make lint
npm run coverage:unit
npm run coverage:integration
env npm_config_cache=/tmp/e2ectl-npm-cache npm pack --dry-run
```

What each command covers:

- `make lint`: Prettier check, ESLint, and TypeScript `--noEmit`
- `npm run coverage:unit`: unit coverage gate
- `npm run coverage:integration`: rebuilds the CLI, runs the integration suite under `c8`, and writes `coverage/integration/lcov.info`
- `npm pack --dry-run`: publishable package preview

## Testing Expectations

- Put unit tests under `tests/unit/<domain>/`.
- Put integration tests under `tests/integration/<domain>/`.
- Update tests in the domain you changed.
- Treat `--json` output as a contract.
- Manual live lanes are opt-in only. Do not run destructive live smoke as part of normal feature work.
- For exact live-lane commands and env contracts, use [docs/MAINTAINING.md](./docs/MAINTAINING.md).

## Documentation Expectations

Update docs by audience:

- [README.md](./README.md) for operators and automation users
- [CONTRIBUTING.md](./CONTRIBUTING.md) for code contributors
- [docs/MAINTAINING.md](./docs/MAINTAINING.md) for maintainers and CI owners
- [docs/RELEASING.md](./docs/RELEASING.md) for release execution

Keep one clear home for each recurring fact. Do not duplicate the same explanation across every doc.

## Pull Requests

- Keep changes small and reviewable.
- Avoid unrelated cleanup in the same PR.
- Include the verification commands you actually ran.
- Call out any user-visible docs updates.
- Use Conventional Commits such as `feat:`, `fix:`, `refactor:`, or `chore:`.

## Release Automation

- Release Please owns [CHANGELOG.md](./CHANGELOG.md) and package version updates on `main`.
- Do not hand-edit `package.json` versions or changelog entries in normal feature work.
- If release automation changes, update [docs/RELEASING.md](./docs/RELEASING.md) in the same PR.
