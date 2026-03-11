# M8_001: Node Catalog Discovery

**Prototype:** v0.1.0
**Milestone:** M8
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Make prototype node creation discoverable and usable
**Depends on:** M5_001, M6_001, M7_001

---

## 1.0 Discovery Commands

**Status:** DONE

Add a catalog-first command surface so users can discover valid node creation inputs before calling `node create`.

**Dimensions:**

- 1.1 DONE Add `node catalog os`
- 1.2 DONE Add `node catalog plans`
- 1.3 DONE Keep deterministic `--json` output for both discovery commands

---

## 2.0 Create UX And Help

**Status:** DONE

Guide users toward the catalog-first flow without replacing the existing prototype create contract.

**Dimensions:**

- 2.1 DONE Update `node create` help text to point users to `node catalog`
- 2.2 DONE Ensure `e2ectl help`, `e2ectl node help`, and `e2ectl node catalog --help` expose the discovery flow
- 2.3 DONE Keep safe prototype defaults for omitted create fields

---

## 3.0 Verification

**Status:** DONE

Cover the discovery flow in both mocked unit tests and explicit read-only live checks.

**Dimensions:**

- 3.1 DONE Add unit tests for catalog client methods and command wiring
- 3.2 DONE Add formatter coverage for catalog output
- 3.3 DONE Extend the manual suite with read-only catalog API checks

---

## 4.0 Acceptance Criteria

**Status:** DONE

- [x] 4.1 Users can list OS rows and valid plan/image pairs through the CLI
- [x] 4.2 Help output makes the prototype discovery-first create flow obvious
- [x] 4.3 Read-only live verification passes against a real MyAccount project

---

## 5.0 Out of Scope

- Interactive create wizard
- Automatic security group resolution in the CLI payload
- VPC/subnet selection UX
- Production write verification beyond explicit operator approval
