# Project

## What This Command Group Does

`e2ectl project` manages account-scoped MyAccount projects. These commands need authentication, but they do not require `--project-id` or `--location`.

## Before You Start

- Make sure you have valid credentials through environment variables or a saved alias.
- Use project commands when you need to discover, create, or star projects before choosing defaults for project-scoped resources.

## Common Tasks

### List Accessible Projects

```bash
e2ectl project list
```

### Create A Project

```bash
e2ectl project create --name <project-name>
```

### Star A Project

```bash
e2ectl project star <project-id>
```

### Unstar A Project

```bash
e2ectl project unstar <project-id>
```

## Examples

List projects with a specific saved alias:

```bash
e2ectl project list --alias <profile-alias>
```

Capture project output for scripts:

```bash
e2ectl --json project list
```

## Automation Notes

- `project list`, `project create`, `project star`, and `project unstar` are good early automation entry points because they do not depend on saved project/location context.
- Use `--json` when a later step needs the numeric project id.

## Related Guides

- [Config](./config.md)
- [Quickstart](./quickstart.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
