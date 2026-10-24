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

### Which Value Wins

Every value is picked in the same order: the command's flag, then its environment variable,
then the saved profile. The first one that is set wins.

| Value              | Flag                             | Environment variable            | Saved profile                       |
| ------------------ | -------------------------------- | ------------------------------- | ----------------------------------- |
| API key and token  | `--alias` (the profile it names) | `E2E_API_KEY`, `E2E_AUTH_TOKEN` | the default profile                 |
| MyAccount project  | `--project-id`                   | `E2E_PROJECT_ID`                | `default_project_id` on the profile |
| MyAccount location | `--location`                     | `E2E_LOCATION`                  | `default_location` on the profile   |

Two things follow from this:

- `--alias prod` uses the `prod` key and token even when `E2E_API_KEY` and `E2E_AUTH_TOKEN`
  are set. Without `--alias`, those environment variables win over the default profile.
- `--alias` only chooses the key and token. If `E2E_PROJECT_ID` or `E2E_LOCATION` is set, it
  still wins over the project and location saved on that profile. Unset them, or pass
  `--project-id` and `--location`, when you switch profiles.

Account-scoped `project` commands use the same key and token, but they do not need a project or
location.

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
