# e2ectl

`e2ectl` is the command-line interface for managing E2E Networks MyAccount resources from the terminal.

It is built for operators and automation that need:

- saved MyAccount profiles and per-alias defaults
- discovery-first node creation
- node, volume, VPC, and SSH key workflows
- deterministic `--json` output for scripts and agents

## Requirements

- Node.js 18+
- npm

## Install

```bash
npm install -g e2ectl
e2ectl --help
```

If you want prerelease builds, install the `next` dist-tag instead:

```bash
npm install -g e2ectl@next
e2ectl --help
```

## Quickstart

### 1. Import credentials and save a default profile

```bash
e2ectl config import \
  --file ~/Downloads/config.json \
  --default <profile-alias> \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

`<profile-alias>` must match one alias from the downloaded credential file. `<location>` must be `Delhi` or `Chennai`.

### 2. Confirm the saved profile and defaults

```bash
e2ectl config list
```

### 3. Discover valid operating system rows

```bash
e2ectl node catalog os --alias <profile-alias>
```

### 4. Discover exact plan, image, and billing values

```bash
e2ectl node catalog plans \
  --alias <profile-alias> \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04 \
  --billing-type all
```

Use the returned `plan`, `image`, and optional committed plan id exactly as shown.

### 5. Create and inspect a node

```bash
e2ectl node create \
  --alias <profile-alias> \
  --name <node-name> \
  --plan <plan> \
  --image <image>

e2ectl node list --alias <profile-alias>
e2ectl node get <node-id> --alias <profile-alias>
```

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>` using values returned by `node catalog plans`.

If the selected profile already has a saved project id and location, later commands can omit `--project-id` and `--location`.

## Common Workflows

### Nodes

```bash
e2ectl node list --alias <profile-alias>
e2ectl node get <node-id> --alias <profile-alias>
e2ectl node action power-off <node-id> --alias <profile-alias>
e2ectl node action power-on <node-id> --alias <profile-alias>
e2ectl node action save-image <node-id> --name <image-name> --alias <profile-alias>
e2ectl node action vpc attach <node-id> --vpc-id <vpc-id> --alias <profile-alias>
e2ectl node action volume attach <node-id> --volume-id <volume-id> --alias <profile-alias>
e2ectl node action ssh-key attach <node-id> --ssh-key-id <ssh-key-id> --alias <profile-alias>
e2ectl node delete <node-id> --alias <profile-alias>
```

### Volumes

```bash
e2ectl volume plans --alias <profile-alias>
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type hourly \
  --alias <profile-alias>
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type committed \
  --committed-plan-id <committed-plan-id> \
  --post-commit-behavior auto-renew \
  --alias <profile-alias>
e2ectl volume list --alias <profile-alias>
```

If you already know the target size, use `e2ectl volume plans --size <size-gb> --alias <profile-alias>` to inspect exact committed options first.

### VPCs

```bash
e2ectl vpc plans --alias <profile-alias>
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type hourly \
  --cidr-source e2e \
  --alias <profile-alias>
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type committed \
  --committed-plan-id <committed-plan-id> \
  --post-commit-behavior auto-renew \
  --cidr-source custom \
  --cidr <custom-cidr> \
  --alias <profile-alias>
e2ectl vpc list --alias <profile-alias>
```

### SSH Keys

```bash
e2ectl ssh-key list --alias <profile-alias>
e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file ~/.ssh/id_ed25519.pub \
  --alias <profile-alias>
cat ~/.ssh/id_ed25519.pub | e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file - \
  --alias <profile-alias>
```

## Configuration And Precedence

Profiles are stored in `~/.e2e/config.json`.

Environment variables:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`

Authentication precedence:

1. `E2E_API_KEY` and `E2E_AUTH_TOKEN`
2. the selected alias via `--alias`
3. the default saved alias

Project context precedence:

1. `--project-id` and `--location`
2. `E2E_PROJECT_ID` and `E2E_LOCATION`
3. the selected alias via `--alias`
4. the default saved alias

If you prefer to add a profile manually:

```bash
e2ectl config add \
  --alias <profile-alias> \
  --api-key <api-key> \
  --auth-token <auth-token> \
  --default-project-id <project-id> \
  --default-location <location>
```

## JSON And Automation

- Human-readable output is the default.
- `--json` switches any command to deterministic machine-readable output.
- Discovery and list commands are the safest automation entry points, especially `config list`, `node catalog os`, `node catalog plans`, `node list`, `volume plans`, `volume list`, `vpc plans`, `vpc list`, and `ssh-key list`.

## Safety Notes

- `config import` validates credentials before writing them to disk.
- Saved profiles are written under `~/.e2e/` with restrictive permissions.
- `node delete` prompts unless `--force` is supplied.
- Use discovery commands before create commands so you pass exact plan, image, and committed plan identifiers.

## More Help

```bash
e2ectl --help
e2ectl config --help
e2ectl node --help
e2ectl node catalog plans --help
e2ectl volume --help
e2ectl vpc --help
e2ectl ssh-key --help
```

Contributor and maintainer docs live in [CONTRIBUTING.md](./CONTRIBUTING.md), [docs/MAINTAINING.md](./docs/MAINTAINING.md), and [docs/RELEASING.md](./docs/RELEASING.md).
