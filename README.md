# e2ectl

[![Verify](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml/badge.svg)](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml) [![Coverage](https://codecov.io/gh/e2enetworks-oss/e2ectl/branch/main/graph/badge.svg)](https://codecov.io/gh/e2enetworks-oss/e2ectl) [![Release](https://img.shields.io/github/v/release/e2enetworks-oss/e2ectl)](https://github.com/e2enetworks-oss/e2ectl/releases/latest) [![Docs](https://img.shields.io/badge/docs-blue)](https://github.com/e2enetworks-oss/e2ectl/tree/main/docs) ![Node 24+](https://img.shields.io/badge/node-24%2B-339933?logo=node.js&logoColor=white) ![MIT](https://img.shields.io/badge/license-MIT-blue.svg)

Command-line interface for managing [E2E Networks](https://www.e2enetworks.com/) MyAccount resources from the terminal.

Create and manage nodes, forward DNS zones, reserved IPs, volumes, VPCs, security groups, and SSH keys with saved profiles, per-alias defaults, and deterministic `--json` output for scripts and automation.

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

### 1. Import credentials and save a default profile

```bash
e2ectl config import --file ~/Downloads/config.json
```

In an interactive terminal, `e2ectl` can walk you through setting a default alias and shared default project/location values (`Delhi` or `Chennai`).

For profile onboarding, credentials are imported from file.

### 2. Confirm the saved profile

```bash
e2ectl config list
```

Once a default alias and default project/location values are saved, you can omit `--alias`, `--project-id`, and `--location` from subsequent commands. The examples below assume that default context is already active.

### 3. Discover valid plans, images, and billing options

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

### 4. Create a node

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image> \
  [--ssh-key-id <ssh-key-id>]...
```

Repeat `--ssh-key-id <ssh-key-id>` to attach one or more saved SSH keys during node creation.

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

# Upgrade a node plan/image pair using exact values from `e2ectl node catalog plans`
e2ectl node upgrade <node-id> --plan <plan> --image <image>

# Attach resources
# Use the VPC ID shown by `e2ectl vpc create`, `e2ectl vpc get`, or `e2ectl vpc list`
e2ectl node action vpc attach <node-id> --vpc-id <vpc-id>
e2ectl node action volume attach <node-id> --volume-id <volume-id>
e2ectl node action security-group attach <node-id> --security-group-id <security-group-id>
e2ectl node action ssh-key attach <node-id> --ssh-key-id <ssh-key-id>

# Detach security groups
e2ectl node action security-group detach <node-id> --security-group-id <security-group-id>

# Delete (prompts for confirmation unless --force is passed)
e2ectl node delete <node-id>

# Preserve the current public IP as a reserved IP during delete
e2ectl node delete <node-id> --reserve-public-ip
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

### Reserved IPs

```bash
e2ectl reserved-ip list
e2ectl reserved-ip get <ip-address>

# Allocate a new reserved IP from the default network.
e2ectl reserved-ip create

# Preserve a node's current public IP as a reserved IP.
# Pass the normal e2ectl node id; the CLI resolves backend vm_id and public IP internally.
e2ectl reserved-ip reserve node <node-id>

# Attach or detach an existing reserved addon IP using the normal e2ectl node id.
e2ectl reserved-ip attach node <ip-address> --node-id <node-id>
e2ectl reserved-ip detach node <ip-address> --node-id <node-id>

# Delete (prompts for confirmation unless --force is passed)
e2ectl reserved-ip delete <ip-address>
```

### DNS

```bash
e2ectl dns list
e2ectl dns get <domain-name>
e2ectl dns create <domain-name> --ip <ipv4>

# Delete resolves the backend domain_id internally from the public domain name.
# Prompts for confirmation unless --force is passed.
e2ectl dns delete <domain-name>

# Diagnostics
e2ectl dns nameservers <domain-name>
e2ectl dns verify ns <domain-name>
e2ectl dns verify validity <domain-name>
e2ectl dns verify ttl <domain-name>

# Forward records
e2ectl dns record list <domain-name>
e2ectl dns record create <domain-name> --type <type> [--name <host>] [type-specific value flags] [--ttl <seconds>]
e2ectl dns record update <domain-name> --type <type> [--name <host>] --current-value <value> [type-specific value flags] [--ttl <seconds>]
e2ectl dns record delete <domain-name> --type <type> [--name <host>] --value <value> [--force]
```

`dns get`, `dns delete`, `dns nameservers`, `dns record ...`, and all `dns verify` commands accept domain names with or without a trailing dot. The CLI canonicalizes domain and record names to lowercase FQDN form internally.

Record command rules:

- `--name` defaults to `@`, which means the zone apex.
- Relative names such as `api` become `api.<domain>.`; fully-qualified names are accepted as input.
- `A`, `AAAA`, `CNAME`, and `TXT` records use `--value`.
- `MX` records use `--exchange <host>` plus `--priority <number>`.
- `SRV` records use `--target <host> --priority <number> --weight <number> --port <number>`.
- `TXT` values are quoted internally for the backend, but `dns record list` shows the unquoted value.
- `CNAME`, `MX`, and `SRV` targets are normalized to trailing-dot form.
- `dns record delete` and `dns record update` target the exact current record value shown by `dns record list`.

`dns get` keeps the raw `domain.rrsets` JSON while also adding derived `domain.nameservers`, `domain.soa`, and flattened `domain.records` fields for scripting.

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

# Follow-up commands use the VPC ID shown in CLI output. This is the backend `network_id`.
e2ectl vpc get <vpc-id>
e2ectl vpc delete <vpc-id>
e2ectl vpc list
```

### Security Groups

```bash
e2ectl security-group list
e2ectl security-group get <security-group-id>
e2ectl security-group delete <security-group-id>

# Create from a backend-compatible JSON rules file
e2ectl security-group create \
  --name <security-group-name> \
  --rules-file ./rules.json \
  [--description <text>] \
  [--default]

# Update with the full desired rule set
e2ectl security-group update <security-group-id> \
  --name <security-group-name> \
  --rules-file ./rules.json \
  [--description <text>]
```

Example `rules.json`:

```json
[
  {
    "network": "any",
    "rule_type": "Inbound",
    "protocol_name": "Custom_TCP",
    "port_range": "22",
    "description": "ssh"
  },
  {
    "network": "any",
    "rule_type": "Outbound",
    "protocol_name": "All",
    "port_range": "All",
    "description": ""
  }
]
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

The safest automation entry points are discovery and list commands: `config list`, `dns list`, `node catalog os`, `node catalog plans`, `node list`, `reserved-ip list`, `volume plans`, `volume list`, `vpc plans`, `vpc list`, `security-group list`, and `ssh-key list`.

## Help

```bash
e2ectl --help
e2ectl config --help
e2ectl dns --help
e2ectl node --help
e2ectl node catalog plans --help
e2ectl volume --help
e2ectl vpc --help
e2ectl security-group --help
e2ectl ssh-key --help
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — development setup, conventions, releasing, and PR process
- [Maintaining](./docs/MAINTAINING.md) — triage, review, and merge guidelines
- [Releasing](./docs/RELEASING.md) — maintainer release runbook and npm publish setup
