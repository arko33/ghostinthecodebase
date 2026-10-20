# PRD: CodeAutopsy — AI Code Autopsy & Time-Travel Debugger

Versi 1.0 · 20 Oktober 2026 · Status: Draft untuk eksekusi hackathon

## 1. Ringkasan Eksekutif

CodeAutopsy adalah dashboard yang menempel pada sesi AI coding agent (target utama: OpenCode) dan merekam tiga hal dalam satu garis waktu: (1) prompt dan jawaban AI, (2) perubahan kode per giliran (turn), (3) perilaku aplikasi saat berjalan (CPU, memori, log error). Ketika aplikasi melambat, bocor memori, atau hang, pengguna menggeser slider waktu mundur, melihat kode kembali ke versi sehat, dan mendapat "hasil autopsi": prompt mana, file mana, dan baris mana penyebabnya. Satu klik kemudian, sistem melakukan rollback dan mengirim prompt perbaikan otomatis kembali ke sesi OpenCode.

Kalimat jualan: **"Git blame untuk keputusan AI, lengkap dengan dampak performanya."**

Diferensiasi utama: tool observability agent yang ada (AgentOps, Langfuse, Rewind, Tarsa) fokus pada jejak panggilan LLM dan tool. CodeAutopsy menghubungkan **perubahan kode yang dibuat AI** dengan **dampaknya pada aplikasi yang sedang berjalan**, lalu menunjuk giliran AI yang bertanggung jawab.

**Update v1.1:** PRD ini diperluas dengan ide kedua, GhostInTheCodebase (peta arsitektur 3D). Keduanya digabung jadi satu platform: CodeAutopsy menjadi "Autopsy Lens" di dalam GhostInTheCodebase. Lihat Bagian B setelah bagian 22.

## 2. Validasi Konsep Awal (Hasil Riset)

Dokumen konsep awal sudah punya ide inti yang kuat, tetapi beberapa klaim teknisnya perlu dikoreksi supaya MVP benar-benar bisa dibangun.

| Klaim di dokumen awal | Fakta hasil riset | Dampak ke desain |
| --- | --- | --- |
| ACP = Access Control Policy / Agile Collaborative Platform | ACP adalah **Agent Client Protocol**, protokol terbuka (dibuat Zed) untuk komunikasi editor dan AI coding agent lewat JSON-RPC di stdio, mirip LSP. OpenCode mendukungnya lewat perintah `opencode acp`. | ACP bukan sistem izin. Fitur "audit keamanan" harus dibangun sendiri sebagai rule engine (lihat FR-31). |
| "OpenCode Sandbox" / Cloud IDE | Tidak ada produk bernama itu yang saya temukan. OpenCode adalah agent terminal open-source yang punya server HTTP headless (`opencode serve`). Ada plugin komunitas untuk menjalankan sesi di sandbox Daytona. | Integrasi dilakukan ke server HTTP/SDK OpenCode, bukan ke "Cloud IDE". |
| Menempel ke Session ID sebagai middleware | OpenCode menyediakan REST API sesi (daftar pesan, diff sesi, revert) dan stream event SSE. Ada juga SDK resmi JS, Go, Python. | Jalur integrasi utama: **Collector eksternal** via SDK + SSE. Tidak perlu memodifikasi OpenCode. |
| Snapshot kode di Redis | Untuk diff dan rollback, repo Git bayangan (shadow repo) lebih tepat: diff, restore, dan bisect sudah tersedia gratis. | Snapshot = commit di shadow repo. Redis tidak diperlukan di MVP. |
| Fitur "time-travel" unik | AgentOps, Rewind, dan Tarsa sudah punya time-travel/replay untuk agent. | Time-travel saja bukan pembeda. Pembedanya: korelasi **diff kode ↔ metrik runtime ↔ giliran prompt** plus autopsi sebab-akibat. |
| Contoh prompt "memori cacing (caching)" | Typo; maksudnya memori cache. | Gunakan prompt "tambahkan cache in-memory" di demo. |

Catatan: nama persis beberapa endpoint (terutama revert) perlu diverifikasi dalam spike teknis di awal (lihat bagian 18).

## 3. Lanskap dan Kompetitor

| Tool | Kekuatan | Celah yang bisa diisi CodeAutopsy |
| --- | --- | --- |
| AgentOps | Session replay dan time-travel untuk agent, multi-framework | Tidak melihat dampak runtime dari kode yang ditulis agent |
| Langfuse / LangSmith | Tracing LLM, biaya, evaluasi | Berorientasi request/response, bukan sesi coding; tanpa replay interaktif |
| Rewind | Debugger time-travel untuk agent, fork lalu replay dengan perbaikan | Fokus perilaku agent (panggilan LLM), bukan metrik aplikasi hasil kodenya |
| Tarsa | Observabilitas real-time sesi Claude Code, scrubber waktu, diff antar sesi | Hanya Claude Code; tidak ada korelasi performa aplikasi |
| opencode-plugin-otel, Tokenscope | Telemetri dan analisis token sesi OpenCode | Tidak ada autopsi penyebab atau rollback |

Kesimpulan: ruang "AI-generated code → regresi runtime → atribusi ke prompt" masih relatif kosong. Itulah sudut produk ini.

## 4. Problem Statement

- Developer menerima kode dari AI dalam jumlah besar dan cepat; bug performa (memory leak, loop tak berujung, koneksi tidak ditutup) tidak terlihat saat review sekilas.
- Ketika masalah muncul belakangan, sulit menjawab: giliran AI yang mana yang menyebabkannya? Prompt apa yang memicunya? Apa yang diubah?
- Memperbaiki biasanya berarti membaca ulang banyak diff secara manual atau meminta AI memperbaiki tanpa konteks lengkap, sehingga sering memperparah.

Hipotesis: jika setiap giliran AI dikaitkan otomatis dengan snapshot kode dan metrik runtime, waktu menemukan akar masalah turun drastis. Hipotesis ini divalidasi lewat metrik di bagian 19.

## 5. Visi, Tujuan, Non-Goals

**Visi:** setiap perubahan yang dibuat AI bisa diaudit, diputar ulang, dan dibatalkan dengan aman.

**Tujuan MVP (hackathon):**

1. Terhubung ke sesi OpenCode lokal dalam kurang dari 30 detik.
2. Menampilkan timeline giliran AI dengan diff kode dan grafik CPU/memori yang sinkron.
3. Mendeteksi anomali (leak, CPU tinggi berkelanjutan, hang, error) dan menunjuk giliran penyebab.
4. Menghasilkan laporan autopsi (penyebab, file, baris, saran perbaikan).
5. Rollback dan kirim prompt perbaikan dengan satu klik.

**Non-goals MVP:** membangun IDE cloud sendiri; mendukung semua agent (Cursor, Claude Code, dsb.); profiling mendalam level bahasa; multi-tenant dan billing; deteksi bug logika non-performa.

## 6. Persona

| Persona | Kebutuhan | Pain |
| --- | --- | --- |
| Dina, developer solo yang "vibe coding" dengan OpenCode | Tahu kapan AI merusak aplikasi dan cara membatalkannya cepat | Tidak sempat review semua diff |
| Raka, tech lead tim kecil | Audit jejak keputusan AI, mencegah perubahan berisiko masuk | Tidak ada riwayat prompt ↔ kode ↔ dampak |
| Juri hackathon | Memahami nilai dalam 90 detik | Demo bertele-tele atau gagal di panggung |

## 7. User Stories

- US-1: Sebagai developer, saya ingin menghubungkan dashboard ke sesi OpenCode agar semua giliran AI tercatat otomatis.
- US-2: Saya ingin melihat grafik CPU/memori sejajar dengan timeline giliran AI agar tahu kapan performa memburuk.
- US-3: Saya ingin menggeser slider waktu dan melihat kode pada titik itu agar bisa membandingkan versi sehat vs rusak.
- US-4: Saya ingin laporan autopsi yang menyebut giliran, file, baris, dan alasan teknis agar tidak membaca ratusan baris kode.
- US-5: Saya ingin rollback ke giliran sehat dan prompt perbaikan otomatis dengan satu klik.
- US-6: Sebagai tech lead, saya ingin aturan yang menandai AI mengubah file sensitif (mis. `.env`) agar bisa diaudit.

## 8. Kebutuhan Fungsional

Prioritas: P0 = wajib demo, P1 = sebaiknya ada, P2 = pasca-hackathon.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-01 | Menghubungkan ke server OpenCode (URL + kata sandi opsional) dan memilih sesi aktif | P0 |
| FR-02 | Berlangganan stream event SSE dan menyimpan setiap giliran (prompt, balasan AI, tool call, file yang diubah) | P0 |
| FR-03 | Membuat snapshot kode (commit shadow repo) setiap giliran AI selesai | P0 |
| FR-04 | Menjalankan aplikasi target lewat Runner dan mengambil CPU, memori, dan log stdout/stderr tiap 500 ms | P0 |
| FR-05 | Menjalankan "probe" setelah tiap giliran (perintah workload atau hit endpoint selama N detik) untuk membandingkan metrik dengan baseline | P0 |
| FR-06 | Deteksi anomali: tren memori naik terus, CPU tinggi berkelanjutan, proses tidak merespons health check, lonjakan error | P0 |
| FR-07 | Dashboard tiga panel: diff kode, grafik metrik, panel prompt/analisis AI | P0 |
| FR-08 | Slider timeline: geser untuk melihat snapshot, metrik, dan prompt pada titik waktu tertentu | P0 |
| FR-09 | Atribusi: menunjuk giliran paling awal yang menyebabkan regresi | P0 |
| FR-10 | Laporan autopsi terstruktur (penyebab, file, rentang baris, tingkat keparahan, saran perbaikan) | P0 |
| FR-11 | Highlight baris bermasalah (kotak merah) di diff viewer | P0 |
| FR-12 | Tombol "Rollback & Fix": pulihkan file ke snapshot sehat dan kirim prompt perbaikan ke sesi OpenCode | P0 |
| FR-13 | Mode Replay dari fixture rekaman untuk demo tanpa ketergantungan jaringan/LLM | P0 |
| FR-20 | Auto-bisect: uji snapshot berurutan di sandbox untuk memastikan giliran penyebab | P1 |
| FR-21 | Ekspor laporan autopsi (Markdown/PDF) dan link berbagi | P1 |
| FR-22 | Bandingkan dua sesi atau dua giliran | P1 |
| FR-30 | Dukungan Python (psutil) di Runner | P1 |
| FR-31 | Rule engine kebijakan: tandai/blokir edit pada file sensitif lewat hook plugin OpenCode | P2 |
| FR-32 | Adapter agent lain lewat ACP (mendengarkan JSON-RPC) | P2 |
| FR-33 | Integrasi CI: gagalkan PR jika autopsi menemukan regresi | P2 |

## 9. Kebutuhan Non-Fungsional

| Aspek | Target |
| --- | --- |
| Latensi event → tampil di dashboard | < 1 detik |
| Overhead pada sesi OpenCode | Tidak menambah latensi (collector eksternal, hanya membaca) |
| Waktu pembuatan laporan autopsi | < 10 detik |
| Keamanan | Semua data lokal secara default; kunci API disimpan di variabel lingkungan; rollback selalu membuat backup snapshot lebih dulu |
| Privasi | Prompt dan kode tidak dikirim ke pihak ketiga kecuali ke LLM autopsi yang dikonfigurasi pengguna; ada opsi redaksi rahasia (regex untuk token/kunci) |
| Keandalan demo | Mode Replay (FR-13) selalu tersedia sebagai cadangan |
| Kompatibilitas | macOS/Linux; Node 20+ |

## 10. Arsitektur Sistem

Tiga jalur integrasi dengan OpenCode, dipilih berdasarkan kebutuhan:

1. **Collector eksternal (utama):** SDK resmi + stream SSE (`/event`, `/global/event`) + REST (`/session/:id/message`, `/session/:id/diff`, revert). Tidak invasif, bahasa-agnostik.
2. **Plugin OpenCode (opsional):** hook `file.edited`, `tool.execute.before/after`, `session.diff`, `session.idle` untuk data lebih granular dan untuk memblokir aksi (FR-31).
3. **ACP (masa depan):** untuk agent lain yang bicara Agent Client Protocol (FR-32).

```
┌────────────────────┐   SSE + REST    ┌─────────────────────────┐
│ OpenCode server    │ ◄─────────────► │ Collector (Node/TS)     │
│ (opencode serve)   │                 │  - event ingester       │
└─────────┬──────────┘                 │  - snapshotter (git)    │
          │ edit file                  │  - autopsy engine       │
          ▼                            └───────────┬─────────────┘
┌────────────────────┐  stdout/stderr              │ WebSocket + REST
│ Workspace + Runner │ ───────────────────────────►│
│ (app target, PID)  │  CPU/mem via pidusage       ▼
└────────────────────┘                 ┌─────────────────────────┐
                                       │ Dashboard (Next.js)     │
   Shadow Git repo ◄── commit per turn │  diff · chart · slider  │
   SQLite (timeline)                   └─────────────────────────┘
```

**Alur data per giliran:**

1. User mengirim prompt di OpenCode → event pesan masuk, Collector membuat `turn` baru.
2. AI mengedit file → event file/tool; saat giliran selesai (`session.idle`), Collector membuat snapshot commit.
3. Runner me-restart/hot-reload aplikasi, menjalankan probe, mengumpulkan metrik.
4. Anomaly detector membandingkan metrik probe dengan baseline giliran sebelumnya.
5. Jika anomali, Autopsy Engine dipanggil; hasil di-push ke dashboard lewat WebSocket.

## 11. Model Data

Penyimpanan: SQLite (MVP), skema siap dipindah ke PostgreSQL.

| Tabel | Kolom penting |
| --- | --- |
| sessions | id, opencode\_session\_id, workspace\_path, started\_at, target\_command |
| turns | id, session\_id, idx, prompt\_text, assistant\_text, tool\_calls (JSON), files\_changed (JSON), started\_at, ended\_at |
| snapshots | id, turn\_id, commit\_sha, diff\_patch, created\_at |
| metric\_samples | id, session\_id, turn\_id, ts, cpu\_pct, mem\_mb, event\_loop\_lag\_ms, healthy (bool) |
| log\_events | id, session\_id, turn\_id, ts, level, message, stack |
| anomalies | id, turn\_id, type (leak/cpu\_spin/hang/error\_spike), severity, evidence (JSON) |
| autopsies | id, anomaly\_id, culprit\_turn\_id, file, line\_start, line\_end, root\_cause, explanation, fix\_prompt, confidence |

Contoh satu entri timeline (format yang dikirim ke dashboard):

```json
{
  "turnIdx": 3,
  "ts": "2026-10-20T10:42:11Z",
  "prompt": "Tambahkan cache in-memory ke fungsi pencarian",
  "commit": "a1b2c3d",
  "filesChanged": ["src/search.ts"],
  "metrics": { "cpuAvg": 38, "memStartMb": 120, "memEndMb": 610, "memSlopeMbPerSec": 24.5 },
  "anomaly": { "type": "leak", "severity": "high" },
  "autopsy": { "file": "src/search.ts", "lines": [38, 46], "rootCause": "Cache Map tanpa batas ukuran dan tanpa eviction" }
}
```

## 12. Autopsy Engine

Pendekatan dua lapis agar hasil cepat, deterministik, dan tetap cerdas.

**Lapis 1 — Deteksi anomali (kode biasa, tanpa LLM):**

- Leak: regresi linear pada memori selama jendela probe; slope di atas ambang (mis. > 5 MB/detik atau > 3× baseline) dan tidak turun setelah GC/idle.
- CPU spin: CPU > 90% berkelanjutan > 5 detik, atau event-loop lag tinggi.
- Hang: health check gagal berturut-turut.
- Error spike: jumlah log error per detik melewati ambang.

**Lapis 2 — Pemindai pola statis pada diff giliran terkait (heuristik cepat):**

- Koleksi global (`Map`/array/objek) yang terus ditambah tanpa batas atau eviction.
- `setInterval`/listener/stream/koneksi tanpa penutupan atau pembersihan.
- `while(true)` atau rekursi tanpa kondisi berhenti jelas.
- Promise/event handler yang menumpuk di dalam loop.

**Lapis 3 — Penalaran LLM (model Claude, dapat dikonfigurasi):** Input: prompt manusia, diff giliran, bukti anomali (grafik ringkas, stack trace), temuan pola. Output JSON ketat: `culprit_turn`, `file`, `line_start`, `line_end`, `root_cause`, `explanation`, `fix_prompt`, `confidence`. Jika LLM tidak tersedia, laporan tetap dibuat dari Lapis 1–2.

**Atribusi giliran:** giliran penyebab adalah yang pertama kali probe-nya melewati ambang dibanding baseline. Jika ada beberapa kandidat (P1), auto-bisect menjalankan snapshot secara berurutan di sandbox untuk konfirmasi.

## 13. Rollback dan Healing

Dua mode, keduanya dapat dipakai bersamaan:

1. **Rollback file:** pulihkan working directory ke snapshot sehat dari shadow repo. Sebelum itu, buat snapshot cadangan agar aksi bisa dibatalkan (undo).
2. **Healing lewat OpenCode:** kirim `fix_prompt` hasil autopsi ke sesi lewat endpoint pesan asinkron (`prompt_async`) sehingga AI memperbaiki dengan konteks akar masalah yang benar. Alternatif: memakai fitur revert sesi OpenCode ke pesan tertentu.

Pengaman: dialog konfirmasi menampilkan daftar file yang akan berubah; rollback tidak pernah menyentuh file di luar workspace; tidak ada operasi destruktif tanpa snapshot cadangan.

## 14. Tech Stack

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Collector/Backend | Node.js 20 + TypeScript, Fastify, `ws` | SDK resmi OpenCode tersedia untuk JS/TS; Fastify ringan dan cepat |
| Integrasi OpenCode | SDK JS resmi + SSE; plugin `@opencode-ai/plugin` (opsional) | Jalur resmi, tidak invasif |
| Snapshot | Git CLI dengan `--git-dir` terpisah (shadow repo), `simple-git` | Diff, restore, dan bisect gratis |
| Runner & metrik | `child_process` + `pidusage` (Node), `psutil` (Python, P1) | Ringan, lintas platform |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM | Nol konfigurasi untuk hackathon; mudah migrasi ke PostgreSQL |
| Real-time | WebSocket (`ws`) | Cukup untuk satu pengguna; Socket.io tidak wajib |
| Frontend | Next.js (atau Vite + React), TypeScript | Cepat dibangun, ekosistem luas |
| UI | Tailwind CSS + shadcn/ui | Tampilan modern dengan cepat |
| Grafik | Recharts (atau Chart.js) | Mudah disinkronkan dengan slider |
| Diff viewer | `@monaco-editor/react` (DiffEditor) | Familiar bagi developer (editor VS Code) |
| State | Zustand + TanStack Query | Sederhana untuk state timeline |
| LLM autopsi | Anthropic SDK (model Claude, dikonfigurasi lewat env) dengan output JSON terstruktur | Kualitas analisis kode tinggi |
| Pengujian | Vitest (unit), Playwright (e2e demo) | Menjaga demo tidak rusak |
| Paket/Deploy | pnpm workspaces (monorepo), Docker Compose untuk demo | Satu perintah untuk menjalankan semua |

Struktur monorepo:

```
code-autopsy/
  apps/dashboard/        # Next.js UI
  apps/collector/        # Fastify + SDK + SSE ingester
  packages/runner/       # proses target + metrik
  packages/autopsy/      # detektor, pemindai pola, klien LLM
  packages/shared/       # tipe, skema Zod
  fixtures/              # rekaman sesi untuk mode Replay
  demo-app/              # aplikasi contoh dengan bug yang disiapkan
```

## 15. Spesifikasi UI/UX

**Tata letak (satu layar, cocok untuk proyektor):**

- **Atas:** status koneksi (sesi, branch, proses target), tombol Replay Mode.
- **Kiri (45%):** Monaco DiffEditor untuk giliran terpilih; baris penyebab diberi kotak merah dan label "Autopsy".
- **Kanan (30%):** panel "AI Thoughts": prompt manusia, ringkasan balasan AI, kartu laporan autopsi (penyebab, keparahan, tingkat keyakinan, tombol Rollback & Fix).
- **Bawah (25%):** grafik CPU/memori dengan penanda vertikal per giliran; slider timeline berbentuk kepala pemutar (scrubber); giliran bermasalah berwarna merah.

**Interaksi kunci:**

- Menggeser slider memperbarui diff, grafik (garis posisi), dan panel prompt secara bersamaan.
- Animasi "kode memudar kembali" saat mundur ke giliran sehat (transisi diff).
- Setelah Rollback & Fix: banner hijau "Pulih" dan grafik kembali normal secara live.

**Keadaan khusus:** belum terhubung, sesi kosong, tidak ada anomali (tampilkan ringkasan sehat), autopsi gagal (tampilkan temuan Lapis 1–2 saja).

## 16. Antarmuka Internal (API)

| Endpoint | Fungsi |
| --- | --- |
| POST /api/connect | Menyimpan URL server OpenCode dan memilih sesi |
| GET /api/sessions/:id/timeline | Seluruh giliran + metrik teragregasi |
| GET /api/turns/:id | Detail giliran: prompt, diff, log |
| GET /api/turns/:id/metrics | Sampel metrik giliran |
| POST /api/turns/:id/autopsy | Memicu ulang autopsi |
| POST /api/turns/:id/rollback | Rollback file ke snapshot giliran tersebut |
| POST /api/autopsies/:id/heal | Mengirim fix\_prompt ke sesi OpenCode |
| POST /api/replay/start | Memulai mode Replay dari fixture |
| WS /ws | Event: `turn.created`, `metrics.sample`, `anomaly.detected`, `autopsy.ready`, `heal.done` |

## 17. Skenario Demo dan Rencana Cadangan

Durasi total sekitar 2 menit.

1. **Hubungkan (10 dtk):** tunjukkan dashboard terhubung ke sesi OpenCode dan aplikasi demo berjalan dengan grafik stabil.
2. **AI membuat kerusakan (30 dtk):** ketik prompt: "Optimalkan fungsi pencarian agar sangat cepat dengan menambahkan cache in-memory." AI menulis cache tanpa batas ukuran. Probe berjalan, grafik memori melonjak.
3. **Autopsi + time-travel (40 dtk):** anomali terdeteksi; geser slider mundur ke giliran sebelumnya, kode kembali ke versi aman, grafik turun; kartu autopsi menunjuk giliran #3, `src/search.ts` baris 38–46.
4. **Rollback & Fix (20 dtk):** satu klik; kode dipulihkan, prompt perbaikan dikirim, AI menambahkan batas ukuran dan eviction (LRU); grafik stabil.
5. **Penutup (20 dtk):** tampilkan perbandingan: waktu menemukan akar masalah manual vs dengan CodeAutopsy.

**Risiko demo dan mitigasi:** keluaran LLM tidak deterministik, sehingga bug mungkin tidak muncul saat live. Mitigasi: (a) siapkan prompt dan aplikasi demo yang sudah diuji berulang; (b) simpan satu sesi sukses sebagai fixture dan sediakan **Mode Replay** yang memutar ulang event ke dashboard persis seperti live; (c) siapkan tombol "Inject known-bad turn" untuk memaksa skenario jika AI menulis kode yang kebetulan benar.

## 18. Rencana Eksekusi

Jadwal fleksibel; sesuaikan dengan sisa waktu hackathon. Urutan ini meminimalkan risiko.

| Fase | Isi | Keluaran |
| --- | --- | --- |
| 0. Spike teknis (3–4 jam) | Jalankan `opencode serve`; uji SSE, ambil pesan dan diff, uji endpoint revert dan `prompt_async`; uji `pidusage` pada proses target | Daftar endpoint yang terbukti bekerja; putuskan jalur rollback final |
| 1. Pipa data (hari 1) | Collector: SSE → SQLite; snapshot shadow repo; Runner + metrik; WebSocket | Event nyata mengalir ke konsol |
| 2. Dashboard inti (hari 2) | Layout tiga panel, Monaco Diff, grafik, slider tersinkron | Timeline interaktif dengan data nyata |
| 3. Deteksi + autopsi (hari 3) | Detektor anomali, pemindai pola, klien LLM, kartu autopsi, highlight baris | Laporan autopsi otomatis |
| 4. Rollback & Fix + Replay (hari 4) | Rollback, healing, fixture dan Mode Replay | Demo end-to-end tanpa jaringan |
| 5. Polish (hari 5) | Animasi, README, video demo cadangan, latihan presentasi, uji e2e | Siap tampil |

Jika waktu sangat singkat: potong ke FR-01 sampai FR-13 dengan satu bahasa (Node) dan satu jenis anomali (memory leak) yang dikerjakan sangat matang.

## 19. Metrik Keberhasilan

| Metrik | Target MVP |
| --- | --- |
| Ketepatan atribusi giliran pada skenario uji (5 bug yang disiapkan) | ≥ 80% |
| Waktu dari anomali ke laporan autopsi | < 10 detik |
| Waktu menemukan akar masalah vs manual (uji dengan 3 orang) | Turun minimal 50% |
| Keberhasilan demo end-to-end (10 percobaan berturut-turut) | ≥ 9/10 (dengan Mode Replay 10/10) |
| Waktu setup pengguna baru | < 5 menit |

## 20. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Endpoint/perilaku OpenCode berubah atau berbeda dari dokumentasi | Integrasi gagal | Spike fase 0; kunci versi OpenCode; lapisan adaptor tipis |
| Atribusi salah (bukan giliran terakhir penyebabnya) | Laporan menyesatkan | Bandingkan terhadap baseline; auto-bisect (FR-20); tampilkan tingkat keyakinan |
| LLM berhalusinasi nomor baris | Highlight salah | Validasi rentang baris terhadap diff; fallback ke temuan pola statis |
| Metrik berisik (GC, warmup) | Positif palsu | Jendela probe + baseline + ambang relatif, bukan absolut |
| Rollback merusak pekerjaan pengguna | Kehilangan kode | Snapshot cadangan wajib, konfirmasi, tombol undo |
| Kebocoran data sensitif ke LLM | Privasi | Redaksi rahasia, opsi mode lokal tanpa LLM, data default lokal |
| Demo gagal di panggung | Reputasi | Mode Replay, video cadangan, uji e2e |

## 21. Roadmap Pasca-Hackathon

- **v0.2:** Python dan Go di Runner; auto-bisect penuh; ekspor laporan.
- **v0.3:** Adapter ACP untuk agent lain; plugin OpenCode untuk kebijakan keamanan (blokir edit file sensitif).
- **v0.4:** Integrasi CI/PR (gagalkan PR bila ada regresi dari kode AI); dashboard tim dengan PostgreSQL.
- **v1.0:** Profil perilaku agent/model (model mana paling sering memicu leak), rekomendasi guardrail prompt.

## 22. Pertanyaan Terbuka

1. Berapa lama waktu hackathon dan format penilaiannya (demo langsung atau video)?
2. Bahasa aplikasi target untuk demo: Node.js saja atau Python juga?
3. Apakah LLM autopsi boleh memanggil API eksternal, atau harus bisa berjalan lokal?
4. Nama final produk (CodeAutopsy hanya nama kerja).

# Bagian B: Integrasi GhostInTheCodebase (Visual Reality Check for AI Architecture)

## B1. Keputusan Integrasi

GhostInTheCodebase dan CodeAutopsy digabung menjadi **satu produk dengan satu timeline dan dua lensa**: Peta Arsitektur 3D (apa yang AI bangun) dan Autopsy Lens (kapan dan kenapa AI merusak). Keduanya memakai pipa data yang sama (event OpenCode, snapshot per giliran, Runner), sehingga biaya tambahan hanya lapisan graf kode dan renderer 3D.

**Tagline gabungan:** "Lihat apa yang AI bangun. Tahu kapan ia merusaknya."

**Catatan:** pesan ide kedua terpotong di kalimat "Jika AI menulis kode yang buruk atau...". Saya mengasumsikan kelanjutannya: bagian peta yang terkena berubah merah/retak sebagai peringatan visual. Kirim sisanya jika berbeda, dan Bagian B akan saya sesuaikan.

| Aspek | CodeAutopsy (Bagian 1–22) | GhostInTheCodebase (Bagian B) | Hasil gabungan |
| --- | --- | --- | --- |
| Pertanyaan yang dijawab | Giliran AI mana yang merusak performa? | Apakah arsitektur aplikasi masih sehat dan saya pahami? | Apa yang berubah, apakah sehat, dan siapa penyebabnya |
| Data utama | Metrik runtime, diff | Graf dependensi, struktur file | Satu timeline berisi keduanya |
| Momen WOW | Slider mundur, kode memudar, kotak merah | Kota 3D tumbuh live saat AI menulis | Kota tumbuh, lalu bangunan penyebab memancarkan panas dan slider memutar balik |
| Nilai untuk juri | Akar masalah dalam hitungan detik | Kendali atas "kotak hitam" | Kendali + bukti + perbaikan satu klik |

## B2. Hasil Riset: Kompetitor Visualisasi 3D

Ringkasan berdasarkan hasil pencarian (halaman belum dibuka satu per satu; detail fitur perlu diverifikasi sebelum klaim publik).

| Tool | Yang dilakukan | Celah yang diisi GhostInTheCodebase |
| --- | --- | --- |
| [Mindwalk](https://betterstack.com/community/guides/ai/mindwalk-ai-agent/) (rilis Juli 2026, MIT) | Memutar ulang sesi AI agent sebagai kota 3D; tinggi bangunan = jumlah baris, oranye = file diedit agent; perintah `analyze` menilai metodologi agent (eksplorasi, cakupan, verifikasi) tanpa membaca kode | Fokus pada perilaku agent setelah sesi, bukan kesehatan arsitektur, tidak live, tidak ada metrik runtime, tidak ada intervensi |
| [codecity-ai](https://github.com/thalida/codecity-ai) | Plugin Claude Code yang membuat HTML kota isometrik 2.5D statis dari direktori dan riwayat git | Statis, bukan real-time; tanpa aturan arsitektur |
| [codecity (grahambrooks)](https://www.grahambrooks.com/post/seeing-your-codebase-as-a-city/) | Merender repo git sebagai kota 3D; layout bin-packing, volume bangunan = baris kode | Tidak terhubung ke sesi AI |
| [Code Visualizer](https://github.com/sat-wik/code-visualizer) (ekstensi VS Code) | Visualisasi WebGL berbasis Three.js dengan pembaruan otomatis dan pemetaan dependensi | Tidak membedakan perubahan AI vs manusia; tanpa health score dan tanpa rollback |
| [CodeCity akademik / BabiaXR](https://ceur-ws.org/Vol-2605/13.pdf) | Metafora kota klasik dan evolusi kota terhadap waktu | Riset, bukan produk untuk workflow AI coding |

**Temuan penting:** Mindwalk (2026) sudah menempati ruang "kota 3D untuk sesi AI agent". Jadi "kota 3D" saja bukan pembeda. Pembeda GhostInTheCodebase ada pada empat hal yang tidak ditemukan di tool di atas: (1) live saat AI menulis, (2) skor kesehatan arsitektur dengan aturan yang bisa dikonfigurasi, (3) korelasi dengan dampak runtime lewat Autopsy Lens, (4) aksi balik (rollback dan perbaikan).

## B3. Konsep Visual dan Kosakata Peta

Metafora: **kota kode**. Folder/modul = distrik, file = bangunan, import = jalan atau busur penghubung. Lapisan "hantu" menandai segala sesuatu yang baru ditulis AI dan belum dipahami manusia.

| Sinyal | Visual | Sumber data |
| --- | --- | --- |
| Distrik (modul/lapisan) | Blok berwarna per folder atau per lapisan arsitektur | Struktur folder + `.ghost.yml` |
| Ukuran file | Tinggi = jumlah baris; luas alas = jumlah simbol | Parser (tree-sitter) |
| File sedang ditulis AI | Orb cahaya (kursor agent) bergerak ke bangunan itu, bangunan berpendar amber | Event `file.edited`, tool call |
| File baru dari AI | Tumbuh dari tanah sebagai hologram cyan transparan, memadat setelah snapshot | Diff snapshot |
| Dependensi | Busur antar bangunan; tebal = jumlah import | Graf import |
| Siklus dependensi | Busur merah berkedip | Deteksi siklus |
| Pelanggaran lapisan (mis. UI mengimpor database langsung) | Busur oranye menembus batas distrik + label | Aturan di `.ghost.yml` |
| File "god" (terlalu besar/kompleks) | Bangunan menjulang, berdenyut | Ambang LOC/kompleksitas |
| Kode yatim (tidak diimpor siapa pun) | Bangunan transparan seperti hantu | Graf import |
| Regresi performa (dari Autopsy) | Bangunan penyebab memancarkan panas (heat glow), sinkron dengan grafik memori | Anomali + atribusi giliran |
| **Fog of War** (cakupan pemahaman) | Bangunan yang ditulis AI tapi belum pernah ditinjau manusia diselimuti kabut gelap; manusia "menyalakan" dengan membuka diff atau menekan Reviewed | Atribusi giliran + status review |

**Fog of War** adalah jawaban langsung atas masalah "kehilangan kendali": metrik **Comprehension Coverage** = persentase baris (atau file) hasil AI yang sudah ditinjau manusia. Peta yang penuh kabut memperlihatkan seberapa "kotak hitam" aplikasi itu.

Mode warna yang bisa diganti: Kesehatan, Churn (seberapa sering diubah), Runtime (panas), Penulis (AI vs manusia), Cakupan Pemahaman. Palet ramah buta warna dan setiap status punya penanda bentuk/ikon, tidak hanya warna.

## Lampiran: Sumber Riset

- Dokumentasi OpenCode: server HTTP (opencode.ai/docs/server), dukungan ACP (opencode.ai/docs/acp), ekosistem plugin (opencode.ai/docs/ecosystem).
- Repo OpenCode dan SDK resmi JS/Go/Python (daftar di awesome-opencode); plugin hooks (`file.edited`, `tool.execute.before/after`, `session.diff`, `session.idle`).
- Kompetitor: AgentOps, Langfuse, Rewind (risjai/rewind), Tarsa (elcronos/tarsa), perbandingan di latitude.so dan enterprisedna.co.
- Agent Client Protocol: agentclientprotocol.com.

---

## Bagian C — Kepatuhan TestSprite S4 (Wajib)

Produk ini tidak berdiri sendiri dari sisi penilaian: **setiap proyek S4 wajib
menggunakan TestSprite**. Karena itu CodeAutopsy/GhostInTheCodebase dibangun
*di atas* fondasi TestSprite, bukan sebagai pengganti. Berikut pemetaan aturan
S4 ke desain:

### C.1 Pemetaan Aturan S4

| Aturan | Kewajiban | Implementasi di repo ini |
| ------ | --------- | ------------------------ |
| **Rule 4 — TestSprite 3.0 Portal + GitHub App** | Suite di-*generate* **di portal** terhadap URL publik live; GitHub App menjalankan suite di setiap PR. | GitHub App dipasang di repo. Suite TestSprite di-*generate* di portal terhadap URL Vercel yang sudah *deploy* (bukan localhost). Berjalan otomatis di setiap PR lewat GitHub App. |
| **Rule 5 — URL publik selama seluruh fase build** | App harus di-URL publik untuk *seluruh* periode hackathon, bukan localhost. | Di-*deploy* ke Vercel sejak hari pertama dan tetap live. `npm run dev` hanya untuk dev lokal; target TestSprite selalu URL *deploy*. |
| **Rule 6 — Dokumentasi menjelaskan apa yang diuji** | README/PRD wajib menjelaskan target API dan cakupan suite. | README.md + bagian ini (`PRD_CONCEPT.md` §C) mendokumentasikan target API dan cakupan suite secara eksplisit. |

### C.2 Target API Live (yang diuji TestSprite)

Aplikasi Next.js mengekspos **live target API** di `/api/invoices` yang
menyimulasikan "app yang dibangun AI dan sedang diamati":

- `GET  /api/invoices` — list invoice milik user (filter `x-user-id`).
- `POST /api/invoices` — buat invoice untuk user terautentikasi.
- `GET  /api/invoices/:id` — ambil satu invoice. **Ketika `SECURE_MODE=off`,
  endpoint ini punya kerentanan BOLA/IDOR (OWASP API1:2023 #1): mengembalikan
  invoice siapa pun tanpa cek kepemilikan.** Saat `SECURE_MODE=on`, cek
  kepemilikan aktif.

Kerentanan sengaja ada supaya TestSprite punya "bug nyata" untuk ditangkap, dan
dikontrol via env var `SECURE_MODE` (default `off`) agar cerita *catch → green*
bisa direproduksi tanpa pernah menyimpan kode tidak aman sebagai state akhir di
`main`.

### C.3 Cerita Demo 3-PR (catch → green)

| PR | Isi | Hasil TestSprite |
| -- | ---- | ---------------- |
| **PR #1 — scaffold + dashboard** | App di-*deploy* dengan `SECURE_MODE=off` ("AI kirim kode vulnerable"). | 🔴 **RED** — suite menangkap BOLA (user A baca invoice user B). |
| **PR #2 — fix** | Tambah cek kepemilikan (`SECURE_MODE=on` / hapus vuln). | 🟢 **GREEN** — suite yang sama lolos. |
| **PR #3 — GhostInTheCodebase 3D** | Tambah lensa WebGL code-city + scrubber timeline. | 🟢 **GREEN** — guard regresi tetap hijau. |

### C.4 Penyelarasan Skor

Skor S4: **40 Kualitas · 40 Tes-yang-jalan-sendiri · 20 Inovasi · ∞ Engagement.**

- **Kualitas** — kode Next.js + three.js yang rapi, ter-*type*, modular (`src/`).
- **Tes-yang-jalan-sendiri** — suite TestSprite di-*generate* di portal terhadap
  URL live dan berjalan di setiap PR via GitHub App. Narasi demo = *catch → green*.
- **Inovasi** — lapisan autopsi 3D time-travel adalah *WOW*; semua peserta pakai
  TestSprite, ini lapisan di atasnya.
- **Engagement** — dashboard publik, replay bisa dibagikan, narasi demo jelas.

### C.5 Prinsip Tanpa Fabrication

Verdikt TestSprite **tidak** dibuat-buat di repo ini. Suite di-*author* di portal
terhadap URL *deploy* yang sesungguhnya; GitHub App yang menjalankan dan
melaporkan. Repo hanya menyediakan aplikasi live + dokumentasi cakupan. (Lihat
README.md untuk instruksi *deploy* dan pengaturan `SECURE_MODE`.)
