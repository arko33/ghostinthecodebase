// One-shot: apply db/schema.sql to DATABASE_URL (idempotent, CREATE IF NOT EXISTS).
import fs from "node:fs";
import pg from "pg";

const url = (process.env.DATABASE_URL ?? "").replace(/[?&]channel_binding=[^&]*/g, "");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  const sql = fs.readFileSync("db/schema.sql", "utf8");
  await pool.query(sql);
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`,
  );
  console.log("schema OK →", rows.map((r) => r.table_name).join(", "));
} catch (e) {
  console.error("SCHEMA ERR:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
