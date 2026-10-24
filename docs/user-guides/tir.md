# TIR

## What This Command Group Does

`e2ectl tir` works with TIR, the E2E AI platform. It uses the same API key and token as
MyAccount. Before most TIR commands can run, you choose three things once: the account, the
project and the location. `tir configure` saves them in your profile, and every later `tir`
command uses them.

## Before You Start

- Save a profile with `e2ectl config import --file <path>`, or set `E2E_API_KEY` and
  `E2E_AUTH_TOKEN`.
- TIR runs in Delhi and Chennai.

## Common Tasks

### Choose Where TIR Commands Run

Three commands, in order:

```bash
e2ectl tir account list
e2ectl tir project list --account-id <account-id>
e2ectl tir configure --account-id <account-id> --project-id <project-id> --location Chennai
```

- `tir account list` shows every account your key can work in: your own and any you were invited
  to, with your role and whether TIR is turned on.
- `tir project list` shows the projects in one account.
- `tir configure` checks that the account exists for your key and has TIR, that the project is in
  that account, and that the location is Delhi or Chennai. It saves nothing if a check fails.

`tir configure` saves into the default profile, or the profile named with `--alias`. See what is
saved with `e2ectl config list` (the TIR Context column, or `tir` in `--json`).

### Run One Command Somewhere Else

Every `tir` command that works inside a project takes `--account-id`, `--project-id` and
`--location`. They apply to that command only.

## Which Value Wins

The same order as everywhere else in `e2ectl`: the flag, then the environment variable, then the
saved profile.

| Value    | Flag           | Environment variable | Saved by `tir configure` |
| -------- | -------------- | -------------------- | ------------------------ |
| Account  | `--account-id` | `E2E_TIR_ACCOUNT_ID` | `tir.account_id`         |
| Project  | `--project-id` | `E2E_TIR_PROJECT_ID` | `tir.project_id`         |
| Location | `--location`   | `E2E_TIR_LOCATION`   | `tir.location`           |

TIR never uses the MyAccount project and location (`--project-id` on a `myaccount` command,
`E2E_PROJECT_ID`, `E2E_LOCATION` or the profile's MyAccount defaults).

In CI, set the three `E2E_TIR_*` variables instead of running `tir configure`.

## Examples

```bash
e2ectl --json tir account list
e2ectl --json tir project list --account-id <account-id>
e2ectl --json tir configure --account-id <account-id> --project-id <project-id> --location Delhi
```

`tir configure --json` returns:

```json
{
  "account": { "email": "acme@example.com", "id": 1234, "name": "Acme" },
  "action": "configure",
  "alias": "work",
  "location": "Delhi",
  "project": { "id": 91011, "name": "research" }
}
```

## Errors And What To Do

| Message                                         | What to do                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `No TIR account chosen.`                        | Run `e2ectl tir account list`, then pass `--account-id` or run `tir configure`. |
| `No TIR project chosen.`                        | Run `e2ectl tir project list`, then `e2ectl tir configure`.                     |
| `TIR account <id> is not one your key can use.` | Pick an id from `e2ectl tir account list`.                                      |
| `TIR is not turned on for account <id>.`        | Pick another account, or ask its owner to turn TIR on.                          |
| `Project <id> is not in TIR account <id>.`      | Pick an id from `e2ectl tir project list --account-id <id>`.                    |
| `Unsupported TIR location`                      | Use Delhi or Chennai.                                                           |
| `TIR API request failed: Forbidden`             | The key cannot use that account or project. Check them with the commands above. |

## Related Guides

- [Config](./config.md)
- [Automation cookbook](./automation.md)
