import { NextRequest, NextResponse } from "next/server";
import {
  createInvoice,
  getUser,
  listInvoices,
  type Invoice,
} from "@/src/store/invoices";

// matcha:api this route is the live target TestSprite pokes. Always dynamic.
export const dynamic = "force-dynamic";

function userIdFrom(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

export async function GET(req: NextRequest) {
  const userId = userIdFrom(req);
  if (!userId || !getUser(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const invoices: Invoice[] = listInvoices(userId);
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const userId = userIdFrom(req);
  if (!userId || !getUser(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { customer?: string; amount?: number; currency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.customer || typeof body.amount !== "number") {
    return NextResponse.json(
      { error: "customer and numeric amount are required" },
      { status: 422 },
    );
  }
  const invoice = createInvoice(userId, {
    customer: body.customer,
    amount: body.amount,
    currency: body.currency,
  });
  return NextResponse.json({ invoice }, { status: 201 });
}
