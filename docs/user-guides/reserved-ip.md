# Reserved IP

## What This Command Group Does

`e2ectl reserved-ip` lists, allocates, inspects, attaches, detaches, reserves, and deletes MyAccount reserved IP addresses.

## Before You Start

- Make sure you are operating in the intended project and location.
- Decide whether you are allocating a new reserved IP or preserving a node's current public IP.

## Common Tasks

### List Reserved IPs

```bash
e2ectl reserved-ip list
```

### Inspect One Reserved IP

```bash
e2ectl reserved-ip get <ip-address>
```

### Allocate A New Reserved IP

```bash
e2ectl reserved-ip create
```

### Preserve A Node's Current Public IP

```bash
e2ectl reserved-ip reserve node <node-id>
```

### Attach A Reserved IP To A Node

```bash
e2ectl reserved-ip attach node <ip-address> --node-id <node-id>
```

### Detach A Reserved IP From A Node

```bash
e2ectl reserved-ip detach node <ip-address> --node-id <node-id>
```

### Delete A Reserved IP

```bash
e2ectl reserved-ip delete <ip-address>
```

## Examples

Delete a reserved IP without an interactive confirmation:

```bash
e2ectl reserved-ip delete <ip-address> --force
```

Capture reserved IP inventory for an automation step:

```bash
e2ectl --json reserved-ip list
```

## Automation Notes

- `reserved-ip list` and `reserved-ip get` are safe discovery commands for scripts.
- Use the exact `ip_address` value from list or create output when you pass `<ip-address>` to attach, detach, or delete.
- Avoid screenshots or shared logs that include real IPs alongside sensitive account context.

## Related Guides

- [Node](./node.md)
- [Networking and storage workflow](./workflows/networking-and-storage.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
