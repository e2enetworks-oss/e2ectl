# Config

## What This Command Group Does

`e2ectl config` manages saved profiles in `~/.e2e/config.json`, including imported credentials, the default alias, and shared default project/location context.

## Before You Start

- Download a credential JSON file from MyAccount before running `config import`.
- Decide whether you want an interactive setup flow or a fully explicit `--no-input` path.
- Treat saved profiles as secrets. Do not commit them or paste them into shared logs.

## Common Tasks

### Import A Downloaded Credential File

```bash
e2ectl config import --file ~/Downloads/myaccount-config.json
```

Use this when you want `e2ectl` to offer default alias and default context prompts in an interactive terminal.

### Import Without Prompts

```bash
e2ectl config import \
  --file ~/Downloads/myaccount-config.json \
  --default <profile-alias> \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

### Review Saved Profiles

```bash
e2ectl config list
```

### Update Shared Default Context

```bash
e2ectl config set-context \
  --alias <profile-alias> \
  --default-project-id <project-id> \
  --default-location <location>
```

### Choose The Default Saved Profile

```bash
e2ectl config set-default --alias <profile-alias>
```

### Remove A Saved Profile

```bash
e2ectl config remove --alias <profile-alias>
```

### Understand Resolution Order

Authentication resolves in this order:

1. `E2E_API_KEY` and `E2E_AUTH_TOKEN`
2. `--alias`
3. the default saved alias

Project context resolves in this order:

1. `--project-id` and `--location`
2. `E2E_PROJECT_ID` and `E2E_LOCATION`
3. the saved defaults on the selected alias

Account-scoped `project` commands use the same auth path, but they do not require project or location context.

## Examples

List profiles in machine-readable form:

```bash
e2ectl --json config list
```

Import a file and overwrite an existing alias without another prompt:

```bash
e2ectl config import \
  --file ~/Downloads/myaccount-config.json \
  --default <profile-alias> \
  --force \
  --no-input
```

## Automation Notes

- Prefer `config import --no-input` in CI.
- Set shared project defaults during import so later commands can stay shorter.
- Avoid inline shell-history patterns that expose secrets. Use a private credential file or CI secret store instead.

## Related Guides

- [Quickstart](./quickstart.md)
- [Project](./project.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
- [Non-interactive and automation failures](./troubleshooting.md#non-interactive-and-automation-failures)
