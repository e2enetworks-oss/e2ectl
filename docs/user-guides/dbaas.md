# DBaaS

## What This Command Group Does

`e2ectl dbaas` discovers supported DBaaS engine types and plans, creates MariaDB, MySQL, and PostgreSQL clusters, lists them, resets passwords, attaches VPCs, and deletes them.

## Before You Start

- Choose the intended project and location first.
- Run `dbaas list-types` to see available engine types and versions, then `dbaas plans --type <type> --db-version <version>` to see all hourly plans and committed SKU options for that version.
- Supported user-facing database types are `maria`, `sql`, and `postgres`.

## Common Tasks

### Discover Supported Engine Types

```bash
e2ectl dbaas list-types
```

Filter to one database family:

```bash
e2ectl dbaas list-types --type postgres
```

### Discover Plans For An Engine Version

```bash
e2ectl dbaas plans --type postgres --db-version 16
```

This shows all hourly template plans and committed SKU options for that engine version. Use the plan name with `--plan` and the committed SKU ID with `--billing-type committed --committed-plan-id <id>` when creating a cluster.

### List DBaaS Clusters

```bash
e2ectl dbaas list
```

Filter the list to one supported engine family:

```bash
e2ectl dbaas list --type sql
```

### Create A DBaaS Cluster

```bash
e2ectl dbaas create \
  --name <cluster-name> \
  --type sql \
  --db-version 8.0 \
  --plan <plan-name> \
  --database-name <database-name> \
  --password-file /secure/path/dbaas-password.txt
```

Use `--password-file -` to read the password from stdin. `--password <password>` is still supported for one-off interactive use, but it can leave the password in shell history.

If you want a different admin user, also pass `--username <username>`. To create without a public endpoint, add `--no-public-ip`.

#### Committed (Reserved) Billing

Use `--billing-type committed` with a SKU ID from `dbaas skus`:

```bash
e2ectl dbaas create \
  --name <cluster-name> \
  --type sql \
  --db-version 8.0 \
  --plan <plan-name> \
  --database-name <database-name> \
  --password-file /secure/path/dbaas-password.txt \
  --billing-type committed \
  --committed-plan-id <sku-id>
```

By default the committed term auto-renews. Pass `--committed-renewal hourly` to switch to hourly billing when the term ends.

#### Create With A VPC

Attach the cluster to a VPC at creation time using the `network_id` from `vpc list`:

```bash
e2ectl dbaas create \
  --name <cluster-name> \
  --type postgres \
  --db-version 16 \
  --plan <plan-name> \
  --database-name <database-name> \
  --password-file /secure/path/dbaas-password.txt \
  --vpc-id <network-id>
```

For non-default VPCs that require a specific subnet, also pass `--subnet-id <subnet-id>`.

### Attach A VPC To An Existing Cluster

The cluster must be in Running state:

```bash
e2ectl dbaas attach <dbaas-id> --vpc-id <network-id>
```

### Reset The Admin Password

```bash
e2ectl dbaas reset-password <dbaas-id> --password-file /secure/path/dbaas-password.txt
```

### Delete A DBaaS Cluster

```bash
e2ectl dbaas delete <dbaas-id>
```

For non-interactive flows, add `--force`.

## Examples

Full discovery-to-create flow for a PostgreSQL cluster:

```bash
# 1. See what versions are available
e2ectl dbaas list-types --type postgres

# 2. See hourly plans and committed options for that version
e2ectl dbaas plans --type postgres --db-version 16

# 3. Create with hourly billing
e2ectl dbaas create \
  --name analytics-db \
  --type postgres \
  --db-version 16 \
  --plan "Balanced Small" \
  --database-name analytics \
  --password-file /secure/path/dbaas-password.txt
```

Create a MySQL cluster with committed billing attached to a VPC:

```bash
# Get the committed SKU ID from plans output
e2ectl dbaas plans --type sql --db-version 8.0

e2ectl dbaas create \
  --name prod-db \
  --type sql \
  --db-version 8.0 \
  --plan "General Purpose Small" \
  --database-name appdb \
  --password-file /secure/path/dbaas-password.txt \
  --billing-type committed \
  --committed-plan-id <sku-id> \
  --vpc-id <network-id>
```

List clusters in machine-readable form so later steps can consume ids:

```bash
e2ectl --json dbaas list
```

## Automation Notes

- Use `dbaas list-types --json` to enumerate available engine families and versions.
- Use `dbaas plans --json --type <type> --db-version <version>` when automation needs exact template-plan rows and committed SKU IDs before creating a cluster. Both hourly plans and committed SKUs are included in the same response.
- Use `dbaas list --json` when later steps need the numeric DBaaS id for `reset-password`, `attach`, or `delete`.
- Prefer `--password-file <path>` or `--password-file -` over `--password <password>` so DBaaS admin passwords do not end up in shell history or CI logs.
- In non-interactive environments, pass `--force` to `dbaas delete`.

## Related Guides

- [Project](./project.md)
- [VPC](./vpc.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
