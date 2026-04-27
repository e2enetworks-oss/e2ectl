# Load Balancer Guide

The `lb` command group manages E2E Networks load balancers. It supports ALB (`HTTP`, `HTTPS`, `BOTH`) and NLB (`TCP`) creation, LB-level updates, network attachments, backend groups, and backend servers.

Every command accepts `--json` for machine-readable output.

## Before You Start

- Save a default alias and default project/location context, or pass `--alias`, `--project-id`, and `--location` explicitly.
- List plans with `e2ectl lb plans`.
- Backend servers use `name:ip:port` syntax, for example `web-1:192.168.1.1:8080`.

## List And Inspect

```bash
e2ectl lb list
e2ectl lb plans
e2ectl lb get <lbId>
```

## Create An ALB

`--port` defaults to `80` for HTTP and `443` for HTTPS/BOTH, so it can be omitted for those protocols.

Use `e2ectl node list` to find the private IP of your backend nodes.
Use `e2ectl reserved-ip list` to find an unattached reserved IP for `--reserve-ip`.
If `--reserve-ip` is not specified, a random public IP is automatically allocated as part of the selected plan.

```bash
e2ectl lb create \
  --name my-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --backend-group web \
  --backend-protocol HTTP \
  --backend-server web-1:192.168.1.1:8080 \
  --backend-server web-2:192.168.1.2:8080 \
  --reserve-ip 203.0.113.10
```

ALB frontend protocols are `HTTP`, `HTTPS`, and `BOTH`. ALB backend protocols are `HTTP` and `HTTPS`. ALB health checks are always enabled with check URL `/`.

HTTPS and BOTH require `--ssl-certificate-id`. Use `e2ectl ssl list` to find the certificate ID.

```bash
e2ectl lb create \
  --name secure-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTPS \
  --ssl-certificate-id 123 \
  --backend-group web \
  --backend-protocol HTTPS \
  --backend-server web-1:192.168.1.1:8443
```

## Create An NLB

`--port` is required for TCP as there is no standard default.

Use `e2ectl node list` to find node IPs. Use `e2ectl reserved-ip list` for `--reserve-ip`; only unattached reserved IPs with `Reserved` or `Available` status can be selected during create.

```bash
e2ectl lb create \
  --name my-nlb \
  --plan E2E-LB-2 \
  --frontend-protocol TCP \
  --port 9000 \
  --backend-group tcp-main \
  --backend-server app-1:192.168.1.10:9000 \
  --backend-server app-2:192.168.1.11:9000 \
  --reserve-ip 203.0.113.10
```

NLB has no backend protocol. The backend group port follows the frontend port.

## Create An Internal LB

Use `e2ectl vpc list` to find the VPC ID for `--vpc`.

```bash
e2ectl lb create \
  --name internal-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --vpc 123 \
  --backend-group web \
  --backend-protocol HTTP \
  --backend-server web-1:192.168.1.1:8080
```

`--reserve-ip` is only for external load balancers and cannot be combined with `--vpc`.

## Update LB Settings

Use `e2ectl ssl list` to find the certificate ID for `--ssl-certificate-id`.

```bash
e2ectl lb update <lbId> --name new-name
e2ectl lb update <lbId> --frontend-protocol HTTPS --ssl-certificate-id 123
e2ectl lb update <lbId> --frontend-protocol BOTH --ssl-certificate-id 123 --redirect-http-to-https
e2ectl lb update <lbId> --ssl-certificate-id 456
```

ALBs can move among `HTTP`, `HTTPS`, and `BOTH`. NLBs stay `TCP`; the CLI does not allow changing an ALB to TCP or a TCP NLB to an ALB protocol. SSL updates are ALB-only, and `--redirect-http-to-https` is valid only with `--frontend-protocol BOTH`.

## Network Attachments

Use `e2ectl lb network reserve-ip reserve <lbId>` to preserve an external LB's current public IP as a reserved IP when it is not already reserved.
Use `e2ectl vpc list` to find the VPC ID for `vpc attach/detach`.

```bash
e2ectl lb network reserve-ip reserve <lbId>
e2ectl lb network vpc attach <lbId> --vpc <vpcId>
e2ectl lb network vpc attach <lbId> --vpc <vpcId> --subnet <subnetId>
e2ectl lb network vpc detach <lbId> --vpc <vpcId>
```

Reserving a public IP is for external load balancers with an assigned public IPv4 address. If the public IP is already reserved, `lb get` and `lb list` show `(Reserved)` next to the public IP. VPC attachment switches the LB to internal and clears the reserved public IP field.

## Backend Groups

```bash
e2ectl lb backend-group add <lbId> \
  --name api \
  --backend-protocol HTTP \
  --backend-server api-1:192.168.2.1:9000

e2ectl lb backend-group update <lbId> web \
  --backend-protocol HTTPS \
  --algorithm leastconn

e2ectl lb backend-group remove <lbId> api
```

Creation supports one backend group with multiple backend servers. Add more backend groups after creation for ALB workflows. The CLI refuses to remove the final backend group.

## Backend Servers

Use `e2ectl node list` to find node IPs for `--backend-server`.

```bash
e2ectl lb backend-server add <lbId> \
  --backend-group web \
  --backend-server web-3:192.168.1.3:8080

e2ectl lb backend-server update <lbId> \
  --backend-group web \
  --backend-server-name web-3 \
  --ip 192.168.1.30 \
  --port 8081

e2ectl lb backend-server remove <lbId> \
  --backend-group web \
  --backend-server-name web-3
```

The CLI refuses to remove the final backend server from a backend group.

## Delete

```bash
e2ectl lb delete <lbId>
e2ectl lb delete <lbId> --force
e2ectl lb delete <lbId> --force --reserve-public-ip
```

Without `--force`, interactive terminals are prompted for confirmation. `--reserve-public-ip` asks the backend to preserve the LB public IP when deleting.
