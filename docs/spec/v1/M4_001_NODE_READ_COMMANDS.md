# M4_001: Node Read Commands

**Prototype:** v0.1.0
**Milestone:** M4
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Make node inspection usable from the CLI
**Depends on:** M3_001

---

## 1.0 Read Operations

**Status:** DONE

Implement the read-only node command set on top of the API client.

**Dimensions:**

- 1.1 DONE Add `node list`
- 1.2 DONE Add `node get`
- 1.3 DONE Resolve credentials from env or saved profile for node reads

---

## 2.0 Output Modes

**Status:** DONE

Provide stable human and machine output for the node read commands.

**Dimensions:**

- 2.1 DONE Add table output for node lists
- 2.2 DONE Add readable detail output for `node get`
- 2.3 DONE Add deterministic JSON payloads for both commands

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 Node list and get are wired into the CLI
- [x] 3.2 Read commands support profile selection via `--alias`
- [x] 3.3 Output behavior is covered by unit tests

---

## 4.0 Out of Scope

- Node creation or deletion
- Action endpoints
- Pagination flags beyond the prototype default
