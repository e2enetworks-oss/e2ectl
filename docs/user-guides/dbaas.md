# DBaaS

## What This Command Group Does

`e2ectl dbaas` discovers supported DBaaS engines and plans, creates MariaDB, MySQL, and PostgreSQL clusters, lists them, resets passwords, and deletes them.

## Before You Start

- Choose the intended project and location first.
- Run `dbaas plans` before `dbaas create` so the CLI can resolve backend `software_id` and `template_id` from supported plan data.
- Supported user-facing database types are `maria`, `sql`, and `postgres`.

## Common Tasks

### Discover Supported Engines And Plans

```bash
e2ectl dbaas plans
```

Inspect one supported engine version in more detail:

```bash
e2ectl dbaas plans --type postgres --db-version 16
```

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
  --password <password>
```

If you want a different admin user, also pass `--username <username>`. To create without a public endpoint, add `--no-public-ip`.

### Reset The Admin Password

```bash
e2ectl dbaas reset-password <dbaas-id> --password <new-password>
```

### Delete A DBaaS Cluster

```bash
e2ectl dbaas delete <dbaas-id>
```

For non-interactive flows, add `--force`.

## Examples

Create a PostgreSQL cluster from a discovered plan:

```bash
e2ectl dbaas create \
  --name analytics-db \
  --type postgres \
  --db-version 16 \
  --plan "Balanced Small" \
  --database-name analytics \
  --password <password>
```

List clusters in machine-readable form so later steps can consume ids:

```bash
e2ectl --json dbaas list
```

## Automation Notes

- Use `dbaas plans --json` when automation needs the exact engine and template-plan rows before creating a cluster.
- Use `dbaas list --json` when later steps need the numeric DBaaS id for `reset-password` or `delete`.
- In non-interactive environments, pass `--force` to `dbaas delete`.

## Related Guides

- [Project](./project.md)
- [VPC](./vpc.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
