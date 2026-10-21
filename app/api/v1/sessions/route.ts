// Session API — sync target for the local Ghost recorder.
//   POST /api/v1/sessions  auth: Bearer <deviceToken>  body: session contract v1
//   GET  /api/v1/sessions  auth: web session cookie -> latest 50 sessions
//
// Policy (mirrors the recorder): the client scrubs secrets before sync, and
// prompts/diffs leave the machine only when sync=full was consented to.
import { NextRequest, NextResponse } from "next/server";
import { deviceFromRequest, userFromRequest } from "@/src/lib/auth";
import { q } from "@/src/lib/db";

export const runtime = "nodejs";

type IncomingSession = {
  v?: number;
  id?: string;
  repo?: string;
  status?: string;
  head?: string | null;
  startedAt?: string;
  endedAt?: string | null;
  sync?: string;
  turns?: Array<{ index?: number; id?: string | null; estimated?: boolean; agent?: string | null; prompt?: string | null; startedAt?: string; endedAt?: string | null; files?: string[] }>;
  checkpoints?: Array<{ turnNumber?: number | null; sha?: string; files?: string[]; ts?: string }>;
  samples?: Array<{ ts?: string; turnNumber?: number | null; probeFailed?: boolean; metrics?: Record<string, unknown> }>;
};

export async function POST(req: NextRequest) {
  const device = await deviceFromRequest(req);
  if (!device) return NextResponse.json({ error: "unauthorized device" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as IncomingSession | null;
  if (!body || body.v !== 1 || !body.id || !body.repo) {
    return NextResponse.json({ error: "expected session contract v1 {id, repo, …}" }, { status: 400 });
  }

  // project is per-user and keyed by the local repo name
  const { rows: projRows } = await q<{ id: string }>(
    `INSERT INTO projects (user_id, name) VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [device.userId, body.repo],
  );
  const projectId = projRows[0].id;

  const { rows: sessRows } = await q<{ id: string }>(
    `INSERT INTO sessions (project_id, external_ref, status, head, started_at, ended_at, sync, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      projectId,
      body.id,
      body.status ?? "recorded",
      body.head ?? null,
      body.startedAt ? safeDate(body.startedAt) : null,
      body.endedAt ? safeDate(body.endedAt) : null,
      body.sync ?? "off",
      body as unknown,
    ],
  );
  const sessionId = sessRows[0].id;

  for (const t of body.turns ?? []) {
    await q(
      `INSERT INTO turns (session_id, turn_index, external_id, estimated, agent, prompt, started_at, ended_at, files)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        sessionId,
        t.index ?? null,
        t.id ?? null,
        !!t.estimated,
        t.agent ?? null,
        t.prompt ?? null,
        t.startedAt ? safeDate(t.startedAt) : null,
        t.endedAt ? safeDate(t.endedAt) : null,
        JSON.stringify(t.files ?? []),
      ],
    );
  }
  for (const c of body.checkpoints ?? []) {
    await q(
      `INSERT INTO checkpoints (session_id, turn_index, sha, files) VALUES ($1, $2, $3, $4)`,
      [sessionId, c.turnNumber ?? null, c.sha ?? null, JSON.stringify(c.files ?? [])],
    );
  }
  for (const s of body.samples ?? []) {
    await q(
      `INSERT INTO metric_samples (session_id, turn_index, captured_at, probe_failed, metrics)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, s.turnNumber ?? null, s.ts ? safeDate(s.ts) : null, !!s.probeFailed, JSON.stringify(s.metrics ?? {})],
    );
  }

  return NextResponse.json({ sessionId, externalRef: body.id, synced: true });
}

type ListRow = {
  session_id: string;
  external_ref: string;
  status: string;
  sync: string;
  started_at: string;
  ended_at: string | null;
  project_name: string;
  head: string | null;
  turn_count: string;
  checkpoint_count: string;
  sample_count: string;
};

export async function GET(req: NextRequest) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const { rows } = await q<ListRow>(
    `SELECT s.id AS session_id, s.external_ref, s.status, s.sync, s.started_at, s.ended_at,
            s.head, p.name AS project_name,
            (SELECT count(*) FROM turns t WHERE t.session_id = s.id) AS turn_count,
            (SELECT count(*) FROM checkpoints c WHERE c.session_id = s.id) AS checkpoint_count,
            (SELECT count(*) FROM metric_samples m WHERE m.session_id = s.id) AS sample_count
       FROM sessions s
       JOIN projects p ON p.id = s.project_id
      WHERE p.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 50`,
    [user.uid],
  );

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.session_id,
      externalRef: r.external_ref,
      project: r.project_name,
      status: r.status,
      sync: r.sync,
      head: r.head,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      turns: Number(r.turn_count),
      checkpoints: Number(r.checkpoint_count),
      samples: Number(r.sample_count),
    })),
  });
}

function safeDate(v: string): string | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
