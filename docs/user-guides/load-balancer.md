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
Use `e2ectl security-group list` to find a security group ID for `--security-group`.

```bash
e2ectl lb create \
  --name my-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --algorithm roundrobin \
  --backend-group-name web \
  --backend-group-protocol HTTP \
  --backend-group-server web-1:192.168.1.1:8080 \
  --backend-group-server web-2:192.168.1.2:8080 \
  --reserve-ip 203.0.113.10 \
  --security-group 42
```

ALB frontend protocols are `HTTP`, `HTTPS`, and `BOTH`. ALB backend protocols are `HTTP` and `HTTPS`. ALB health checks are always enabled with check URL `/`.

HTTPS and BOTH require `--ssl-certificate-id`. Use `e2ectl ssl list` to find the certificate ID.

```bash
e2ectl lb create \
  --name secure-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTPS \
  --ssl-certificate-id 123 \
  --backend-group-name web \
  --backend-group-protocol HTTPS \
  --backend-group-server web-1:192.168.1.1:8443
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
  --backend-group-name tcp-main \
  --backend-group-server app-1:192.168.1.10:9000 \
  --backend-group-server app-2:192.168.1.11:9000 \
  --reserve-ip 203.0.113.10
```

NLB has no backend protocol. The backend group port follows the frontend port.

## Create An Internal LB

Use `e2ectl vpc list` to find the VPC ID for `--vpc-id`. The `--vpc-id` flag is required with `--lb-type internal`.
`--reserve-ip` cannot be used with internal LBs.

```bash
e2ectl lb create \
  --name internal-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --lb-type internal \
  --vpc-id 123 \
  --backend-group-name web \
  --backend-group-protocol HTTP \
  --backend-group-server web-1:192.168.1.1:8080
```

## External LBs With VPC

External LBs can optionally attach to a VPC with `--vpc-id`. Both `--vpc-id` and `--reserve-ip` can be used together on external LBs.

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
e2ectl lb network vpc attach <lbId> --vpc-id <vpcId>
e2ectl lb network vpc attach <lbId> --vpc-id <vpcId> --subnet <subnetId>
e2ectl lb network vpc detach <lbId> --vpc-id <vpcId>
```

Reserving a public IP is for external load balancers with an assigned public IPv4 address. If the public IP is already reserved, `lb get` and `lb list` show `(Reserved)` next to the public IP. VPC attachment switches the LB to internal and clears the reserved public IP field.

## Backend Groups

```bash
e2ectl lb backend group list <lbId>

e2ectl lb backend group add <lbId> \
  --backend-group-name api \
  --backend-group-protocol HTTP \
  --backend-group-server api-1:192.168.2.1:9000

e2ectl lb backend group update <lbId> web \
  --backend-group-protocol HTTPS \
  --algorithm leastconn

# Rename a backend group
e2ectl lb backend group update <lbId> web \
  --backend-group-name web-v2

e2ectl lb backend group remove <lbId> api
```

Creation supports one backend group with multiple backend servers. Add more backend groups after creation for ALB workflows. The CLI refuses to remove the final backend group.

## Backend Servers

Use `e2ectl node list` to find node IPs for `--backend-group-server`.

```bash
e2ectl lb backend server add <lbId> \
  --backend-group-name web \
  --backend-group-server web-3:192.168.1.3:8080

e2ectl lb backend server remove <lbId> \
  --backend-group-name web \
  --backend-group-server-name web-3
```

The CLI refuses to remove the final backend server from a backend group.

Server names must be unique within a backend group. The CLI rejects duplicate server names when adding.

## Delete

```bash
e2ectl lb delete <lbId>
e2ectl lb delete <lbId> --force
e2ectl lb delete <lbId> --force --reserve-public-ip
```

Without `--force`, interactive terminals are prompted for confirmation. `--reserve-public-ip` asks the backend to preserve the LB public IP when deleting.

## Billing Options

By default, load balancers are created with hourly billing. Use `--billing-type committed` to select a committed (term-based) plan instead.

```bash
# Hourly billing (default)
e2ectl lb create \
  --name my-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --billing-type hourly \
  --backend-group-name web \
  --backend-group-protocol HTTP \
  --backend-group-server web-1:192.168.1.1:8080
```

```bash
# Committed billing with a named plan
e2ectl lb create \
  --name my-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --billing-type committed \
  --committed-plan "90 Days" \
  --post-commit-behavior auto-renew \
  --backend-group-name web \
  --backend-group-protocol HTTP \
  --backend-group-server web-1:192.168.1.1:8080
```

```bash
# Committed billing with a plan ID
e2ectl lb create \
  --name my-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --billing-type committed \
  --committed-plan-id 901 \
  --post-commit-behavior hourly-billing \
  --backend-group-name web \
  --backend-group-protocol HTTP \
  --backend-group-server web-1:192.168.1.1:8080
```

Use `e2ectl lb plans` to see available committed options for each base plan. The `--post-commit-behavior` flag controls what happens when the committed term ends:

- `auto-renew` — automatically renew the committed term
- `hourly-billing` — switch to hourly billing after the term expires

You cannot use `--committed-plan` and `--committed-plan-id` together — pick one.

## Load Balancing Algorithms

The `--algorithm` flag controls how traffic is distributed across backend servers. Available algorithms:

| Algorithm              | Behavior                                                                        |
| ---------------------- | ------------------------------------------------------------------------------- |
| `roundrobin` (default) | Distributes requests evenly across all backend servers in rotation              |
| `leastconn`            | Sends requests to the backend server with the fewest active connections         |
| `source`               | Routes requests based on the client's source IP address for session persistence |

```bash
e2ectl lb create \
  --name my-lb \
  --plan E2E-LB-2 \
  --frontend-protocol HTTP \
  --algorithm leastconn \
  --backend-group-name web \
  --backend-group-protocol HTTP \
  --backend-group-server web-1:192.168.1.1:8080
```

The algorithm can also be changed later:

```bash
e2ectl lb backend group update <lbId> <groupName> --algorithm source
```

## Related Guides

- [SSL certificates](./ssl.md)
- [Reserved IPs](./reserved-ip.md)
- [VPC networking](./vpc.md)
- [Security groups](./security-group.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [412 during `lb create`](./troubleshooting.md#412-during-lb-create)
- [NLB single backend group](./troubleshooting.md#nlbsinglebackendgroup)
- [Last backend group not deletable](./troubleshooting.md#lastbackendgroupnotdeletable)
- [Last backend server not deletable](./troubleshooting.md#lastbackendservernotdeletable)
- [Duplicate backend server name](./troubleshooting.md#backendserverduplicatename)
- [Backend group exists](./troubleshooting.md#backendgroupexists)
- [Backend group and server not found](./troubleshooting.md#backendgroupnotfound-and-backendservernotfound)
- [Backend server ambiguous](./troubleshooting.md#backendserverambiguous)
- [Reserved IP errors](./troubleshooting.md#reserveipnotfound-reserveipnotavailable)
- [Public IP already reserved](./troubleshooting.md#loadbalancerpublicipalreadyreserved)
- [Reserve IP requires external LB](./troubleshooting.md#reserveiprequiresexternallb)
- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
- [Non-interactive and automation failures](./troubleshooting.md#non-interactive-and-automation-failures)
