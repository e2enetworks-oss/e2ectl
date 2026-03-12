# e2ectl

`e2ectl` is an OSS CLI for managing E2E Networks MyAccount resources from the terminal.

Current v1 scope:

- local profile and auth management
- node read commands
- node catalog discovery for valid plan/image pairs
- node create and delete commands
- deterministic `--json` output for automation

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
node dist/app/index.js --help
```

To install the CLI command locally:

```bash
make build
npm link
e2ectl --help
```

For architecture and contribution rules, use [CONTRIBUTING.md](./CONTRIBUTING.md).
For CI and maintenance expectations, use [docs/MAINTAINING.md](./docs/MAINTAINING.md).

## Configuration And Auth

Profiles are stored in `~/.e2e/config.json`:

```json
{
  "profiles": {
    "prod": {
      "api_key": "xxxx",
      "auth_token": "yyyy",
      "default_project_id": "12345",
      "default_location": "Delhi"
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

1. command flags such as `--project-id` and `--location`
2. environment variables
3. selected profile via `--alias`
4. default saved profile

Add a profile:

```bash
e2ectl config add \
  --alias prod \
  --api-key <api-key> \
  --auth-token <bearer-token> \
  --default-project-id <project-id> \
  --default-location Delhi
```

The API key and bearer token are validated before the profile is saved. The default project and location are optional per-alias defaults, not part of the auth identity.

Import one or more aliases from a downloaded credential file:

```bash
e2ectl config import --file ~/Downloads/config.json
```

`e2ectl` reads aliases, API keys, and bearer tokens from the file, can optionally prompt for a default project id and default location to apply to the imported aliases, validates every imported alias, prints a success summary, and then offers to set a default alias if the config does not already have one.

Set a saved profile as the default alias:

```bash
e2ectl config set-default --alias prod
e2ectl config list
```

After that, `node` commands can omit `--alias`. You can also update alias defaults later:

```bash
e2ectl config set-context \
  --alias prod \
  --default-project-id 46429 \
  --default-location Delhi
```

## Command Surface

Config commands:

```bash
e2ectl config add --alias <name> --api-key <key> --auth-token <token> [--default-project-id <id>] [--default-location <Delhi|Chennai>] [--json]
e2ectl config import --file <path> [--default-project-id <id>] [--default-location <Delhi|Chennai>] [--default <alias>] [--force] [--no-input] [--json]
e2ectl config list [--json]
e2ectl config set-context --alias <name> [--default-project-id <id>] [--default-location <Delhi|Chennai>] [--json]
e2ectl config set-default --alias <name> [--json]
e2ectl config remove --alias <name> [--json]
```

Node commands:

```bash
e2ectl node list [--alias <profile>] [--project-id <id>] [--location <Delhi|Chennai>] [--json]
e2ectl node get <node-id> [--alias <profile>] [--project-id <id>] [--location <Delhi|Chennai>] [--json]
e2ectl node catalog os [--alias <profile>] [--project-id <id>] [--location <Delhi|Chennai>] [--json]
e2ectl node catalog plans --display-category <value> --category <value> --os <value> --os-version <value> [--alias <profile>] [--project-id <id>] [--location <Delhi|Chennai>] [--json]
e2ectl node create --name <name> --plan <plan> --image <image> [--alias <profile>] [--project-id <id>] [--location <Delhi|Chennai>] [--json]
e2ectl node delete <node-id> [--alias <profile>] [--project-id <id>] [--location <Delhi|Chennai>] [--force] [--json]
```

Default fields for `node create`:

- `backups=false`
- `disable_password=true`
- `number_of_instances=1`
- `default_public_ip=false`
- `label=default`
- empty `ssh_keys` and `start_scripts`

Recommended flow:

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

For `node catalog os`, the human table hides the `Software Version` column when the API only returns blank values for standard distro rows. The field is still preserved in `--json` output and appears in human output when populated.

## Output And Safety

- Human-readable output is the default.
- `--json` emits deterministic JSON for agents and scripts.
- `config list` masks stored secrets in compact form such as `****e39d`.
- `node delete` prompts for confirmation unless `--force` is supplied.
- MyAccount API requests use bearer auth plus required query parameters on every call.
- API failures are handled centrally in the MyAccount client, with simple fallbacks for inconsistent backend error shapes such as `message`, `detail`, and non-JSON failure bodies.

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

## Source Layout

The v1 source tree is organized by domain:

```text
src/
  app/
  core/
  myaccount/
  config/
  node/
```

- `app/` wires the program and runtime only.
- `core/` holds shared error, JSON, and masking primitives.
- `myaccount/` contains the shared transport, API types, and credential validation.
- `config/` owns aliases, imports, defaults, and auth/context resolution.
- `node/` owns node API parsing, workflows, defaults, and rendering.

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
