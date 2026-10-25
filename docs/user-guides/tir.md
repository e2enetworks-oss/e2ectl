# TIR

## What This Command Group Does

`e2ectl tir` works with TIR, the E2E AI platform. It uses the same API key and token as
MyAccount. Before most TIR commands can run, you choose three things once: the account, the
project and the location. `tir configure` saves them in your profile, and every later `tir`
command uses them.

## Before You Start

- Run `e2ectl configure` to save your key and token in a profile and choose TIR. `tir configure`
  needs a saved profile; in scripts without one, set `E2E_API_KEY`, `E2E_AUTH_TOKEN` and the
  `E2E_TIR_*` variables instead.
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
  `myaccount configure` works the same way for the MyAccount project and location.

`e2ectl configure` runs the same steps when you choose TIR there. `tir configure` asks for each
value in a terminal (offering what is saved as the default) and takes `--account-id`, `--project-id`
and `--location` in scripts; a missing value fails with a message naming the flag. It saves into
the default profile, or the profile named with `--alias`. See what is
saved with `e2ectl config list` (the TIR Context column, or `tir` in `--json`).

### Run One Command Somewhere Else

Every `tir` command that works inside a project takes `--account-id`, `--project-id` and
`--location`. They apply to that command only.

### See Images And Plans

```bash
e2ectl tir image list
e2ectl tir plan list --image-version-id <version-id>
```

- `tir image list` shows one row per image version. The version id is what a TIR instance
  starts from.
- `tir plan list` shows CPU, GPU and spot plans with their hourly price and the plan ids for
  hourly and committed billing. Pass `--image-version-id` to see only the plans that fit that
  image. Committed plan ids and prices are in `--json`.

Each `tir plan list --json` item looks like this:

```json
{
  "available": true,
  "committed": [{ "days": 30, "plan_id": 2699, "price": 3422 }],
  "currency": "INR",
  "gpu": null,
  "hourly": { "plan_id": 1565, "price": 4.7 },
  "memory": "8GB",
  "name": "C3.8GB",
  "series": "CPU",
  "vcpu": 4
}
```

GPU plans have `"gpu": { "count": 1, "memory": "80GB", "type": "H100" }`. `available` is
`false` when that plan has no free capacity right now.

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
e2ectl --json tir image list
e2ectl --json tir plan list --image-version-id <version-id>
```

`tir configure --json` returns:

```json
{
  "account": { "email": "acme@example.com", "id": 1234, "name": "Acme" },
  "action": "configure",
  "alias": "work",
  "location": "Delhi",
  "platform": "tir",
  "project": { "id": 91011, "name": "research" }
}
```

## Errors And What To Do

| Message                                           | What to do                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `No TIR account chosen.`                          | Run `e2ectl tir account list`, then pass `--account-id` or run `tir configure`. |
| `No TIR project and location chosen.`             | Run `e2ectl tir project list`, then `e2ectl tir configure`.                     |
| `No TIR <values> given.`                          | Add every flag the message names, or run the command in a terminal.             |
| `TIR account <id> is not one your key can use.`   | Pick an id from `e2ectl tir account list`.                                      |
| `TIR is not turned on for account <id>.`          | Pick another account, or ask its owner to turn TIR on.                          |
| `TIR project <id> was not found in account <id>.` | Pick an id from `e2ectl tir project list --account-id <id>`.                    |
| `Unsupported location`                            | Use Delhi or Chennai (any case).                                                |
| `TIR does not know image version <id>.`           | Pick a version id from `e2ectl tir image list`.                                 |
| `TIR API request failed: Forbidden`               | The key cannot use that account or project. Check them with the commands above. |

## Related Guides

- [Config](./config.md)
- [Automation cookbook](./automation.md)
