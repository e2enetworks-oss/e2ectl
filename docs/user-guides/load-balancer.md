# Load Balancer

## What This Command Group Does

The `load-balancer` command group lets you create, list, and delete load balancers on E2E Networks, and manage the backend groups and servers that sit behind them.

Two load balancer types are supported:

| Type | Mode flag | Layer | Use case |
|------|-----------|-------|----------|
| **ALB** (Application Load Balancer) | `HTTP`, `HTTPS`, or `BOTH` | Layer 7 | HTTP/HTTPS routing, domain-based routing, health checks |
| **NLB** (Network Load Balancer) | `TCP` | Layer 4 | TCP passthrough, port-based routing |

---

## Before You Start

- Configure a profile with your API key and auth token: `e2ectl config set`
- Know your load balancer plan identifier (e.g. `LB-2`, `LB-3`).
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

### Create an ALB (HTTP)

Creates an Application Load Balancer that listens on port 80 with one backend group and one server.

```
e2ectl load-balancer create \
  --name my-alb \
  --plan LB-2 \
  --mode HTTP \
  --port 80 \
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
  --plan LB-2 \
  --mode TCP \
  --port 80 \
  --backend-name tcp-group \
  --server-ip 10.0.0.2 \
  --server-port 8080 \
  --server-name srv-1 \
  --backend-port 8080
```

### Create an Internal Load Balancer (VPC only)

Use `--type internal` to create an LB without a public IP — it is accessible only within the VPC.

```
e2ectl load-balancer create \
  --name internal-alb \
  --plan LB-2 \
  --mode HTTP \
  --port 80 \
  --type internal
```

### List Backend Groups and Their Servers

```
e2ectl load-balancer backend list <lbId>
```

```
e2ectl load-balancer backend list <lbId> --json
```

### Add a Server to an Existing Backend Group

If the backend group named `web` already exists, the server is appended to it. If it does not exist, a new group is created.

```
e2ectl load-balancer backend add <lbId> \
  --backend-name web \
  --server-ip 10.0.0.5 \
  --server-port 8080 \
  --server-name server-2
```

> **NLB constraint**: NLB supports only one backend group. If you specify a `--backend-name` that differs from the existing group name, the command will error.

### Create a New Backend Group on an Existing ALB

Use `backend add` with a name that does not yet exist on the LB:

```
e2ectl load-balancer backend add <lbId> \
  --backend-name api \
  --server-ip 10.0.0.9 \
  --server-port 9090 \
  --server-name api-server-1 \
  --domain-name api.example.com \
  --algorithm leastconn \
  --http-check \
  --check-url /health
```

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

### `e2ectl load-balancer list`

Lists all load balancers for the active profile.

**Options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer create`

Creates a new load balancer.

| Flag | Required | Description |
|------|----------|-------------|
| `--name <name>` | Yes | Load balancer name |
| `--plan <plan>` | Yes | Plan identifier (e.g. `LB-2`) |
| `--mode <mode>` | Yes | `HTTP`, `HTTPS`, `BOTH` (ALB), or `TCP` (NLB) |
| `--port <port>` | Yes | Frontend listener port |
| `--type <type>` | No | `external` (default) or `internal` |
| `--backend-name <name>` | No | Initial backend group name |
| `--server-ip <ip>` | No* | Backend server IP. Required when `--backend-name` is set |
| `--server-port <port>` | No | Backend server port. Defaults to `--port` |
| `--server-name <name>` | No* | Server identifier. Required when `--backend-name` is set |
| `--algorithm <algo>` | No | `roundrobin` (default), `leastconn`, or `source` |
| `--domain-name <domain>` | No | Domain name for ALB backend |
| `--http-check` | No | Enable HTTP health checks (ALB only) |
| `--check-url <path>` | No | Health check path (default: `/`) |
| `--backend-port <port>` | No | NLB backend group port. Defaults to `--server-port` |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer delete <lbId>`

Deletes a load balancer. Prompts for confirmation unless `--force` is passed.

| Flag | Description |
|------|-------------|
| `--force` | Skip the interactive confirmation prompt |
| `--reserve-public-ip` | Preserve the public IP as a reserved IP |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend list <lbId>`

Lists all backend groups and their servers for a load balancer.

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

### `e2ectl load-balancer backend add <lbId>`

Adds a server to an existing backend group, or creates a new backend group with that server.

| Flag | Required | Description |
|------|----------|-------------|
| `--backend-name <name>` | Yes | Backend group name |
| `--server-ip <ip>` | Yes | Backend server IP address |
| `--server-port <port>` | Yes | Backend server port |
| `--server-name <name>` | Yes | Unique server identifier within the group |
| `--domain-name <domain>` | No | Domain for a new ALB backend group |
| `--algorithm <algo>` | No | `roundrobin` (default), `leastconn`, or `source` |
| `--http-check` | No | Enable health checks for a new ALB backend group |
| `--check-url <path>` | No | Health check path (default: `/`) |
| `--backend-port <port>` | No | Port for a new NLB backend group |

**Context options**: `--alias`, `--project-id`, `--location`, `--json`

---

## Related Commands

- `e2ectl reserved-ip list` — List reserved IPs (useful before deleting an LB with `--reserve-public-ip`)
- `e2ectl node list` — List nodes to find backend server IPs
