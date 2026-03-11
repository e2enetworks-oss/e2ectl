# Demo Runbook

This runbook is the operator-facing script for demonstrating the current `e2ectl` CLI against a real MyAccount project.

It assumes:

- Node.js 18+
- npm
- access to a valid MyAccount API key and bearer token
- target project id and location

## Demo Modes

Use one of these two modes:

- repo-local mode: `npm run --silent dev -- ...`
- linked CLI mode: `e2ectl ...`

For first-time setup, use repo-local mode. After `npm link`, either mode works.

## First-Time Setup

From the repository root:

```bash
cd ~/Desktop/E2E/e2ectl
npm install
make build
```

Optional shell install:

```bash
npm link
```

## Load Demo Credentials

If credentials are already saved in `~/.e2e/config.json`, skip to the next section.

Recommended first-time flow:

```bash
npm run --silent dev -- config import --file "/path/to/downloaded-config.json"
```

What happens:

- `e2ectl` reads every alias, API key, and auth token from the file
- optionally prompts for a default `Project ID`
- optionally prompts for a default `Location`
- validates each alias before saving
- prints a success summary
- prompts to set a default alias when the config does not already have one

Example using the local prod credential file:

```bash
npm run --silent dev -- config import --file '/Users/hiteshsadhwani/Downloads/config (4).json'
```

If you prefer a fully non-interactive run:

```bash
npm run --silent dev -- config import \
  --file '/Users/hiteshsadhwani/Downloads/config (4).json' \
  --default-project-id 46429 \
  --default-location Delhi \
  --default prod \
  --no-input
```

If needed, you can still add a single profile manually:

```bash
npm run --silent dev -- config add \
  --alias prod \
  --api-key <api-key> \
  --auth-token <auth-token> \
  --default-project-id 46429 \
  --default-location Delhi
```

Confirm the saved aliases:

```bash
npm run --silent dev -- config list
```

Expected result:

- the imported aliases are present
- the selected default alias is marked as `yes` under `Default`
- masked secrets are compact, for example `****e39d` and `****hUpk`

## Demo Script

### 1. Show top-level help

```bash
npm run --silent dev -- --help
```

### 2. Show node help

```bash
npm run --silent dev -- node --help
```

### 3. Show catalog help

```bash
npm run --silent dev -- node catalog --help
```

### 4. Discover valid OS rows

```bash
npm run --silent dev -- node catalog os
```

For standard distro rows like Ubuntu, Debian, AlmaLinux, and CentOS, the human table usually omits the `Software Version` column because the backend sends that field as blank. If the API returns real software-version values for application-style images, the column appears automatically.

For the current demo, use:

- `display category`: `Linux Virtual Node`
- `category`: `Ubuntu`
- `os`: `Ubuntu`
- `os version`: `24.04`

### 5. Discover valid plan and image pairs

```bash
npm run --silent dev -- node catalog plans \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04
```

Verified low-cost example from the live catalog:

```text
Plan:  C3-4vCPU-8RAM-100DISK-C3-Onetemplate-Ubuntu24.04-Delhi
Image: Ubuntu-24.04-Distro
SKU:   C3.8GB
Price: 2263 INR/month
```

Important:

- always prefer the exact `plan` and `image` values returned by the live catalog
- do not hardcode plan slugs across demos unless you have just verified them from `node catalog plans`

### 6. Create a node

Choose a unique name:

```bash
DEMO_NODE_NAME="demo-node-$(date +%Y%m%d-%H%M%S)"
echo "$DEMO_NODE_NAME"
```

Create the node:

```bash
npm run --silent dev -- node create \
  --name "$DEMO_NODE_NAME" \
  --plan C3-4vCPU-8RAM-100DISK-C3-Onetemplate-Ubuntu24.04-Delhi \
  --image Ubuntu-24.04-Distro
```

Current default fields applied by the CLI:

- `backups=false`
- `disable_password=true`
- `enable_bitninja=false`
- `default_public_ip=false`
- `number_of_instances=1`
- `label=default`
- `ssh_keys=[]`
- `start_scripts=[]`

Fields intentionally omitted and left to backend behavior/defaults:

- `security_group_id`
- `vpc_id`
- `subnet_id`
- `reserve_ip`
- `reserve_ip_pool`
- `image_id`
- `disk`

### 7. Verify the node appears in the list

```bash
npm run --silent dev -- node list
```

### 8. Inspect full node details

Replace `<NODE_ID>` with the id returned from create or seen in `node list`:

```bash
npm run --silent dev -- node get <NODE_ID>
```

### 9. Optional cleanup

If you want to remove the demo node after the walkthrough:

```bash
npm run --silent dev -- node delete <NODE_ID>
```

For non-interactive cleanup:

```bash
npm run --silent dev -- node delete <NODE_ID> --force
```

## Linked CLI Variant

After `npm link`, the same demo can be run without `npm run`:

```bash
e2ectl --help
e2ectl node --help
e2ectl node catalog os
e2ectl node catalog plans \
  --display-category "Linux Virtual Node" \
  --category Ubuntu \
  --os Ubuntu \
  --os-version 24.04
e2ectl node list
```

## Notes For Reviewers

- `config import --file ...` is the recommended first-time setup path
- a default alias set during import means later commands do not need `--alias prod`
- `--project-id` and `--location` can override alias defaults on any node command
- environment variables still override saved profile values
- CI does not run live API integration tests; live verification is manual
- the current CLI has been manually verified for:
  - config profile flow
  - help output
  - OS catalog discovery
  - plan/image discovery
  - real node create
  - real node list/get
