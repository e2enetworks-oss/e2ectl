# e2ectl

[![Verify](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml/badge.svg)](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml) [![Coverage](https://codecov.io/gh/e2enetworks-oss/e2ectl/branch/develop/graph/badge.svg)](https://codecov.io/gh/e2enetworks-oss/e2ectl/tree/develop) [![Release](https://img.shields.io/github/v/release/e2enetworks-oss/e2ectl)](https://github.com/e2enetworks-oss/e2ectl/releases/latest) [![Docs](https://img.shields.io/badge/docs-blue)](https://github.com/e2enetworks-oss/e2ectl/tree/main/docs) ![Node 24+](https://img.shields.io/badge/node-24%2B-339933?logo=node.js&logoColor=white) ![MIT](https://img.shields.io/badge/license-MIT-blue.svg)

Command-line interface for managing [E2E Networks](https://www.e2enetworks.com/) MyAccount resources from the terminal.

Create and manage nodes, volumes, VPCs, and SSH keys with saved profiles, per-alias defaults, and deterministic `--json` output for scripts and automation.

## Requirements

- Node.js 24+
- npm

## Install

```bash
npm install -g @e2enetworks-oss/e2ectl
e2ectl --help
```

For prerelease builds:

```bash
npm install -g @e2enetworks-oss/e2ectl@next
```

## Quickstart

### 1. Get credentials

Open [E2E MyAccount > API & IAM](https://myaccount.e2enetworks.com/services/apiiam), create an API token, and download the generated config JSON file.

### 2. Import credentials and save a default profile

```bash
e2ectl config import --file ~/Downloads/config.json
```

In an interactive terminal, `e2ectl` can walk you through setting a default alias and shared default project/location values (`Delhi` or `Chennai`).

### 3. Confirm the saved profile

```bash
e2ectl config list
```

Once a default alias and default project/location values are saved, you can omit `--alias`, `--project-id`, and `--location` from subsequent commands. The examples below assume that default context is already active.

### 4. Discover valid plans, images, and billing options

```bash
# List available operating systems
e2ectl node catalog os

# Get exact plan, image, and billing values
e2ectl node catalog plans \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04 \
  --billing-type all
```

Always use `node catalog` before creating a node. It returns the exact `plan`, `image`, and committed plan identifiers you need.

### 5. Create a node

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>` using values from `node catalog plans`.

## Common Workflows

### Nodes

```bash
e2ectl node list
e2ectl node get <node-id>

# Power management
e2ectl node action power-off <node-id>
e2ectl node action power-on <node-id>

# Save a node as a reusable image
e2ectl node action save-image <node-id> --name <image-name>

# Attach resources
e2ectl node action vpc attach <node-id> --vpc-id <vpc-id>
e2ectl node action volume attach <node-id> --volume-id <volume-id>
e2ectl node action ssh-key attach <node-id> --ssh-key-id <ssh-key-id>

# Delete (prompts for confirmation unless --force is passed)
e2ectl node delete <node-id>
```

### Volumes

```bash
# Discover volume plans (optionally filter by size)
e2ectl volume plans
e2ectl volume plans --size <size-gb>

# Inspect or delete one volume
e2ectl volume get <volume-id>
e2ectl volume delete <volume-id>

# Create with hourly billing
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type hourly

# Create with committed billing
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type committed \
  --committed-plan-id <committed-plan-id> \
  --post-commit-behavior auto-renew

e2ectl volume list
```

### VPCs

```bash
e2ectl vpc plans

# Create with E2E-assigned CIDR
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type hourly \
  --cidr-source e2e

# Create with custom CIDR and committed billing
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type committed \
  --committed-plan-id <committed-plan-id> \
  --post-commit-behavior auto-renew \
  --cidr-source custom \
  --cidr <custom-cidr>

e2ectl vpc get <vpc-id>
e2ectl vpc delete <vpc-id>
e2ectl vpc list
```

### SSH Keys

```bash
e2ectl ssh-key list
e2ectl ssh-key get <ssh-key-id>
e2ectl ssh-key delete <ssh-key-id>

# From file
e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file ~/.ssh/id_ed25519.pub

# From stdin
cat ~/.ssh/id_ed25519.pub | e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file -
```

## Configuration

Profiles are stored in `~/.e2e/config.json`.

### Environment Variables

| Variable         | Purpose                       |
| ---------------- | ----------------------------- |
| `E2E_API_KEY`    | API key for authentication    |
| `E2E_AUTH_TOKEN` | Auth token for authentication |
| `E2E_PROJECT_ID` | Default project id            |
| `E2E_LOCATION`   | Default location              |

### Precedence

**Authentication** resolves in this order: environment variables (`E2E_API_KEY` + `E2E_AUTH_TOKEN`) -> `--alias` flag -> default saved alias.

**Project context** resolves in this order: `--project-id` / `--location` flags -> environment variables -> `--alias` flag -> default saved alias.

## JSON and Automation

Human-readable output is the default. Add `--json` to any command for deterministic machine-readable output.

For non-interactive environments (CI, scripts), pass all values explicitly with `--no-input`:

```bash
e2ectl config import \
  --file ~/Downloads/config.json \
  --default <profile-alias> \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

The safest automation entry points are discovery and list commands: `config list`, `node catalog os`, `node catalog plans`, `node list`, `volume plans`, `volume list`, `vpc plans`, `vpc list`, and `ssh-key list`.

## Help

```bash
e2ectl --help
e2ectl config --help
e2ectl node --help
e2ectl node catalog plans --help
e2ectl volume --help
e2ectl vpc --help
e2ectl ssh-key --help
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — development setup, conventions, releasing, and PR process
- [Maintaining](./docs/MAINTAINING.md) — triage, review, and merge guidelines
- [Releasing](./docs/RELEASING.md) — maintainer release runbook and npm publish setup
