# VPC

## What This Command Group Does

`e2ectl vpc` discovers billing plans, creates VPC networks, lists and inspects them, and deletes them. VPC attach and detach flows use `e2ectl node action vpc`.

## Before You Start

- Choose the intended project and location first.
- Use `vpc plans` before `vpc create` so you can intentionally choose hourly or committed billing.
- Treat the canonical VPC id as the `network_id` shown in create, get, and list output.

## Common Tasks

### Discover VPC Billing Options

```bash
e2ectl vpc plans
```

### List And Inspect VPCs

```bash
e2ectl vpc list
e2ectl vpc get <vpc-id>
```

### Create A VPC

```bash
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type hourly \
  --cidr-source e2e
```

For custom CIDRs, use `--cidr-source custom --cidr <cidr>`.

For committed billing, add `--committed-plan-id <committed-plan-id>` and, if needed, `--post-commit-behavior <behavior>`.

### Attach Or Detach A VPC From A Node

```bash
e2ectl node action vpc attach <node-id> --vpc-id <vpc-id>
e2ectl node action vpc detach <node-id> --vpc-id <vpc-id>
```

Add `--subnet-id <subnet-id>` or `--private-ip <private-ip>` only when your workflow needs them.

### Delete A VPC

```bash
e2ectl vpc delete <vpc-id>
```

## Examples

Create a VPC with a custom CIDR:

```bash
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type hourly \
  --cidr-source custom \
  --cidr <cidr>
```

Delete a VPC without the confirmation prompt:

```bash
e2ectl vpc delete <vpc-id> --force
```

## Automation Notes

- Use `vpc plans --json` when a later step needs an exact committed plan id.
- Store the returned `network_id` from create output and use that canonical id in later attach, get, and delete calls.

## Related Guides

- [Node](./node.md)
- [Networking and storage workflow](./workflows/networking-and-storage.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
