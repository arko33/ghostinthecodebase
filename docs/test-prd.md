# Product Requirements — Invoice API (Test Target)

## 1. Overview

A small, owner-scoped invoice REST API. It is the live target that the
TestSprite suite exercises. The API is deterministic: seed data is fixed, so
every assertion below is safe to automate.

Base URL: `https://ghostinthecodebase.vercel.app`

## 2. Users and authentication

Two seeded users: `alice` and `bob`.

- Every request must send the header `x-user-id` with a valid user id.
- Missing, empty or unknown `x-user-id` returns `401` with `{ "error": "unauthorized" }`.
- There are no tokens, sessions or cookies. The header is the only credential.

## 3. Seed data

| Invoice | Owner | Customer | Amount | Status |
| --- | --- | --- | --- | --- |
| `inv-1001` | alice | Acme Corp | 1200 | sent |
| `inv-1002` | bob | Globex | 850 | draft |

## 4. Functional requirements

### FR1 — List invoices

`GET /api/invoices`

- Returns `200` with `{ "invoices": [ ... ] }`.
- The list contains **only** invoices owned by the caller.
- For `bob`, the list contains `inv-1002` and must never contain `inv-1001`.

### FR2 — Read a single invoice

`GET /api/invoices/{id}`

- `200` when the invoice belongs to the caller, body `{ "invoice": { ... } }`.
- `403` when the invoice exists but belongs to a different user, body `{ "error": "forbidden" }`.
- `404` when the id does not exist, body `{ "error": "not_found" }`.
- `401` when `x-user-id` is missing or unknown.

### FR3 — Create an invoice

`POST /api/invoices`

- Body: `{ "customer": string, "amount": number, "currency"?: string }`.
- `201` with `{ "invoice": { ... } }`; the created invoice has `ownerId` equal to the caller, `status` `draft`, and `currency` defaulting to `USD`.
- `422` when `customer` is missing/empty or `amount` is not a number.
- `400` when the body is not valid JSON.
- `401` when `x-user-id` is missing or unknown.

## 5. Security requirement (critical)

**A user must never be able to read another user invoice.**

This is a Broken Object Level Authorization rule (OWASP API1:2023). The
acceptance test is: `bob` requests `GET /api/invoices/inv-1001`, an invoice owned
by `alice`.

- Pass: response is `403` and the response body does not contain the invoice data.
- Fail: response is `200`, or the body contains `inv-1001` / `Acme Corp`.

This single case is the regression guard for the whole API. It must fail the
build when it returns `200`.

## 6. Acceptance criteria

| # | Request | Expected |
| --- | --- | --- |
| AC1 | `alice` GET `/api/invoices/inv-1001` | `200`, `invoice.id = inv-1001` |
| AC2 | `bob` GET `/api/invoices/inv-1001` | `403`, no invoice payload |
| AC3 | `bob` GET `/api/invoices` | `200`, list has `inv-1002`, no `inv-1001` |
| AC4 | `alice` GET `/api/invoices/inv-9999` | `404` |
| AC5 | no `x-user-id` GET `/api/invoices/inv-1001` | `401` |
| AC6 | `alice` POST `/api/invoices` with `{ "customer": "Initech", "amount": 300 }` | `201`, `ownerId = alice`, `status = draft` |
| AC7 | `alice` POST `/api/invoices` with `{ "amount": 300 }` | `422` |

## 7. Out of scope

The marketing site, the dashboard UI, the 3D visualisation and any
authentication flow other than the `x-user-id` header. Do not generate tests
for those surfaces in this suite.
