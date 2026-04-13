# e2ectl

[![Verify](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml/badge.svg)](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml) [![Coverage](https://codecov.io/gh/e2enetworks-oss/e2ectl/branch/main/graph/badge.svg)](https://codecov.io/gh/e2enetworks-oss/e2ectl) [![Release](https://img.shields.io/github/v/release/e2enetworks-oss/e2ectl)](https://github.com/e2enetworks-oss/e2ectl/releases/latest) [![Docs](https://img.shields.io/badge/docs-blue)](https://github.com/e2enetworks-oss/e2ectl/tree/main/docs) ![Node 24+](https://img.shields.io/badge/node-24%2B-339933?logo=node.js&logoColor=white) ![MIT](https://img.shields.io/badge/license-MIT-blue.svg)

`e2ectl` is the command-line interface for managing E2E Networks MyAccount resources from the terminal.

It supports nodes, reserved IPs, volumes, VPCs, security groups, and SSH keys. The CLI is designed for both operators and automation, with saved profiles, default project/location context, and deterministic `--json` output.

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

## Verified Platforms

| Platform | Status                               |
| -------- | ------------------------------------ |
| Linux    | Primary supported platform           |
| macOS    | Build, test, and package verified    |
| Windows  | Install and basic CLI smoke verified |

## Quickstart

### 1. Import credentials

```bash
e2ectl config import --file ~/Downloads/config.json
```

In an interactive terminal, the CLI can also help choose a default alias and shared default project/location values.

### 2. Confirm the active profile

```bash
e2ectl config list
```

Once a default alias and default project/location are saved, most commands can omit `--alias`, `--project-id`, and `--location`.

### 3. Discover valid plans and images

```bash
e2ectl node catalog os

e2ectl node catalog plans \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04 \
  --billing-type all
```

Use `node catalog` before `node create`. It returns the exact `plan`, `image`, and committed plan identifiers the API expects.

### 4. Create a node

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image> \
  [--ssh-key-id <ssh-key-id>]...
```

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>` using values from `node catalog plans`.
For `E1` and `E1WC` plans, also pass `--disk <size-gb>`. Allowed sizes are `75..2400 GB`, in `25 GB` steps below `150 GB` and `50 GB` steps at or above `150 GB`.

## Common Commands

### Nodes

```bash
e2ectl node list
e2ectl node get <node-id>
e2ectl node catalog os
e2ectl node catalog plans --display-category <display-category> --category <category> --os <os> --os-version <os-version>
e2ectl node create --name <name> --plan <plan> --image <image>
e2ectl node upgrade <node-id> --plan <plan> --image <image>
e2ectl node action power-off <node-id>
e2ectl node action power-on <node-id>
e2ectl node action save-image <node-id> --name <image-name>
e2ectl node delete <node-id>
e2ectl node delete <node-id> --reserve-public-ip
```

Node actions also include VPC, volume, security-group, and SSH-key attach or detach flows. Use `e2ectl node action --help` to explore the full action surface.
For `E1` and `E1WC` creates, add `--disk <size-gb>` after selecting the exact plan from `node catalog plans`.

### Networking, Storage, And Access

```bash
e2ectl reserved-ip list
e2ectl reserved-ip get <ip-address>
e2ectl reserved-ip create
e2ectl reserved-ip reserve node <node-id>
e2ectl reserved-ip attach node <ip-address> --node-id <node-id>
e2ectl reserved-ip detach node <ip-address> --node-id <node-id>
e2ectl reserved-ip delete <ip-address>

e2ectl volume plans
e2ectl volume list
e2ectl volume get <volume-id>
e2ectl volume create --name <name> --size <size-gb> --billing-type hourly
e2ectl volume delete <volume-id>

e2ectl vpc plans
e2ectl vpc list
e2ectl vpc get <vpc-id>
e2ectl vpc create --name <name> --billing-type hourly --cidr-source e2e
e2ectl vpc delete <vpc-id>

e2ectl security-group list
e2ectl security-group get <security-group-id>
e2ectl security-group create --name <name> --rules-file ./rules.json
e2ectl security-group update <security-group-id> --name <name> --rules-file ./rules.json
e2ectl security-group delete <security-group-id>

e2ectl ssh-key list
e2ectl ssh-key get <ssh-key-id>
e2ectl ssh-key create --label <label> --public-key-file ~/.ssh/id_ed25519.pub
e2ectl ssh-key delete <ssh-key-id>
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

Authentication resolves in this order:
environment variables (`E2E_API_KEY` + `E2E_AUTH_TOKEN`) -> `--alias` -> default saved alias.

Project context resolves in this order:
`--project-id` / `--location` -> environment variables -> `--alias` -> default saved alias.

## JSON And Automation

Human-readable output is the default. Add `--json` to any command for deterministic machine-readable output.

For non-interactive environments, pass all values explicitly with `--no-input`:

```bash
e2ectl config import \
  --file ~/Downloads/config.json \
  --default <profile-alias> \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

Good automation entry points include:
`config list`, `node catalog os`, `node catalog plans`, `node list`, `reserved-ip list`, `volume plans`, `volume list`, `vpc plans`, `vpc list`, `security-group list`, and `ssh-key list`.

## Documentation

- [Contributing](./CONTRIBUTING.md) — contributor setup, code structure, tests, and PR expectations
- [Maintaining](./docs/MAINTAINING.md) — CI policy, branch policy, promotion readiness, and live verification
- [Releasing](./docs/RELEASING.md) — release execution, publish checks, and release checklist
