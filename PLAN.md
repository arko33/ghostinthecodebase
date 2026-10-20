# PLAN — GhostInTheCodebase: Fase 1 "Real Loop" (Hackathon S4 Sprint)

> Tujuan: dari scaffold dummy → **loop nyata yang terekam, terdiagnosis, dan terheal**.
> Arah arsitektur: **Hybrid (C)** — MCP sebagai lapisan semantik + passive observer sebagai ground truth + autopsy engine sebagai fusion.
> Deadline project track: **22 Okt 2026, 23:59 PT (≈ 14:00 WIB 23 Okt)**.

---

## 0. Filosofi yang dikunci (referensi singkat)

- Ghost = **black box recorder + autopsy + time-travel** untuk AI coding agents, bukan sekadar dashboard.
- MCP = adaptor universal (semua agent besar support) → agnostik by construction.
- Passive observer (shadow git + pidusage) = kebenaran faktual, tanpa kerja sama agent ("trust but verify").
- 3D city merender `Snapshot` → otomatis agnostik, tidak peduli agent-nya siapa.
- Posisi pasar: *"Sentry untuk regresi yang disebabkan agent"* / *"dashcam untuk vibe coding"* — layer observasi di antara maker (Copilot/Cursor) dan checker (TestSprite).

---

## 1. Struktur target (yang berubah vs scaffold)

```
src/
├─ collector/
│  ├─ opencode.ts        # UBAH: real — konek `opencode serve` SSE → Turn[]
│  ├─ shadow-git.ts      # BARU: commit shadow per assistant turn → diff + rollback
│  └─ index.ts           # BARU: orchestrator (collector + runner + engine → Session live)
├─ runner/
│  └─ metrics.ts         # UBAH: real — pidusage polling → MetricSample[]
├─ autopsy/
│  └─ engine.ts          # UBAH: real — threshold + trend(slope) + attribution bisect
├─ mcp/
│  └─ server.ts          # BARU: MCP server minimal (stdio) — tools di bawah
├─ store/
│  └─ sessions.ts        # BARU: persist session JSON ke data/ (git-ignored)
└─ (komponen UI: upgrade kecil — live mode badge, tombol "Record session")
app/
└─ api/
   ├─ sessions/route.ts  # BARU (opsional): POST session hasil rekaman → dashboard live
   └─ (invoices tetap — target TestSprite, JANGAN diutak-atik)
```

**JANGAN disentuh:** `app/api/invoices/**`, `src/store/invoices.ts` (kecuali flip SECURE_MODE via env, bukan kode), fixture.ts tetap sebagai fallback demo.

---

## 2. Urutan implementasi (dependency order)

### Step 1 — Metrics runner nyata (paling kecil, unlock engine)
File: `src/runner/metrics.ts`
- `pidusage` (tambah dep) polling per `intervalMs` (default 2000ms) pada PID proses target (dev server / worker).
- Emit `MetricSample { turn, cpu, mem, errors, latency }`; `errors`/`latency` dari ping ke endpoint app (mis. `/api/invoices` 401 latency) atau counter.
- API tetap: `createMetricsRunner({ currentTurn })` → `sample()` dipanggil loop internal, buffer di dalam.
- Accept: 1 menit sampling menghasilkan deret yang naik-turun realistis; unit test kecil opsional.

### Step 2 — Shadow git (substrat rollback universal)
File: `src/collector/shadow-git.ts` (baru)
- `initShadow(repoPath)`: bikin bare/clone di `data/shadow.git` (git-ignored).
- `commitSnapshot(msg)`: `git add -A && git commit` di worktree → return hash.
- `diffAgainst(prevHash)`: `git diff prev..HEAD --unified=3` → parse ke `DiffHunk[]` (reuse bentuk types.ts).
- `rollbackTo(hash)`: untuk tombol heal/rollback UI nanti.
- Accept: dua commit berturut → diff ter-parse benar; rollback mengembalikan isi file.

### Step 3 — Collector OpenCode nyata (dogfooding!)
File: `src/collector/opencode.ts`
- Ganti stub: konek ke `opencode serve` (HTTP + SSE) — event `session.message`, `file.edited`, `tool.execute.*` (cek docs OpenCode SDK/serve untuk nama event persis; kalau nama beda, adaptasi di mapper saja).
- Mapping event → `Turn { role, text, changedFiles, diff, timestamp }`; tiap assistant turn selesai → `commitSnapshot()` (Step 2) → set `snapshotId`.
- `onTurn(cb)` dipanggil real-time; `start()/stop()` kelola koneksi.
- Accept: sesi OpenCode 3–4 prompt menghasilkan Session dengan turns + diffs nyata.

### Step 4 — Autopsy engine nyata
File: `src/autopsy/engine.ts`
- Layer 1 threshold: mem > 512MB, cpu > 90%, errors > 3, latency > 800ms (sudah ada konstanta).
- Layer 2 trend: slope mem/cpu antar window (mis. linear regression sederhana / delta rata-rata) → deteksi `leak` (mem naik monoton tanpa plateau) & `cpu-spin`.
- Layer 3 attribution: bisect delta metrik per turn — turn dengan lompatan terbesar sejak baseline = `blamedTurnId`.
- `buildAutopsy`: rootCause template dari kind+metric+turn; `fixPrompt` di-generate (kind-specific: leak → "add bounded eviction", cpu-spin → "profile loop", dll).
- Accept: fixture.ts lama (yang punya pola leak) ketika dilewatkan ke engine menghasilkan anomali yang setara dengan anomaly demo (sanity check vs data yang sudah ada).

### Step 5 — Session store + live API (opsional tapi murah)
File: `src/store/sessions.ts` + `app/api/sessions/route.ts`
- Persist `Session` JSON ke `data/sessions/<id>.json`.
- POST /api/sessions: collector kirim session final → dashboard bisa load live session (fallback ke fixture kalau kosong).
- Accept: rekam sesi → reload dashboard → sesi live tampil.

### Step 6 — MCP server minimal
File: `src/mcp/server.ts` (baru) + dep `@modelcontextprotocol/sdk`
- Tools:
  - `record_turn({ role, text, changedFiles })` — agent self-report (melengkapi SSE).
  - `get_autopsy({ session_id })` — return anomalies + autopsies + fixPrompt terbaru.
  - `propose_fix({ session_id, note })` — catat bahwa agent membaca verdict (log untuk demo).
- Jalankan via stdio; config contoh untuk OpenCode/Claude Code di README.
- Accept: dari config MCP, agent bisa memanggil `get_autopsy` dan mendapat JSON verdict.

### Step 7 — UI upgrade kecil (bukan rombak lagi)
- Badge "LIVE RECORDING" di topbar saat collector aktif (pakai state dari `/api/sessions` polling).
- Tombol rollback di kartu autopsy (panggil `rollbackTo`) — boleh stub alert kalau waktu sempit.
- Semua sudah Tailwind + Lucide — cuma tambah, tidak rombak.

### Step 8 — Eksekusi hackathon track (paralel, PENTING — deadline!)
Urutan wajib (ini yang dinilai judges, bukan kode Ghost):
1. `gh repo create ghostinthecodebase --public --source=. --push`
2. Deploy Vercel (`vercel` CLI sudah terpasang & login) → set env `SECURE_MODE=off` → catat live URL.
3. Akun TestSprite (email sama untuk submit) → generate suite di portal 3.0 terhadap live URL (target `/api/invoices` + BOLA).
4. Install GitHub App dari dashboard TestSprite → pilih repo → aktifkan **Blocking PRs**.
5. **PR #1**: branch kecil (mis. README tweak) → TestSprite comment RED (BOLA ketahuan).
6. **PR #2**: flip `SECURE_MODE=on` di Vercel env → rerun → GREEN.
7. Rekam demo video 2–3 menit (opsional tapi judges menonton): tampilkan Ghost merekam sesi nyata + kota 3D + RED→GREEN.
8. Post ke Discord `#hackathon-submissions`: link PR + live URL + email.

---

## 3. Alokasi waktu (±2 hari efektif)

| Slot | Kerja |
|---|---|
| Hari 1 pagi | Step 1 + 2 (runner + shadow git) |
| Hari 1 siang | **Step 8 poin 1–4** (push, deploy, akun, suite) — JANGAN ditunda |
| Hari 1 sore | Step 3 (collector OpenCode) |
| Hari 1 malam | Step 4 (engine) + sanity vs fixture |
| Hari 2 pagi | Step 8 poin 5–6 (PR RED → GREEN) |
| Hari 2 siang | Step 6 (MCP) + Step 5/7 kalau sempat |
| Hari 2 sore | Demo video + submit Discord (buffer sebelum 14:00 WIB besoknya) |

Prioritas jika waktu mepet: **Step 8 > Step 3 > Step 4 > Step 1 > Step 2 > Step 6 > Step 5/7.**
(Hackathon dinilai dari loop TestSprite yang jalan; Ghost real-time adalah pembeda innovation, bukan syarat.)

---

## 4. Risiko & mitigasi

- **SSE OpenCode format beda dari dugaan** → mapper terisolasi di collector; fallback: rekam via shadow git + metrics saja (passive-only tetap demo-able).
- **Vercel cold start mereset store invoices** → sudah aman: seed id `inv-1001` deterministik.
- **Waktu mepet** → Step 5 & 7 boleh dibuang; MCP boleh jadi "read-only" (hanya get_autopsy).
- **Suite TestSprite gagal generate** → pastikan live URL tanpa auth; endpoint sederhana; cek docs portal.

## 5. Definition of Done (hackathon)

- [ ] Repo public + README (app · live URL · cakupan suite) ✔ sudah ada, update live URL
- [ ] Live URL Vercel hidup selama build window
- [ ] Suite TestSprite ada di portal 3.0
- [ ] ≥1 PR dengan TestSprite check, akhirnya GREEN
- [ ] Submission ter-post di Discord sebelum deadline
- [ ] Bonus: Ghost merekam ≥1 sesi nyata (bukan fixture) + autopsy verdict + city 3D menyala

## 6. Pasca-hackathon (Fase 2 — jangan dikerjakan sekarang)

- Adaptor Claude Code (JSONL transcript) & Codex; publish MCP server ke npm.
- Cloud dashboard + shareable replay link; GitHub App: komentar PR berisi autopsy summary.
- Monetisasi: team workspace, kebijakan "no merge tanpa autopsy bersih".
