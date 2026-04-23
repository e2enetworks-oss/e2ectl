# Load Balancer

## What This Command Group Does

The `load-balancer` command group lets you create, list, and delete load balancers on E2E Networks, and manage the backend groups and servers that sit behind them.

Two load balancer types are supported:

| Type                                | Mode flag                  | Layer   | Use case                                                |
| ----------------------------------- | -------------------------- | ------- | ------------------------------------------------------- |
| **ALB** (Application Load Balancer) | `HTTP`, `HTTPS`, or `BOTH` | Layer 7 | HTTP/HTTPS routing, domain-based routing, health checks |
| **NLB** (Network Load Balancer)     | `TCP`                      | Layer 4 | TCP passthrough, port-based routing                     |

---

## Before You Start

- Configure a profile with your API key and auth token: `e2ectl config set`
- List available plans first: `e2ectl load-balancer plans`
- Pick the base plan name you want to create with (for example `ELB-2`).
- If you want committed billing, note the committed option shown under that base plan.
- Use `e2ectl load-balancer plans --json` when you need the committed plan ID.
- For backend servers, have the server IP address and port ready.

---

## Common Tasks

### List Load Balancers

```
e2ectl load-balancer list
```

```
e2ectl load-balancer list --json
```

The table shows ID, Name, Status, Mode, Type, Public IP, and Private IP for each load balancer.

### List Available Load Balancer Plans

First, list available plans to find the base plan you want to use. Each base plan shows its hourly price, monthly price, and any committed options that belong to that SKU:

```
e2ectl load-balancer plans
```

```
e2ectl load-balancer plans --json
```

Use the base plan name from this output with `--plan`. If you want a committed load balancer, add either `--committed-plan <name>` or `--committed-plan-id <id>` during create.

### Create an ALB (HTTP)

Creates an Application Load Balancer that listens on port 80 with one backend group and one server.

```
e2ectl load-balancer create \
  --name my-alb \
  --plan ELB-2 \
  --mode HTTP \
  --port 80 \
  --backend-name web \
  --server-ip 10.0.0.1 \
  --server-port 8080 \
  --server-name server-1
```

### Create an ALB (HTTPS or BOTH)

`--mode HTTPS` and `--mode BOTH` require `--ssl-certificate-id`. Get your certificate ID from the E2E Networks Console.

```
e2ectl load-balancer create \
  --name my-https-alb \
  --plan ELB-2 \
  --mode HTTPS \
  --port 443 \
  --ssl-certificate-id <certId> \
  --backend-name web \
  --server-ip 10.0.0.1 \
  --server-port 8080 \
  --server-name server-1
```

### Create an NLB (TCP)

Creates a Network Load Balancer that passes TCP traffic through on port 80.

```
e2ectl load-balancer create \
  --name my-nlb \
  --plan ELB-2 \
  --mode TCP \
  --port 80 \
  --backend-name tcp-group \
  --server-ip 10.0.0.2 \
  --server-port 8080 \
  --server-name srv-1 \
  --backend-port 8080
```

### Create an Internal Load Balancer (VPC only)

Use `--vpc <networkId>` to attach the load balancer to a VPC — it will be accessible only within that VPC network.

```
e2ectl load-balancer create \
  --name internal-alb \
  --plan ELB-2 \
  --mode HTTP \
  --port 80 \
  --vpc <networkId> \
  --backend-name web \
  --server-ip 10.0.0.1 \
  --server-port 8080 \
  --server-name server-1
```

### Create a Committed Load Balancer

Committed billing is chosen under a base plan. First inspect plans, then create the load balancer with the base SKU in `--plan` and the committed option in `--committed-plan`:

```
e2ectl load-balancer plans
```

```
e2ectl load-balancer create \
  --name committed-alb \
  --plan ELB-2 \
  --committed-plan "90 Days" \
  --post-commit-behavior auto-renew \
  --mode HTTP \
  --port 80 \
  --backend-name web \
  --server-ip 10.0.0.1 \
  --server-port 8080 \
  --server-name server-1
```

If you prefer deterministic scripting, use the committed plan ID from `load-balancer plans --json`:

```
e2ectl load-balancer create \
  --name committed-alb \
  --plan ELB-2 \
  --committed-plan-id 901 \
  --post-commit-behavior hourly-billing \
  --mode HTTP \
  --port 80 \
  --backend-name web \
  --server-ip 10.0.0.1 \
  --server-port 8080 \
  --server-name server-1
```

### List Backend Groups

Shows all backend groups for a load balancer with their routing policy, protocol, health check status, and server count.

```
e2ectl load-balancer backend group list <lbId>
```

```
e2ectl load-balancer backend group list <lbId> --json
```

### List Servers in a Backend Group

Shows all servers within a specific backend group.

```
e2ectl load-balancer backend server list <lbId> <groupName>
```

```
e2ectl load-balancer backend server list <lbId> <groupName> --json
```

### Create a New Backend Group

For ALBs, this adds another backend group. For NLBs, only one backend group is allowed.

```
e2ectl load-balancer backend group create <lbId> \
  --name api \
  --backend-protocol HTTPS \
  --server-ip 10.0.0.9 \
  --server-port 9090 \
  --server-name api-server-1 \
  --algorithm leastconn \
  --http-check
```

### Delete a Backend Group

Removes a backend group and all its servers from the load balancer. The CLI follows the Backend Mapping tab behavior: it refuses to delete the last remaining backend group, and for ALBs it also removes ACL entries that still point at the deleted backend.

```
e2ectl load-balancer backend group delete <lbId> <groupName>
```

### Add a Server to an Existing Backend Group

If the backend group named `web` already exists, the server is appended to it.

```
e2ectl load-balancer backend server add <lbId> \
  --backend-name web \
  --server-ip 10.0.0.5 \
  --server-port 8080 \
  --server-name server-2
```

> **NLB constraint**: NLB supports only one backend group. If you specify a `--backend-name` that differs from the existing group name, the command will error.

### Delete a Server from an Existing Backend Group

Removes a server from a backend group. The CLI refuses to remove the last remaining server from a backend group, matching the Backend Mapping tab flow.

```
e2ectl load-balancer backend server delete <lbId> \
  --backend-name web \
  --server-name server-2
```

If duplicate server names exist in the same backend group, add `--server-ip` and optionally `--server-port` to target one exact server.

### Delete a Load Balancer

```
e2ectl load-balancer delete <lbId>
```

Skip the interactive confirmation prompt with `--force`:

```
e2ectl load-balancer delete <lbId> --force
```

Preserve the public IP as a reserved IP during deletion:

```
e2ectl load-balancer delete <lbId> --force --reserve-public-ip
```

---

## Command Reference

### `e2ectl load-balancer plans`

Lists all available load balancer base plans. Human output shows base plans and committed options in separate tables. Use `--json` when you need committed plan IDs for scripting.

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer list`

Lists all load balancers for the active profile. Columns: ID, Name, Status, Mode, Type, Public IP, Private IP.

**Options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer create`

Creates a new load balancer.

| Flag                                | Required | Description                                                                  |
| ----------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `--name <name>`                     | Yes      | Load balancer name                                                           |
| `--plan <plan>`                     | Yes      | Base plan name (for example `ELB-2`). Run `load-balancer plans` first.       |
| `--mode <mode>`                     | Yes      | `HTTP`, `HTTPS`, `BOTH` (ALB), or `TCP` (NLB)                                |
| `--port <port>`                     | Yes      | Frontend listener port                                                       |
| `--backend-name <name>`             | Yes      | Initial backend group name                                                   |
| `--server-ip <ip>`                  | Yes      | Backend server IP address                                                    |
| `--server-name <name>`              | Yes      | Unique server identifier within the backend group                            |
| `--server-port <port>`              | No       | Backend server port. Defaults to `--port`                                    |
| `--algorithm <algo>`                | No       | `roundrobin` (default), `leastconn`, or `source`                             |
| `--backend-protocol <protocol>`     | No       | `HTTP` (default) or `HTTPS` for the initial ALB backend group                |
| `--http-check`                      | No       | Enable HTTP health checks (ALB only)                                         |
| `--backend-port <port>`             | No       | NLB backend group port. Defaults to `--server-port`                          |
| `--committed-plan <name>`           | No       | Committed plan name under the selected base plan                             |
| `--committed-plan-id <id>`          | No       | Committed plan ID under the selected base plan                               |
| `--post-commit-behavior <behavior>` | No       | `auto-renew` or `hourly-billing` after the committed term ends               |
| `--ssl-certificate-id <id>`         | No\*     | SSL certificate ID. **Required** when `--mode` is `HTTPS` or `BOTH`          |
| `--vpc <networkId>`                 | No       | VPC network ID to attach the LB (creates internal LB). Run `vpc list` first. |
| `--security-group <id>`             | No       | Security group ID to attach to the load balancer                             |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer delete <lbId>`

Deletes a load balancer. Prompts for confirmation unless `--force` is passed.

| Flag                  | Description                              |
| --------------------- | ---------------------------------------- |
| `--force`             | Skip the interactive confirmation prompt |
| `--reserve-public-ip` | Preserve the public IP as a reserved IP  |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend group list <lbId>`

Lists all backend groups for a load balancer. Columns: Backend Group, Routing Policy, Protocol, Health Check, Servers.

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend group create <lbId>`

Creates a backend group on an existing load balancer.

| Flag                            | Required | Description                                        |
| ------------------------------- | -------- | -------------------------------------------------- |
| `--name <name>`                 | Yes      | Backend group name                                 |
| `--backend-protocol <protocol>` | No       | `HTTP` (default) or `HTTPS` for ALB backend groups |
| `--server-ip <ip>`              | No       | Optional first backend server IP address           |
| `--server-port <port>`          | No       | Optional first backend server port                 |
| `--server-name <name>`          | No\*     | Required when `--server-ip` is set                 |
| `--algorithm <algo>`            | No       | `roundrobin` (default), `leastconn`, or `source`   |
| `--http-check`                  | No       | Enable health checks for a new ALB backend group   |
| `--backend-port <port>`         | No       | Port for a new NLB backend group                   |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend group delete <lbId> <groupName>`

Removes a backend group and all its servers from the load balancer.

The command refuses to delete the last remaining backend group on the load balancer. For ALBs, it also cleans up stale ACL mappings that pointed at the deleted backend group.

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend server list <lbId> <groupName>`

Lists all servers within a specific backend group. Columns: Server Name, IP, Port.

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend server add <lbId>`

Adds a server to an existing backend group.

| Flag                    | Required | Description                               |
| ----------------------- | -------- | ----------------------------------------- |
| `--backend-name <name>` | Yes      | Existing backend group name               |
| `--server-ip <ip>`      | Yes      | Backend server IP address                 |
| `--server-port <port>`  | Yes      | Backend server port                       |
| `--server-name <name>`  | Yes      | Unique server identifier within the group |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend server delete <lbId>`

Deletes a server from an existing backend group.

| Flag                    | Required | Description                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------- |
| `--backend-name <name>` | Yes      | Existing backend group name                                         |
| `--server-name <name>`  | Yes      | Server identifier to delete                                         |
| `--server-ip <ip>`      | No       | Optional server IP to disambiguate duplicate server names           |
| `--server-port <port>`  | No       | Optional server port to disambiguate duplicate server names further |

The command refuses to remove the last remaining server from a backend group.

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

## Related Commands

- `e2ectl reserved-ip list` — List reserved IPs (useful before deleting an LB with `--reserve-public-ip`)
- `e2ectl node list` — List nodes to find backend server IPs
