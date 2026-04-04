# e2ectl

[![Verify](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml/badge.svg)](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml) [![Coverage](https://codecov.io/gh/e2enetworks-oss/e2ectl/branch/main/graph/badge.svg)](https://codecov.io/gh/e2enetworks-oss/e2ectl) [![Release](https://img.shields.io/github/v/release/e2enetworks-oss/e2ectl)](https://github.com/e2enetworks-oss/e2ectl/releases/latest) [![Docs](https://img.shields.io/badge/docs-blue)](https://github.com/e2enetworks-oss/e2ectl/tree/main/docs) ![Node 24+](https://img.shields.io/badge/node-24%2B-339933?logo=node.js&logoColor=white) ![MIT](https://img.shields.io/badge/license-MIT-blue.svg)

`e2ectl` is the command-line interface for managing [E2E Networks](https://www.e2enetworks.com/) MyAccount resources from the terminal.

It covers nodes, DNS zones and records, reserved IPs, volumes, VPCs, security groups, and SSH keys. The CLI is designed for both operators and automation, with saved profiles, default project/location context, and deterministic `--json` output.

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

### 1. Import credentials

```bash
e2ectl config import --file ~/Downloads/config.json
```

In an interactive terminal, `e2ectl` can also help you choose a default alias plus shared default project and location values.

### 2. Confirm the active profile

```bash
e2ectl config list
```

Once a default alias and default project/location are saved, most commands can omit `--alias`, `--project-id`, and `--location`.

### 3. Discover valid plans, images, and billing options

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

Repeat `--ssh-key-id <ssh-key-id>` to attach one or more saved SSH keys during node creation.

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>` using values from `node catalog plans`.

### 5. Explore the installed help

```bash
e2ectl --help
e2ectl node --help
e2ectl dns --help
e2ectl reserved-ip --help
```

## Common Workflows

### Nodes

```bash
e2ectl node catalog os
e2ectl node catalog plans
e2ectl node list
e2ectl node get <node-id>
e2ectl node action power-off <node-id>
e2ectl node action power-on <node-id>
e2ectl node action save-image <node-id> --name <image-name>
e2ectl node upgrade <node-id> --plan <plan> --image <image>
e2ectl node action vpc attach <node-id> --vpc-id <vpc-id>
e2ectl node action volume attach <node-id> --volume-id <volume-id>
e2ectl node action security-group attach <node-id> --security-group-id <security-group-id>
e2ectl node action ssh-key attach <node-id> --ssh-key-id <ssh-key-id>
e2ectl node action security-group detach <node-id> --security-group-id <security-group-id>
e2ectl node delete <node-id>
e2ectl node delete <node-id> --reserve-public-ip
```

### Volumes

```bash
e2ectl volume plans
e2ectl volume plans --size <size-gb>
e2ectl volume get <volume-id>
e2ectl volume delete <volume-id>
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type hourly
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
e2ectl reserved-ip create
e2ectl reserved-ip reserve node <node-id>
e2ectl reserved-ip attach node <ip-address> --node-id <node-id>
e2ectl reserved-ip detach node <ip-address> --node-id <node-id>
e2ectl reserved-ip delete <ip-address>
```

### DNS

```bash
e2ectl dns list
e2ectl dns get <domain-name>
e2ectl dns create <domain-name> --ip <ipv4>
e2ectl dns delete <domain-name>
e2ectl dns nameservers <domain-name>
e2ectl dns verify ns <domain-name>
e2ectl dns verify validity <domain-name>
e2ectl dns verify ttl <domain-name>
e2ectl dns record list <domain-name>
e2ectl dns record create <domain-name> --type <type> [--name <host>] [type-specific value flags] [--ttl <seconds>]
e2ectl dns record update <domain-name> --type <type> [--name <host>] --current-value <value> [type-specific value flags] [--ttl <seconds>]
e2ectl dns record delete <domain-name> --type <type> [--name <host>] --value <value> [--force]
```

`dns get`, `dns delete`, `dns nameservers`, `dns record ...`, and all `dns verify` commands accept domain names with or without a trailing dot. The CLI canonicalizes domain and record names to lowercase FQDN form internally.

- `--name` defaults to `@`, which means the zone apex.
- Relative names such as `api` become `api.<domain>.`; fully-qualified names are accepted as input.
- `A`, `AAAA`, `CNAME`, and `TXT` records use `--value`.
- `MX` records use `--exchange <host>` plus `--priority <number>`.
- `SRV` records use `--target <host> --priority <number> --weight <number> --port <number>`.
- `TXT` values are quoted for the backend, but `dns record list` shows the unquoted value.
- `CNAME`, `MX`, and `SRV` targets are normalized to trailing-dot form.
- `dns record delete` and `dns record update` target the exact current record value shown by `dns record list`.

`dns get` keeps the raw `domain.rrsets` JSON while also adding derived `domain.nameservers`, `domain.soa`, and flattened `domain.records` fields for scripting.

### VPCs

```bash
e2ectl vpc plans

e2ectl vpc create \
  --name <vpc-name> \
  --billing-type hourly \
  --cidr-source e2e
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

### Security Groups

```bash
e2ectl security-group list
e2ectl security-group get <security-group-id>
e2ectl security-group delete <security-group-id>
e2ectl security-group create \
  --name <security-group-name> \
  --rules-file ./rules.json \
  [--description <text>] \
  [--default]
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
e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file ~/.ssh/id_ed25519.pub
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

Authentication resolves in this order: environment variables (`E2E_API_KEY` + `E2E_AUTH_TOKEN`) -> `--alias` -> default saved alias.

Project context resolves in this order: `--project-id` / `--location` -> environment variables -> `--alias` -> default saved alias.

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

## Documentation

- [Contributing](./CONTRIBUTING.md) — contributor setup, repo structure, tests, and PR expectations
- [Maintaining](./docs/MAINTAINING.md) — CI policy, branch policy, and promotion readiness
- [Releasing](./docs/RELEASING.md) — release flow, publish checks, and manual release verification
