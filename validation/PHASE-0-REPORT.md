# PHASE 0 — OFFICIAL PREFLIGHT (gta6-01 "Make GTA 6")

> Laporan ini ditulis di sesi terekam (subagent builder, dimulai setelah recording).
> Bukan bagian dari entry game — dokumentasi preflight saja, di `validation/`.

## PHASE

Phase 0: Official Preflight — NO GAME CODING YET

## STATUS

**PASS**

Semua prerequisite WAJIB terverifikasi tersedia. Playwright MCP (recommended, bukan required) TIDAK tersedia sebagai MCP tool di lingkungan ini — bukan blocker; penggantinya adalah playwright-core (Node library) + Chromium, yang sudah terbukti bekerja (lihat CHROME TEST / PLAYWRIGHT TEST). Tidak ada prerequisite wajib yang hilang.

## FILES CREATED

- `validation/PHASE-0-REPORT.md` (file ini)
- `/tmp/gta6-phase0-browsertest.cjs` (skrip uji browser, di luar repo — bukan bagian entry)
- `/tmp/gta6-phase0-chrome-test.png` (screenshot uji file:// — hitam, lihat BUGS FOUND)
- `/tmp/gta6-phase0-pw-test.png` (screenshot uji Playwright — starter game ter-render)
- `/tmp/gta6-phase0-out/` (output uji `main.ts` — dossier.json + game/ + screenshots/ hasil copy, di luar repo)

## FILES MODIFIED

Tidak ada. Semua file repo hanya dibaca, tidak diubah. Uji `main.ts` menulis ke `/tmp/gta6-phase0-out/`, bukan ke repo.

## IMPLEMENTED

Phase 0 saja (preflight, tanpa kode game):

1. **Kontrak main.ts dipahami (dari starter + vendor/makefun-game.ts, bukan karangan):**
   - `main.ts` adalah program Node 22 (TypeScript erasable, stdlib saja, jalan apa adanya dengan `node main.ts` tanpa flag/build/install).
   - Tugasnya HANYA menyerahkan game: copy `game/` + `screenshots/` dari samping file ini ke output dir (`$MAKEFUN_OUTPUT_DIR`, atau `/output` di grader), lalu tulis `<output>/dossier.json` via `buildDossier(out, caps)` dari `./vendor/makefun-game.ts`.
   - Caps yang dipakai starter (dan yang dipakai scorer dari `gate.json`): `text_max_bytes: 163840`, `screenshots: { max: 4, max_bytes: 262144 }`, `game_max_files: 993`, `game_max_bytes: 50331648` (48 MiB), `game_path_max_bytes: 1000`.
   - Grader menjalankan `main.ts` di sandbox-nya sendiri, lalu menjalankan `buildDossier` yang sama (byte-for-byte) atas hasil serahan dan menuntut `dossier.json` sama persis dengan yang `buildDossier` tulis. `main.ts` TIDAK menjalankan game-nya sendiri.
   - Uji lokal: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — terverifikasi jalan (exit 0, dossier.json valid, lihat EVIDENCE).
   - **Wajib untuk build:** `main.ts` harus punya minimal 1 baris authored oleh agent di sesi terekam (gate `thinking_reproduces`). Starter `main.ts` adalah file kit (tidak dihitung) — jadi build agent WAJIB menulis/mengubah `main.ts` sendiri di sesi terekam, bukan copy mentah.

2. **Kontrak vendor/makefun-game.ts dipahami:**
   - Satu file library resmi Node 22 (stdlib saja). HARUS di-copy ke `vendor/makefun-game.ts` TANPA diubah (copy di tempat lain dihitung sebagai baris yang saya tulis).
   - Terverifikasi: hash SHA-256 repo `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` = hash di `kit.json`. **Identik, tidak diubah.**
   - `buildDossier(dir, caps)` menulis dossier `makefun/dossier/v1` (canonical JSON): blok `## Game` (jumlah/byte source, vendored, asset, total) + `## Sources` (index.html dulu, lalu source JS dalam urutan import, lalu source lain per path). Teks dibatasi `text_max_bytes`; file pertama yang tidak muat dipotong di baris lengkap terakhir.
   - Klasifikasi file di `game/`: **source** = ekstensi `.html/.js/.mjs/.css/.glsl/.vert/.frag/.wgsl/.json`, BUKAN di direktori bernama `vendor`, BUKAN `*.min.js/*.min.mjs/*.min.css` (file-file ini DITAMPILKAN teksnya di dossier — dibaca juri). **vendored** = di bawah direktori `vendor/` atau bernama `*.min.*` (hanya dihitung path+byte, tidak ditampilkan). **asset** = sisanya (gambar, suara, .wasm — hanya dihitung per ekstensi).
   - **Implikasi build:** Three.js (atau library lain) HARUS di-vendor sebagai `*.min.js` atau di bawah `game/vendor/` supaya tidak dihitung sebagai source (dan tidak merusak share authored). Game source sendiri harus ditulis agent di sesi terekam.
   - `buildDossier` melempar `DossierError` bila: tidak ada `game/`, ada symlink/special file, melebihi caps, tidak ada `game/index.html` (atau >1 MiB), `screenshots/` kosong/>4/>256 KiB per file/bukan PNG-JPEG.
   - Scorer mem-parse setiap module source dengan acorn — JS harus parse bersih.

3. **Kompetisi dipahami (dari bounty page + requirements API + RULES.txt + kit.json):**
   - Slug `gta6-01`, status **open**, hadiah $1.666 (escrow USDC Solana sejak 17 Nov 2026 10:19:38 UTC), 100 tempat dibayar (1st $500, 2nd $250, 3rd $150, 4th–10th $38, 11th–25th $10, 26th–50th $6, 51st–100th $4).
   - Deadline: **24 Nov 2026 15:00 UTC = 22:00 WIB**. Dibuka 17 Nov 2026 15:00 UTC.
   - Kuota: max 5/hari, 10 total per entrant; hard limit 20 entry per akun per kompetisi; reputasi akun bisa menurunkan cap (negara high-risk 3/hari). Entry terakhir sebelum deadline = final.
   - Deliverables: repo GitHub publik (atau source bundle), commit SHA 40 karakter, `recording_ids` (WAJIB — TIDAK ADA upload transcript), `title` (opsional), `entry_message` + `entry_signature` (WAJIB — escrow, ditandatangani wallet Solana yang ter-link ke akun; wallet penanda = payout wallet), `LICENSE` OSI (WAJIB), `main.ts` di root (WAJIB), `.makefun/owner.json` hanya bila owner GitHub repo ≠ login GitHub akun (tidak perlu di sini — owner = claymoreth = login akun).
   - Screenshots: 3 atau 4 PNG/JPEG di `screenshots/`, render asli dari kode game, pertama menurut nama = cover. Masing-masing ≤256 KiB.
   - `game/`: `index.html` wajib, semua file yang di-load harus di dalam `game/`, tanpa network request. Caps: ≤993 file+direktori, ≤48 MiB, path ≤1000 byte.
   - Submit: `node cli/makefun.mjs submit --competition gta6-01 --recording <id> --repo-url https://github.com/<owner>/<repo> --commit <sha> --title "<name>" --keypair <file>` (dari dalam kit). `--keypair` menandatangani entry message (make.fun entry v1). JANGAN submit tanpa perintah eksplisit owner.
   - Check lokal: `node cli/makefun.mjs check [--kit <dir>] [--repo <dir>] [--commit <sha>] [--worktree] [--transcripts <bundle>] [--json]` — menjalankan pre-submit checks situs secara lokal.
   - Transcript gate (12 checks, dari RULES.txt + requirements API): `transcripts_present`, `transcripts_recorded`, `thinking_wellformed`, `thinking_in_window` (semua timestamp antara buka kompetisi dan receipt, ±60 dtk), `thinking_committed`, `thinking_reproduces` (**min_authored 0.3 / 30%, max_unwritten 0.4 / 40%, entrypoint ≥1 authored line**), `thinking_turns` (≥5 assistant turns berteks), `thinking_priced` (usage rows dari muse.db via file `--muse-usage` saat seal), `thinking_revised` (**suatu file harus mengambil konten finalnya dari ≥2 assistant messages yang menulis/mengeditnya — file yang ditulis sekali penuh lalu tak pernah direvisi TIDAK cukup**), `thinking_fresh` (source bundle saja — N/A untuk entry GitHub), `transcripts_witnessed` (sesi harus dari sealed recording; file counted tidak boleh menyimpan konten pra-recording; recording harus MELIHAT agent menulis setiap file entry, TERMASUK screenshots), `transcripts_run_record` (run record `makefun-run.json` WAJIB untuk entry ≥17 Nov 2026 00:00 UTC: prompt asli owner, harness/provider/model/effort, system prompt, daftar MCP server, instruction files).
   - **Disiplin build yang diturunkan dari gate ini:** (a) tulis semua source game + main.ts + README + screenshots SENDIRI di sesi terekam, jangan copy dari luar repo; (b) REVISI file (jangan tulis sekali lalu tinggal); (c) vendor library sebagai `*.min.js`/`game/vendor/`; (d) sebelum stop recording, tulis usage rows ke `~/.makefun/muse-usage-gta6-01.jsonl` (SELECT dari log record); (e) screenshots dihasilkan oleh script Playwright yang saya tulis di sesi terekam.

4. **Prerequisites terverifikasi (lihat TESTS EXECUTED):**
   - Node.js: **v24.22.1** (bare `node`, dari `/usr/bin/node` + `/bin/node`) — memenuhi ≥22.18. **Catatan jujur:** Node v26.13.1 yang disebut di konteks parent TIDAK ada di `/usr/local/bin/` (direktori itu kosong di shell ini). Requirement tetap terpenuhi oleh v24.22.1; tidak ada yang perlu diinstall.
   - Browser: **Google Chrome for Testing 159.0.8154.6** (Playwright Chromium, `~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`) — binary jalan, membuka halaman lokal, mengambil screenshot (terverifikasi visual). TIDAK ADA Google Chrome sistem di PATH (`which google-chrome/chromium` kosong) — tapi Chromium Playwright adalah build desktop Chromium yang sesungguhnya dan memenuhi "a desktop browser such as Chrome" (check-nya: browser terinstall + membuka halaman lokal + screenshot game jalan — ketiganya terbukti).
   - Coding agent terekam: **Muse app** — tercantum di Recorded harnesses (RULES.txt + `record --help` + requirements API). Recording SUDAH AKTIF (ID di bawah). Sesi saya (subagent `23120cb4-4da7-4480-95ce-d414502552ec`) dimulai SETELAH recording jalan — valid. Sesi parent (`70f852b4...`) dimulai SEBELUM recording — tidak bisa dipakai build (sudah diperingatkan log record).
   - Playwright MCP: **required: false** (optional/recommended) di requirements API. TIDAK tersedia sebagai MCP tool di lingkungan saya (tidak ada `browser_navigate`/`browser_take_screenshot`). BUKAN blocker. Pengganti yang terbukti: playwright-core 1.65.1 (Node library) + Chromium — dipakai untuk play-test + screenshot. Saat submit nanti, run record menyatakan `--mcp none`.
   - Kit: tersedia di `~/workspace/makefun/gta6-01-kit/gta6-01-kit/` (RULES.txt 107.150 byte, kit.json, competition.yaml, cli/makefun.mjs v0.1.0, starter/, harness/). `kit.json`: format `agent-fun/kit/v1`, protocol `agent-fun/program/v1`, harness `harness@f894ae8b... node v26.13.1`, pricing_rev `6a262a9d...`.
   - Repo: `claymoreth/gta6-01-entry`, publik, owner `claymoreth`, dibuat **2026-11-19T12:38:25Z** (setelah buka 2026-11-17T15:00:00Z ✅). Remote @ `801b13d9` (setelah hapus README). Starter sudah di-copy (LICENSE, game/, main.ts, screenshots/ 3 JPG, serve.ts, shots.json, vendor/makefun-game.ts). `README.md` sengaja DIHAPUS dari working tree (peringatan record: file pre-existing menggagalkan `transcripts_witnessed`) — build agent WAJIB tulis README fresh (dengan 3 badge) di sesi terekam.
   - Recording: **AKTIF**, ID `01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7`, PID `5843`, log `~/.makefun/record-gta6-01.log`, mulai 19:39 WIB, mengirim fingerprint ke make.fun. JANGAN start recording kedua. JANGAN stop sebelum build selesai + usage rows ditulis.

## TESTS EXECUTED

1. `node --version` → `v24.22.1`; `npm --version` → `10.9.4`. `which -a node` → `/usr/bin/node`, `/bin/node`. `/usr/local/bin/node` → **tidak ada** (No such file or directory); `ls /usr/local/bin/` → kosong.
2. `which google-chrome google-chrome-stable chromium chromium-browser chrome` → kosong (tidak ada Chrome sistem di PATH).
3. `~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome --version` → `Google Chrome for Testing 159.0.8154.6`.
4. Headless screenshot file:// starter game → exit 0, PNG 1280×720 (4.258 byte) — **hitam** (game tidak sempat render lewat file:// + virtual-time-budget; lihat BUGS FOUND).
5. Playwright test (skrip fresh `/tmp/gta6-phase0-browsertest.cjs`, playwright-core 1.65.1): serve starter game via HTTP `127.0.0.1:<port>`, buka di Chromium headless 1280×720, tunggu 3 dtk, screenshot → **starter game ter-render sempurna** ("Block Dodger" title screen, instruksi, paddle biru, blok merah jatuh). Canvas `#game` 1280×720 terdeteksi. Console: 1 error 404 (favicon.ico — harmless, tidak ada favicon). Page errors: **0**. Failed requests: **0**. Exit 0.
6. `sha256sum vendor/makefun-game.ts` → `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` = hash di `kit.json`. **Identik.**
7. `MAKEFUN_OUTPUT_DIR=/tmp/gta6-phase0-out node main.ts` (dari repo) → exit 0 (hanya warning Node `MODULE_TYPELESS_PACKAGE_JSON`, harmless). Output: `dossier.json` + `game/` (8 file) + `screenshots/` (3 JPG). `dossier.json`: schema `makefun/dossier/v1`, keys `[cover, images, schema, text]`, teks 22.857 byte, images `[1-start.jpg, 2-play.jpg, 3-end.jpg]`, blok `## Game` (Source files: 8, Vendored: 0, Assets: none, Totals: 9).
8. `node cli/makefun.mjs --help` → makefun 0.1.0 (login/register/merge/...). `node cli/makefun.mjs record --help` → sintaks record + daftar harness terekam (termasuk Muse app, `--muse-app-dir` = `~/agents`). `node cli/makefun.mjs submit --help` → sintaks submit (strict-transcripts: `--recording`, bukan `--bundle`/`--transcript`; `--keypair` menandatangani entry). `node cli/makefun.mjs check --help` → pre-submit checks lokal.
9. `ps -p 5843` → recording jalan (elapsed 05:48 saat cek terakhir). `cat ~/.makefun/record-gta6-01.pid` → `5843`. Log head: `recording 01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7 of /home/hatch/workspace/makefun/gta6-01-entry for gta6-01`.
10. `curl https://api.github.com/repos/claymoreth/gta6-01-entry` → `full_name: claymoreth/gta6-01-entry`, `created_at: 2026-11-19T12:38:25Z`, `private: false`, `owner: claymoreth`.
11. `git -C <repo> status --short` → bersih. `git log --oneline -3` → `4d196d5 remove README`, `151f2d4 README with make.fun badges`, `f166b71 init starter`.
12. Baca: bounty page, skill.md (v1.5.221, 3481 baris — bagian relevan), requirements API (771 baris — deliverables, checks, prerequisites), RULES.txt (Getting started, Transcripts, Transcript gate, Disqualification, Payout), kit.json, starter/main.ts, starter/vendor/makefun-game.ts, starter/game/index.html, starter/shots.json.

## CHROME TEST

**PASS** — Chromium Playwright (`Google Chrome for Testing 159.0.8154.6`) membuka halaman lokal dan mengambil screenshot yang terverifikasi visual (starter game "Block Dodger" ter-render lengkap: title, instruksi, paddle, blok). Tidak ada Google Chrome sistem di PATH, tapi Chromium Playwright memenuhi syarat "desktop browser such as Chrome" (check resminya adalah browser membuka halaman lokal + screenshot game jalan — keduanya terbukti). Satu catatan: screenshot via `file://` + `--virtual-time-budget` menghasilkan layar hitam — metode yang benar adalah serve via HTTP (seperti `serve.ts` / skrip Playwright saya).

## PLAYWRIGHT TEST

**PASS** — playwright-core **1.65.1** (`~/workspace/tools/pw/node_modules/playwright-core`) berhasil: launch Chromium, serve game via HTTP, `page.goto`, deteksi canvas, tunggu, screenshot, kumpulkan console/pageerror/requestfailed. Hasil: 0 page error, 0 failed request, screenshot 29.680 byte terverifikasi visual. **Playwright MCP (server MCP) TIDAK tersedia** — tidak ada tool `browser_navigate`/`browser_take_screenshot` di lingkungan saya. Status resminya `required: false` (recommended), jadi bukan blocker; playwright-core adalah pengganti yang sah dan terbukti. Saat submit: `--mcp none`.

## OFFLINE TEST

**BELUM BISA DINILAI UNTUK GAME FINAL** (belum ada game). Untuk starter: game di-load dari server HTTP lokal, 0 external request (satu-satunya 404 adalah favicon.ico default browser). Starter `game/` tidak memuat apapun dari luar (ES module lokal `./src/main.js` saja). Uji offline final (tanpa konektivitas, semua asset lokal di `game/`) dilakukan di Phase 7.

## PERFORMANCE

**BELUM DIUKUR** (belum ada game). Uji browser Phase 0 selesai ~5 detik. Target Phase 1+: 60 FPS stabil di hardware desktop biasa; pengukuran nyata dilaporkan per phase, tidak dikarang.

## BUGS FOUND

1. **Node v26.13.1 tidak ada di `/usr/local/bin/`** (direktori kosong; bare `node` = v24.22.1). Bukan blocker — v24.22.1 memenuhi ≥22.18 — tapi dicatat jujur karena konteks parent menyebut v26.13.1. Tidak ada yang perlu diinstall.
2. **Screenshot headless via `file://` hitam.** Penyebab: game tidak sempat render dengan `--virtual-time-budget` lewat file://. Bukan bug game — metode uji yang salah. Metode benar: serve via HTTP + Playwright (terbukti di PLAYWRIGHT TEST).
3. **Peringatan record soal `README.md` pre-existing** (di log record). Sudah diselesaikan parent sebelum sesi saya (README dihapus dari working tree; git log `4d196d5 remove README`). Build agent wajib tulis README fresh di sesi terekam.
4. **Playwright MCP tidak tersedia sebagai MCP tool.** Bukan bug — memang tidak terinstall di lingkungan ini; status resmi `required: false`. Pengganti playwright-core terbukti bekerja.

## BUGS FIXED

Tidak ada (Phase 0 tidak mengubah kode). Semua temuan di atas adalah observasi/penjelasan, bukan perbaikan kode.

## REMAINING ISSUES

1. **Playwright MCP tidak ada** — pakai playwright-core (skrip Node) untuk semua play-test + screenshot. Nyatakan `--mcp none` saat submit.
2. **Node v24.22.1, bukan v26.13.1** — memenuhi syarat (≥22.18). Tidak perlu install ulang.
3. **Run record (`makefun-run.json`)** — wajib saat submit: prompt asli Mana (master prompt), harness/provider/model/effort, system prompt, daftar MCP (none), instruction files (AGENTS.md di home akan ter-collect oleh submit — jangan sembunyikan; `--instructions none` DITOLAK bila submit menemukan instruction file). Urus saat submit, bukan sekarang.
4. **Usage rows** — sebelum stop recording, tulis rows dari muse.db ke `~/.makefun/muse-usage-gta6-01.jsonl` (SELECT persis dari log record; sertakan agent_id saya + semua subagent bila ada). Tanpa ini, seal tertahan (`thinking_priced`).
5. **Disiplin gate untuk Phase 1+:** (a) tulis SEMUA source + main.ts + README + screenshots sendiri di sesi terekam; (b) revisi file (≥2 assistant messages menulis/mengedit file yang sama) — `thinking_revised`; (c) vendor Three.js sebagai `*.min.js`/`game/vendor/`; (d) JANGAN baca/salin `solmar-city-entry/` atau file Crimson Harbor apapun; (e) JANGAN hapus/ubah pesan terekam; (f) JANGAN stop/restart recording.
6. **Tiga.js belum diputuskan/di-vendor.** Keputusan library (Three.js via `*.min.js` lokal, tanpa CDN) dibuat di Phase 1 — belum ada file library di repo saat ini.
7. **Screenshot starter masih pakai JPG kit** (`screenshots/1-start.jpg` dst.) — harus DIGANTI dengan 3–4 screenshot asli game baru, yang dihasilkan oleh script Playwright saya di sesi terekam (recording harus melihat saya menulis file screenshot).

## EVIDENCE

- Bounty: `https://make.fun/bounty/gta6-01` — $1.666, 100 tempat, tutup 24 Nov 2026 15:00 UTC (22:00 WIB), status open.
- Requirements API: `https://make.fun/api/competitions/gta6-01/requirements` — prerequisites: node (required), chrome (required), coding-agent (required), Playwright MCP (**required: false**); quota max_per_day 5, max_total 10, hard limit 20; checks termasuk `thinking_reproduces` (min 30% authored).
- skill.md v1.5.221; kit `agent-fun/kit/v1`, protocol `agent-fun/program/v1`, pricing_rev `6a262a9d...`.
- Node: `v24.22.1` (bare), npm `10.9.4`. `/usr/local/bin/` kosong.
- Chromium: `Google Chrome for Testing 159.0.8154.6`, `~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`.
- playwright-core: `1.65.1`.
- Recording: ID `01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7`, PID `5843`, log `~/.makefun/record-gta6-01.log`, mulai 19:39 WIB, masih jalan (elapsed 05:48 saat cek).
- Sesi saya: subagent `23120cb4-4da7-4480-95ce-d414502552ec`, dimulai setelah recording — valid. File sesi: `~/agents/agent-23120cb4-4da7-4480-95ce-d414502552ec/sessions/23120cb4-4da7-4480-95ce-d414502552ec.jsonl`.
- Repo: `claymoreth/gta6-01-entry`, publik, owner `claymoreth`, dibuat `2026-11-19T12:38:25Z`, remote @ `801b13d9`, git status bersih, tanpa README.md di working tree.
- vendor hash: `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` = kit.json ✅.
- main.ts test: exit 0, dossier `makefun/dossier/v1`, teks 22.857 byte, 3 gambar.
- Playwright test: canvas 1280×720 terdeteksi, 0 page error, 0 failed request, screenshot `/tmp/gta6-phase0-pw-test.png` (29.680 byte) menunjukkan title screen "Block Dodger" lengkap.

## NEXT STEP

**Phase 1: 3D Vertical Slice** — HANYA setelah owner (Mana) mengucapkan `LANJUT PHASE 1`. Saya STOP di sini. Recording tetap jalan di background (PID 5843 — jangan disentuh). Tidak ada kode game yang ditulis di Phase 0.
