# e2ectl

`e2ectl` is an OSS prototype CLI for managing E2E Networks MyAccount resources from the terminal.

Current prototype scope:

- local profile and auth management
- node read commands
- node catalog discovery for valid plan/image pairs
- node create and delete commands
- deterministic `--json` output for automation

Milestone status is tracked in [docs/ROADMAP.md](./docs/ROADMAP.md).

## Requirements

- Node.js 18+
- npm

## Install And Run

```bash
npm install
make dev
```

For a production build:

```bash
make build
node dist/index.js --help
```

## Configuration And Auth

Profiles are stored in `~/.e2e/config.json`:

```json
{
  "profiles": {
    "prod": {
      "api_key": "xxxx",
      "auth_token": "yyyy",
      "project_id": "12345",
      "location": "Delhi"
    }
  },
  "default": "prod"
}
```

Supported environment overrides:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`

Resolution order is:

1. environment variables
2. selected profile via `--alias`
3. default saved profile

Add a profile:

```bash
e2ectl config add \
  --alias prod \
  --api-key <api-key> \
  --auth-token <bearer-token> \
  --project-id <project-id> \
  --location Delhi
```

Credentials are validated before the profile is saved.

## Command Surface

Config commands:

```bash
e2ectl config add --alias <name> --api-key <key> --auth-token <token> --project-id <id> --location <Delhi|Chennai>
e2ectl config list [--json]
e2ectl config set-default --alias <name> [--json]
e2ectl config remove --alias <name> [--json]
```

Node commands:

```bash
e2ectl node list [--alias <profile>] [--json]
e2ectl node get <node-id> [--alias <profile>] [--json]
e2ectl node catalog os [--alias <profile>] [--json]
e2ectl node catalog plans --display-category <value> --category <value> --os <value> --os-version <value> [--alias <profile>] [--json]
e2ectl node create --name <name> --plan <plan> --image <image> [--alias <profile>] [--json]
e2ectl node delete <node-id> [--alias <profile>] [--force] [--json]
```

Prototype defaults for `node create`:

- `backups=false`
- `disable_password=true`
- `number_of_instances=1`
- `default_public_ip=false`
- `label=default`
- empty `ssh_keys` and `start_scripts`

Recommended prototype flow:

```bash
e2ectl node catalog os --alias prod
e2ectl node catalog plans \
  --alias prod \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04
e2ectl node create \
  --alias prod \
  --name demo-node \
  --plan <exact-plan-from-catalog> \
  --image <exact-image-from-catalog>
```

## Output And Safety

- Human-readable output is the default.
- `--json` emits deterministic JSON for agents and scripts.
- `config list` masks stored secrets.
- `node delete` prompts for confirmation unless `--force` is supplied.
- MyAccount API requests use bearer auth plus required query parameters on every call.

## Development

```bash
npm install
make lint
make test
make build
```

Useful local commands:

```bash
make dev
npm run test:manual
```

## Testing

- `make lint` runs Prettier check, ESLint, and TypeScript typecheck.
- `make test` runs unit tests only.
- `make build` verifies the distributable compile.
- `npm run test:manual` runs read-only live API checks and stays skipped unless `E2ECTL_RUN_MANUAL_E2E=1`.
- The manual suite covers OS catalog discovery, plan/image catalog discovery, and node list by default.

Manual test inputs:

- `E2ECTL_RUN_MANUAL_E2E=1`
- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- optional `E2ECTL_MANUAL_NODE_ID`

## CI

GitHub Actions runs on:

- pushes to `main`
- every `pull_request`

Each CI job uses Node `18`, `20`, or `22` and runs:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`
