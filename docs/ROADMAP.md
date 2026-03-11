# e2ectl Prototype Roadmap

## M0 — Scaffold

**Status:** DONE

Acceptance criteria:

- Repository layout, TypeScript toolchain, CI, Make targets, and starter docs exist
- `e2ectl --help` works from the development entrypoint
- `make lint`, `make test`, and `make build` pass locally

## M1 — Config/Auth/Types

**Status:** DONE

Acceptance criteria:

- Config file types and filesystem store support `~/.e2e/config.json`
- Auth resolution supports env overrides plus profile/default fallback
- Secrets can be masked for display
- Deterministic JSON formatting exists for agent-safe output
- Errors are actionable and mapped to stable exit codes

## M2 — API Client

**Status:** DONE

Acceptance criteria:

- Internal client injects bearer auth and required query params
- API envelope parsing checks `code`, `message`, `errors`, and `data`
- Network, auth, and API failures map to actionable CLI errors

## M3 — Config Commands

**Status:** DONE

Acceptance criteria:

- `config add`, `list`, `set-default`, and `remove` are implemented
- Credentials are validated before save
- List output masks secrets in human mode and is deterministic in JSON mode

## M4 — Node Read Commands

**Status:** DONE

Acceptance criteria:

- `node list` and `node get` are implemented
- Human output uses stable table columns
- `--json` output is deterministic and script-friendly

## M5 — Node Write Commands

**Status:** PENDING

Acceptance criteria:

- `node create` and `node delete` are implemented
- Create uses sensible defaults for non-required fields
- Delete confirms unless `--force`

## M6 — Test Suite

**Status:** PENDING

Acceptance criteria:

- Unit tests cover config CRUD, auth resolution, formatter behavior, and command wiring
- Manual read-only e2e tests exist and are skipped in CI
- Test setup avoids touching the real home directory

## M7 — CI/Docs/Polish

**Status:** PENDING

Acceptance criteria:

- README and CONTRIBUTING fully describe install, config, and command usage
- CI covers the intended Node.js matrix and repository gates
- Release and maintenance docs are sufficient for external contributors
