# Automation Cookbook

This guide turns the same command model from the interactive docs into safer script and CI patterns.

## Start With The Same Mental Model

- discover exact ids first with list or catalog commands
- store defaults once with `config import --no-input`
- use `--json` when a later step needs machine-readable output
- avoid inline secrets on the command line where they can leak into shell history

## Recipe: Import A Profile Without Prompts

```bash
e2ectl config import \
  --file /secure/path/myaccount-config.json \
  --default ci \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

Use a private file path or a secret-mounted workspace location. Do not paste the raw credential JSON into shared logs.

## Recipe: Capture Discovery Output With `--json`

```bash
e2ectl --json node catalog os > os.json
e2ectl --json node list > nodes.json
e2ectl --json volume plans --size <size-gb> > volume-plans.json
```

Human-readable output is best for operators. `--json` is for automation contracts.

## Recipe: Stay Non-Interactive In CI

Pass explicit values for every command that might otherwise prompt:

```bash
e2ectl config import \
  --file /secure/path/myaccount-config.json \
  --default ci \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input

e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image> \
  --project-id <project-id> \
  --location <location>
```

## Recipe: GitHub Actions Setup

```yaml
- name: Import e2ectl profile
  env:
    HOME: ${{ runner.temp }}/e2ectl-home
    E2E_CONFIG_JSON: ${{ secrets.E2E_CONFIG_JSON }}
    E2E_PROJECT_ID: ${{ secrets.E2E_PROJECT_ID }}
    E2E_LOCATION: ${{ secrets.E2E_LOCATION }}
  run: |
    mkdir -p "$HOME"
    printf '%s' "$E2E_CONFIG_JSON" > "$HOME/myaccount-config.json"
    e2ectl config import \
      --file "$HOME/myaccount-config.json" \
      --default ci \
      --default-project-id "$E2E_PROJECT_ID" \
      --default-location "$E2E_LOCATION" \
      --no-input
```

Keep secrets in the workflow's secret store. Do not echo token values into logs.

## Recipe: Build A Catalog-First Provision Flow

```bash
e2ectl --json node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type hourly > node-plans.json

e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

The exact `plan`, `image`, and committed-plan identifiers should come from the current catalog output for the branch you are operating on.

## Recipe: Create A Node From A Saved Image

```bash
# 1. Find the template_id of the saved image
e2ectl --json image list > images.json

# 2. Create using the same --plan and --image as a regular node create,
#    plus --saved-image-template-id from the Template ID column
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image> \
  --saved-image-template-id <template-id>
```

`--image` is the catalog image identifier (e.g. `Ubuntu-24.04-Distro`), the same value used for a regular node create. `--saved-image-template-id` is the integer `template_id` from `image list` output.

## Recipe: Provision And Inspect A Load Balancer

```bash
# 1. Discover available plans
e2ectl --json load-balancer plans > lb-plans.json

# 2. Create an ALB (plan name from plans output)
e2ectl load-balancer create \
  --name my-alb \
  --plan E2E-LB-2 \
  --mode HTTP \
  --port 80 \
  --backend-name web \
  --server-ip 10.0.0.1 \
  --server-port 8080 \
  --server-name server-1

# 3. List load balancers and capture the id
e2ectl --json load-balancer list > lbs.json
# { "action": "list", "items": [{ "id": 42, "appliance_name": "my-alb", ... }] }

LB_ID=42

# 4. Inspect backend groups
e2ectl --json load-balancer backend group list "$LB_ID"
# { "action": "backend-group-list", "backends": [...], "tcp_backends": [...] }

# 5. Add a second server to an existing group
e2ectl load-balancer backend server add "$LB_ID" \
  --backend-name web \
  --server-ip 10.0.0.2 \
  --server-port 8080 \
  --server-name server-2

# 6. Delete when done
e2ectl load-balancer delete "$LB_ID" --force
```

The `--json` flag on `load-balancer list` returns an object with `action` and `items`. Each item contains `id`, `appliance_name`, `status`, `lb_mode`, `lb_type`, `public_ip`, and `private_ip`.

## Recipe: Keep Cleanup Explicit

Destructive commands should stay obvious and targeted:

```bash
e2ectl reserved-ip delete <ip-address> --force
e2ectl volume delete <volume-id> --force
e2ectl vpc delete <vpc-id> --force
e2ectl ssh-key delete <ssh-key-id> --force
```

Prefer recording the ids you create so teardown steps know exactly what to delete.

## Safety Checklist

- never commit credential files or saved profiles
- never paste raw config JSON into issues or chat
- redact `api_key`, `auth_token`, project ids, and exact resource ids before sharing logs broadly
- keep screenshots focused on the command behavior, not the full terminal history

## Related Guides

- [Quickstart](./quickstart.md)
- [Config](./config.md)
- [Node](./node.md)
- [Load Balancer](./load-balancer.md)
- [Troubleshooting](./troubleshooting.md)
