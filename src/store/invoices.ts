// In-memory store for the live target API that TestSprite pokes.
// This simulates an "AI-generated app under observation": a tiny invoice
// service with one deliberate BOLA/IDOR vulnerability (OWASP API1:2023 #1)
// when SECURE_MODE is off. The vulnerability is gated by an env var so the
// TestSprite catch -> green story is reproducible without ever committing
// insecure code as the final main state.

export interface User {
  id: string;
  name: string;
}

export interface Invoice {
  id: string;
  ownerId: string;
  customer: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid";
  createdAt: string;
}

// matcha:adp seed data is deterministic so the TestSprite suite can reference
// a stable id (inv-1001) across cold starts on serverless.
const SEED_USERS: Record<string, User> = {
  alice: { id: "alice", name: "Alice" },
  bob: { id: "bob", name: "Bob" },
};

const SEED_INVOICES: Invoice[] = [
  {
    id: "inv-1001",
    ownerId: "alice",
    customer: "Acme Corp",
    amount: 1200,
    currency: "USD",
    status: "sent",
    createdAt: "2026-10-20T08:00:00.000Z",
  },
  {
    id: "inv-1002",
    ownerId: "bob",
    customer: "Globex",
    amount: 850,
    currency: "USD",
    status: "draft",
    createdAt: "2026-10-20T09:00:00.000Z",
  },
];

// Module-level store survives across requests within a single server instance.
// On serverless cold starts it re-seeds, which is fine because ids are stable.
const store: { users: Map<string, User>; invoices: Map<string, Invoice> } = {
  users: new Map(Object.entries(SEED_USERS)),
  invoices: new Map(SEED_INVOICES.map((i) => [i.id, i])),
};

/** When off, GET /api/invoices/:id skips the ownership check (the BOLA bug). */
export function isSecureMode(): boolean {
  return process.env.SECURE_MODE === "on";
}

export function getUser(id: string): User | undefined {
  return store.users.get(id);
}

export function listInvoices(ownerId: string): Invoice[] {
  return [...store.invoices.values()].filter((i) => i.ownerId === ownerId);
}

export function createInvoice(
  ownerId: string,
  input: { customer: string; amount: number; currency?: string },
): Invoice {
  const id = `inv-${Math.floor(1000 + Math.random() * 9000)}`;
  const invoice: Invoice = {
    id,
    ownerId,
    customer: input.customer,
    amount: input.amount,
    currency: input.currency ?? "USD",
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  store.invoices.set(id, invoice);
  return invoice;
}

/**
 * Fetch a single invoice.
 *
 * SECURE_MODE=off  -> returns ANY invoice regardless of owner (BOLA leak).
 * SECURE_MODE=on   -> enforces ownership; returns null when not allowed.
 */
export function getInvoice(
  id: string,
  requestingUserId: string,
): { invoice: Invoice | null; allowed: boolean } {
  const invoice = store.invoices.get(id);
  if (!invoice) return { invoice: null, allowed: false };

  if (!isSecureMode()) {
    // matcha:debt deliberate BOLA vulnerability for the TestSprite catch demo.
    // Remove (or keep SECURE_MODE=on) for the fixed state. Fix when main flips.
    return { invoice, allowed: true };
  }

  // Secure mode: distinguish "exists but forbidden" (403) from "not found" (404)
  // so the route can deny ownership explicitly instead of leaking existence.
  const allowed = invoice.ownerId === requestingUserId;
  return { invoice, allowed };
}
