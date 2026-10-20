# 🤝 Handoff — GhostInTheCodebase + CodeAutopsy (S4 Hackathon)

Doc ini buat yang **menerima project ini** (bukan yang bikin). Baca dari atas ke
bawah; ikuti langkah "To-Do S4" persis untuk dapat poin maksimal.

---

## 1. Ini apa?

Next.js app yang nempel **Code Autopsy & Time-Travel Debugger** ke sesi AI coding
agent, plus render codebase hasil AI jadi **3D "code city"** (GhostInTheCodebase).
Satu timeline, dua lensa:

- **CodeAutopsy** — rekam tiap turn agent (prompt → jawaban → diff → metrik
  runtime), deteksi anomali (leak / cpu-spin / hang / error-spike), tunjuk
  turn penyebabnya, satu klik rollback + heal.
- **GhostInTheCodebase** — modul = distrik, file = gedung, import = busur, glow
  amber = AI-written, pulse merah = regresi, "Fog of War" = kode AI belum
  direview (Comprehension Coverage).

Tagline: **"Lihat apa yang AI bangun. Tahu kapan ia merusaknya."**

---

## 2. Quick start (lokal)

```bash
npm install
npm run dev        # http://localhost:3000  (LOKAL SAJA — bukan target TestSprite)
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Dashboard di `/` langsung replay session demo (ada cerita memory-leak → heal),
jadi bisa dipresentasiin tanpa agent live.

---

## 3. To-Do S4 (WAJIB — ini yang bikin eligible & dapet poin)

Urutan penting. Rule 4 + 5: suite di-*generate* di **portal TestSprite** terhadap
**URL publik live** (bukan localhost), dan **GitHub App** yang jalanin di tiap PR.

1. **Deploy ke Vercel** — connect repo ini (`framework: Next.js`, tanpa config
   tambahan). App harus di URL publik selama SELURUH fase hackathon.
2. **`git init` + push** ke GitHub publik.
3. **Install GitHub App** TestSprite di repo ini.
4. **Generate suite di portal TestSprite** terhadap URL Vercel (bukan localhost).
   Suite menargetkan `GET /api/invoices/:id` (cek BOLA — lihat §4).
5. **Buat 3 PR** (lihat §5) supaya TestSprite jalan di tiap PR via GitHub App,
   dengan narasi **catch → green**.

> ⚠️ Jangan pernah bikin verdikt TestSprite palsu di repo. Suite asli di-*author*
> di portal vs URL deploy yang bener; GitHub App yang jalanin & lapor.

---

## 4. Target API yang diuji TestSprite

`app/api/invoices` menyimulasikan "app hasil AI yang lagi diamati":

- `GET  /api/invoices` — list invoice milik user (`x-user-id` header).
- `POST /api/invoices` — buat invoice.
- `GET  /api/invoices/:id` — **kerentanan BOLA/IDOR** saat `SECURE_MODE=off`:
  balikin invoice siapa pun tanpa cek kepemilikan. Saat `SECURE_MODE=on`:
  cross-owner → `403`.

Seed deterministik: user `alice` & `bob`, invoice `inv-1001` (milik alice).
Test di portal: **GET `/api/invoices/inv-1001` dengan `x-user-id: bob` harus
bukan 200** (harus `403` saat aman). Saat vuln → dapat `200` → suite **RED**.

---

## 5. Choreography 3-PR (catch → green)

Semua kode udah ada di working tree. Bagi jadi 3 PR dengan cara di bawah:

| PR | Isi | `SECURE_MODE` | Hasil TestSprite |
| -- | ---- | ------------- | ---------------- |
| **#1 — scaffold + dashboard + 3D** | Commit **semua** file, tapi pastikan default `SECURE_MODE=off` (sudah begitu di `src/store/invoices.ts`). Deploy. | `off` | 🔴 **RED** — BOLA ke-catch (bob baca invoice alice). |
| **#2 — fix** | Ubah default `isSecureMode()` jadi `on` (atau hapus vuln). | `on` | 🟢 **GREEN** — suite sama lolos. |
| **#3 — polish / innovation** | Commit perbaikan kecil supaya PR nggak kosong: mis. tambah `/api/health`, perkuat legend 3D, atau tulis contoh prompt replay. | `on` | 🟢 **GREEN** — guard regresi tetap hijau. |

Cara paling gampang bagi PR di git:
- PR #1: `git add -A && git commit -m "feat: scaffold + dashboard + 3D (vuln on)"`
- PR #2: edit `src/store/invoices.ts` → default `on` → commit.
- PR #3: commit apa pun yang bikin app makin "wow" (lihat ide di atas).

Set env `SECURE_MODE` di **Vercel project settings** (bukan cuma lokal) supaya
URL deploy ikut berubah tiap PR.

---

## 6. Yang MASIH STUB (bukan bug — memang scope scaffold)

- `src/collector/opencode.ts` — belum nempel ke OpenCode SSE/SDK. Sekarang
  dashboard replay dari `src/data/fixture.ts`.
- `src/runner/metrics.ts` — belum pakai `pidusage` beneran.
- `src/autopsy/engine.ts` — detektor anomali masih placeholder; fixture udah
  bawa anomaly + autopsy jadi contoh.

Kalau mau live (bukan replay), wiring ke OpenCode `opencode serve` SSE + SDK di
atas tiga file itu. Untuk demo hackathon, replay sudah cukup.

---

## 7. Catatan keamanan

`npm audit` nunjukin advisori `postcss` (critical/high) — itu **build-time** di
toolchain Next, nggak ikut ke app yang di-deploy (kita cuma pakai CSS sendiri).
Sengaja nggak lompat ke Next 16 (breaking) biar build stabil.

---

## 8. File inti

```
app/            dashboard (page/layout) + API invoices (live target TestSprite)
src/types.ts    model domain (session/turn/snapshot/metric/anomaly/autopsy)
src/store/      in-memory invoice store + gerbang SECURE_MODE (BOLA)
src/data/       fixture session demo (leak → heal)
src/components/ Dashboard, AIPanel, CodeDiff, MetricsChart, GhostCity (3D)
src/collector|runner|autopsy/  stub capture path
PRD_CONCEPT.md  PRD lengkap + Bagian C (kepatuhan TestSprite S4)
README.md       deploy + compliance + choreography
```