import type { NextRequest } from "next/server";

/** Derive the public origin (honors Vercel's forwarded headers). */
export function originFrom(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}
