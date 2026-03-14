# e2ectl

`e2ectl` is a command-line interface for managing E2E Networks MyAccount resources from the terminal.

Current v1 scope:

- local profile and auth management
- node read commands
- node catalog discovery for valid plan and image pairs
- node create and delete commands
- block storage volume list, plan discovery, and create commands
- VPC list, plan discovery, and create commands
- SSH key list and create commands
- deterministic `--json` output for automation

## Requirements

- Node.js 18+
- npm

## Install

After the first public npm release:

```bash
npm install -g e2ectl
e2ectl --help
```

To try prereleases such as `1.0.0-rc.1`:

```bash
npm install -g e2ectl@next
e2ectl --help
```

Until the public npm package is live, install from this repository:

```bash
npm install
make build
npm link
e2ectl --help
```

For contributor and maintainer workflows, use:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [docs/MAINTAINING.md](./docs/MAINTAINING.md)
- [docs/RELEASING.md](./docs/RELEASING.md)

## Quickstart

The intended operator flow is:

1. import a downloaded credential file
2. save a default alias, project id, and location
3. use the catalog commands to discover a valid OS, plan, and image
4. create a node
5. inspect the result

### 1. Import credentials

Interactive setup:

```bash
e2ectl config import --file ~/Downloads/config.json
```

Non-interactive setup:

```bash
e2ectl config import \
  --file ~/Downloads/config.json \
  --default prod \
  --default-project-id 46429 \
  --default-location Delhi \
  --no-input
```

### 2. Confirm what was saved

```bash
e2ectl config list
e2ectl config list --json
```

If you need to change saved defaults later:

```bash
e2ectl config set-default --alias prod
e2ectl config set-context \
  --alias prod \
  --default-project-id 46429 \
  --default-location Delhi
```

### 3. Discover valid OS rows

```bash
e2ectl node catalog os --alias prod
```

### 4. Discover valid plan and image pairs

Choose one OS row from the previous command and use those exact values here:

```bash
e2ectl node catalog plans \
  --alias prod \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04
```

### 5. Create a node

Use the exact `plan` and `image` values returned by `node catalog plans`:

```bash
e2ectl node create \
  --alias prod \
  --name demo-node \
  --plan <exact-plan-from-catalog> \
  --image <exact-image-from-catalog>
```

### 6. Inspect nodes

```bash
e2ectl node list --alias prod
e2ectl node get <node-id> --alias prod
```

If the selected alias already has a saved project id and location, later node commands can omit `--project-id` and `--location`.

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

You can also add a profile manually:

```bash
e2ectl config add \
  --alias prod \
  --api-key <api-key> \
  --auth-token <bearer-token> \
  --default-project-id <project-id> \
  --default-location Delhi
```

The API key and bearer token are validated before the profile is saved. Default project and location are optional per-alias execution defaults, not part of the auth identity.

## Common Commands

Use the built-in help for the full surface:

```bash
e2ectl --help
e2ectl config --help
e2ectl node --help
e2ectl volume --help
```

Common day-to-day commands:

```bash
e2ectl config list
e2ectl node list
e2ectl node get <node-id>
e2ectl node catalog os
e2ectl node catalog plans --display-category <value> --category <value> --os <value> --os-version <value>
e2ectl node create --name <name> --plan <plan> --image <image>
e2ectl node delete <node-id> --force
e2ectl volume list
e2ectl volume plans
e2ectl vpc list
e2ectl vpc plans
e2ectl ssh-key list
```

## Volume Workflow

Volume creation is discovery-first:

1. inspect existing volumes
2. inspect valid sizes, derived IOPS, and committed options
3. choose a listed size in GB
4. let the CLI derive IOPS from that size automatically
5. pass a committed plan id only when using committed billing
6. create the volume explicitly

List volumes:

```bash
e2ectl volume list
e2ectl volume list --json
```

Inspect volume plans before creating one:

```bash
e2ectl volume plans
e2ectl volume plans --available-only
e2ectl volume plans --size 250
e2ectl volume plans --json
```

`volume plans` stays compact by default for large catalogs.
Use `--size` to inspect one GB size with exact committed pricing, and `--available-only` to hide unavailable inventory rows.

Create an hourly volume:

```bash
e2ectl volume create \
  --name data-01 \
  --size 250 \
  --billing-type hourly
```

Create a committed volume:

```bash
e2ectl volume create \
  --name analytics-data \
  --size 250 \
  --billing-type committed \
  --committed-plan-id 31 \
  --post-commit-behavior auto-renew
```

`--name`, `--size`, and `--billing-type` are always required.
`--committed-plan-id` is required only for `--billing-type committed`.
The CLI does not expose `--iops`; it derives IOPS automatically from the selected size plan returned by `volume plans`.

## VPC Workflow

VPC creation is discovery-first:

1. inspect existing VPCs
2. inspect hourly and committed billing options
3. create the VPC with explicit billing and CIDR choices

List VPCs:

```bash
e2ectl vpc list
e2ectl vpc list --json
```

Inspect VPC billing options before creating one:

```bash
e2ectl vpc plans
e2ectl vpc plans --json
```

Create a VPC with an E2E-provided CIDR:

```bash
e2ectl vpc create \
  --name prod-vpc \
  --billing-type hourly \
  --cidr-source e2e
```

Create a VPC with a custom CIDR and committed billing:

```bash
e2ectl vpc create \
  --name analytics-vpc \
  --billing-type committed \
  --committed-plan-id 91 \
  --post-commit-behavior auto-renew \
  --cidr-source custom \
  --cidr 10.10.0.0/23
```

Committed billing also works with `--cidr-source e2e`; only `--cidr-source custom` requires `--cidr`.

`--cidr-source` is always required.
If you choose `--cidr-source custom`, you must also pass `--cidr`.
If you choose `--billing-type committed`, you must also pass `--committed-plan-id`.

## SSH Key Workflow

List SSH keys:

```bash
e2ectl ssh-key list
e2ectl ssh-key list --json
```

Create an SSH key from a file:

```bash
e2ectl ssh-key create \
  --label admin-laptop \
  --public-key-file ~/.ssh/id_ed25519.pub
```

Create an SSH key from stdin:

```bash
cat ~/.ssh/id_ed25519.pub | \
  e2ectl ssh-key create \
    --label admin-laptop \
    --public-key-file -
```

## JSON And Automation

- Human-readable output is the default.
- `--json` emits deterministic JSON intended for scripts and agents.
- This package is still pre-release, so new domains can redesign accidental internal shapes before `1.0.0`.
- Once a `--json` shape is merged, treat it as the current contract and review it carefully before changing it.
- Use `config list --json`, `node list --json`, `node get --json`, `volume list --json`, `volume plans --json`, and other discovery commands with `--json` for automation-safe output.

## Safety Notes

- Saved credentials are written to `~/.e2e/` with restrictive directory and file permissions.
- `config import` validates alias and default state before writing, so failed imports do not partially persist.
- Blank aliases are rejected before validation or persistence.
- `node delete` prompts for confirmation unless `--force` is supplied.
- MyAccount API failures are handled centrally and surfaced as actionable CLI errors.

## Where To Look Next

- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor workflow, architecture rules, and test expectations
- [docs/MAINTAINING.md](./docs/MAINTAINING.md) for CI, staging, and maintenance policy
- [docs/RELEASING.md](./docs/RELEASING.md) for versioning, release automation, and npm publishing
