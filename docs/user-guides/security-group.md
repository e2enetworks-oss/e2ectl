# Security Group

## What This Command Group Does

`e2ectl security-group` creates, updates, lists, inspects, and deletes security groups. Attach and detach flows use `e2ectl node action security-group`.

## Before You Start

- Prepare a backend-compatible JSON rules document before you create or update a security group.
- Use `--rules-file -` only when stdin is the safest way to supply the rules content in your environment.

## Common Tasks

### List And Inspect Security Groups

```bash
e2ectl security-group list
e2ectl security-group get <security-group-id>
```

### Create A Security Group

```bash
e2ectl security-group create \
  --name <security-group-name> \
  --rules-file ./rules.json
```

### Update A Security Group

```bash
e2ectl security-group update <security-group-id> \
  --name <security-group-name> \
  --rules-file ./rules.json
```

### Attach Or Detach Security Groups On A Node

```bash
e2ectl node action security-group attach <node-id> \
  --security-group-id <security-group-id>

e2ectl node action security-group detach <node-id> \
  --security-group-id <security-group-id>
```

Repeat `--security-group-id` to attach or detach more than one group in a single command.

### Delete A Security Group

```bash
e2ectl security-group delete <security-group-id>
```

## Examples

Create a default security group with a description:

```bash
e2ectl security-group create \
  --name <security-group-name> \
  --rules-file ./rules.json \
  --description "<description>" \
  --default
```

Read the rules JSON from stdin:

```bash
cat ./rules.json | e2ectl security-group create \
  --name <security-group-name> \
  --rules-file -
```

## Automation Notes

- Keep rules JSON in version-controlled templates without real IPs, secrets, or account-specific comments.
- Use `--json` for list or get operations when later steps need security-group ids.

## Related Guides

- [Node](./node.md)
- [Networking and storage workflow](./workflows/networking-and-storage.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
