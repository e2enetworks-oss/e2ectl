# SSL Guide

The `ssl` command group manages SSL certificate metadata from your MyAccount account. It is read-only — certificates are imported through the MyAccount web portal; `e2ectl` lets you discover their IDs so you can reference them when creating or updating load balancers.

Every command accepts `--json` for machine-readable output.

## Before You Start

- Save a default alias and default project/location context, or pass `--alias`, `--project-id`, and `--location` explicitly.
- Certificates must be imported in the MyAccount portal before they appear here.

## List Certificates

```bash
e2ectl ssl list
```

Output columns:

| Column  | Description                                                                          |
| ------- | ------------------------------------------------------------------------------------ |
| ID      | Certificate ID — use this with `--ssl-certificate-id` on `lb create` and `lb update` |
| Name    | Certificate display name                                                             |
| Type    | Certificate type (e.g. `imported`)                                                   |
| State   | Current state (e.g. `active`, `expired`)                                             |
| Domain  | Common name / domain the certificate covers                                          |
| Expires | Expiry date                                                                          |

## Using a Certificate ID with a Load Balancer

Once you have the certificate ID from `ssl list`, pass it when creating or updating an HTTPS or BOTH load balancer:

```bash
# Create an HTTPS load balancer
e2ectl lb create \
  --name secure-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTPS \
  --ssl-certificate-id <id> \
  --backend-group web \
  --backend-protocol HTTPS \
  --backend-server web-1:192.168.1.1:8443

# Switch an existing ALB to HTTPS
e2ectl lb update <lbId> \
  --frontend-protocol HTTPS \
  --ssl-certificate-id <id>

# Enable HTTPS with HTTP redirect
e2ectl lb update <lbId> \
  --frontend-protocol BOTH \
  --ssl-certificate-id <id> \
  --redirect-http-to-https
```

See the [Load Balancer Guide](./load-balancer.md) for full details on LB commands.
