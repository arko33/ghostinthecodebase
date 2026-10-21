// Record a session from a real repository + a running app, then write the JSON
// the playground replays.
//
//   npm run record -- --repo . --health http://localhost:3000/api/health --duration 60
//
// Drop the resulting session.json into /playground to see the timeline, the 3D
// city and the autopsy for YOUR session instead of the demo fixture.

import fs from "node:fs";
import path from "node:path";
import { recordSession } from "../src/collector/record.ts";

function arg(name: string, fallback: string): string {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  return fallback;
}

const repoPath = path.resolve(arg("repo", process.cwd()));
const healthUrl = arg("health", "http://localhost:3000/api/health");
const durationMs = Number(arg("duration", "60")) * 1000;
const intervalMs = Number(arg("interval", "2")) * 1000;
const out = path.resolve(arg("out", "session.json"));

console.log(`recording ${repoPath}`);
console.log(`probing   ${healthUrl}`);
console.log(`window    ${durationMs / 1000}s, sampling every ${intervalMs / 1000}s\n`);

const session = await recordSession({ repoPath, healthUrl, durationMs, intervalMs });

fs.writeFileSync(out, JSON.stringify(session, null, 2));

const leaks = session.anomalies.length;
console.log(`turns     ${session.turns.length}`);
console.log(`samples   ${session.metrics.length}`);
console.log(`anomalies ${leaks}${leaks ? " — " + session.anomalies.map((a) => a.kind).join(", ") : ""}`);
console.log(`written   ${out}`);
console.log("\nopen /playground and drop the file in to replay it.");
