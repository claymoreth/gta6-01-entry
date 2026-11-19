# PHASE 1 — 3D VERTICAL SLICE (gta6-01 "Make GTA 6" / CITY OF EMBERS)

> Laporan ditulis di sesi terekam (subagent builder, dimulai setelah recording).
> Recording ID 01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7 tetap jalan (PID 5843) —
> JANGAN stop sebelum build selesai + usage rows ditulis (lihat REMAINING ISSUES).

## PHASE

Phase 1: 3D Vertical Slice — "CITY OF EMBERS", satu blok kota malam yang playable

## STATUS

**PASS** — 18/18 acceptance tests lolos, dua screenshot gameplay asli
terverifikasi visual (karakter 3D, kamera third-person, HUD + minimap).

## FILES CREATED

- `game/vendor/three.module.min.js` (731 KB, Three.js r187 resmi, bundle+minify lokal via esbuild — diklasifikasi *vendored*, dikecualikan dari hitungan gate)
- `game/src/camera.js` (kamera third-person: orbit mouse, pitch clamp, collision)
- `game/src/collision.js` (AABB helpers: circle resolve + segment test kamera)
- `game/src/hud.js` (HUD DOM + minimap canvas 2D + overlay + toast)
- `game/src/player.js` (karakter "Raka": geometri primitif, animasi jalan/lari, movement)
- `game/style.css` (styling HUD + overlay)
- `README.md` (fresh, ditulis di sesi terekam ini, 3 badge make.fun repo ini)
- `screenshots/01-city-exploration.jpg` (110,5 KiB) + `screenshots/02-night-street.jpg` (117,7 KiB) — gameplay asli dari Playwright
- `validation/test-phase1.cjs` (skrip acceptance test, 2 sesi)
- `validation/probe-fps.cjs` (skrip probe FPS, diagnosis)
- `validation/PHASE-1-REPORT.md` (file ini)

## FILES MODIFIED

- `game/index.html` — ditulis ulang (importmap three, HUD DOM, start/pause overlay)
- `game/src/main.js` — ditulis ulang (bootstrap, renderer, loop, state machine, `?shot=` + `?lowfx=`, debug hooks `window.__embers`)
- `game/src/world.js` — ditulis ulang (blok kota: jalan, trotoar, crosswalk, 16 gedung, palem, lampu jalan, langit/fog)
- `game/src/input.js` — ditulis ulang (WASD/panah, Shift, mouse drag/pointer-lock, Esc/P)
- `main.ts` — ditulis ulang dengan baris authored sendiri (header + console.log; perilaku plumbing sama)
- `shots.json` — diperbarui ke 2 screenshot baru
- DIHAPUS (file starter 2D "Block Dodger", diganti game 3D): `game/src/config.js`, `random.js`, `render.js`, `shots.js`, `screenshots/1-start.jpg`, `2-play.jpg`, `3-end.jpg`

## FILES TIDAK DIUBAH

- `vendor/makefun-game.ts` — hash SHA-256 tetap `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` = kit.json ✅
- `LICENSE`, `serve.ts` (kit, tidak disentuh)

## IMPLEMENTED

1. **Three.js lokal, tanpa CDN.** Build resmi `three.module.js` dari `~/workspace/tools/vendor/` di-bundle+minify dengan esbuild menjadi `game/vendor/three.module.min.js` (731 KB, single file, import di Node terverifikasi: REVISION 187). Importmap di `index.html` map `"three"` ke file itu. Dossier mengklasifikasikannya sebagai *vendored* (bukan source) — terverifikasi di `main.ts` run.
2. **Lingkungan 3D (satu blok, batas ±60 m):** aspal, 2 jalan bersilangan (lebar 10 m) + trotoar naik 0,18 m, marka lajur kuning, crosswalk 4 sisi, 16 gedung (tinggi 12–46 m, 4 kuadran) dengan tekstur fasad prosedural (CanvasTexture: jendela grid, sebagian menyala kuning hangat/putih, dipakai sebagai map + emissiveMap), atap + AC + strip neon pink di menara ≥30 m, ~40 pohon palem (batang miring + 7–9 pelepah + kelapa), 6 lampu jalan berlampu nyata (PointLight hangat) + ~16 lampu emissive, langit malam + 500 bintang + bulan, fog ungu-biru, cahaya bulan directional (bayangan 2048) + hemisphere + ambient.
3. **Karakter 3D "Raka" (orisinal, primitif):** kepala + rambut, torso jaket maroon, lengan + tangan, kaki jeans + sepatu; pivot bahu/pinggul; animasi ayun jalan/lari (sin, amplitudo + kecepatan naik saat sprint), lean ke depan + bob saat lari; hero light hangat di belakang-bahu supaya karakter terbaca dari kamera.
4. **Kamera third-person:** di belakang karakter, smooth follow (lerp target), orbit mouse (drag atau pointer lock), pitch clamp [-0,12, 0,55], FOV 62, collision kamera (segment test vs AABB gedung, jarak memendek saat terhalang).
5. **Movement:** WASD + arrow keys (relatif kamera), sprint Shift (7,6 vs 4,2 m/s), karakter berputar halus ke arah gerak, ground y=0, collision gedung (circle-vs-AABB + slide di dinding), batas dunia ±59 m.
6. **Game state:** start screen (judul, tombol Start Game, kontrol), pause (ESC/P), resume, restart; `?shot=play` auto-start untuk screenshot harness.
7. **HUD:** kiri atas distrik + nama jalan + misi; kiri bawah minimap fungsional (jalan, gedung, panah pemain berputar sesuai facing, N); kanan bawah health/armour bar + angka, uang, wanted; kanan atas posisi; hint kontrol; toast pergantian distrik.
8. **main.ts authored:** header + log ditulis sendiri di sesi terekam; plumbing (copy game/+screenshots/, buildDossier caps sama) dipertahankan.
9. **README.md fresh:** judul, 3 badge repo ini, cara main, ringkasan Phase 1, lisensi MIT.

## TESTS EXECUTED

Skrip: `node validation/test-phase1.cjs` (2 sesi, serve via `node serve.ts`, TIDAK PERNAH file://).

Sesi A — LOGIC (640×360 + `?lowfx=1`, agar SwiftShader cukup cepat):

- HTTP server serves game/ — PASS
- Start screen visible on load — PASS
- WebGL context alive — PASS
- Start Game button starts play — PASS (`state=playing`)
- WASD movement — PASS (berjalan 3,35 m sebelum polling berhenti)
- Sprint faster than walk — PASS (jalan 5,46 m vs sprint 8,77 m per 5 s; rasio 1,61–1,84 ≈ 7,6/4,2)
- Mouse drag rotates camera — PASS (yaw 0,00 → -0,73)
- Building collision — PASS (jalan NE 45 s: berhenti di (26,6, -12,6) — meluncur di dinding selatan menara (18,-20), tidak menembus; x > 8 membuktikan slide di sepanjang dinding)
- Player stays on ground (y=0) — PASS
- ESC pauses — PASS; Resume returns to play — PASS
- No page errors / console errors / failed requests — PASS (0/0/0)

Sesi B — VISUALS (1280×720, full quality, `?shot=play`):

- Auto-start via `?shot=play` — PASS (`state=playing`)
- No page errors — PASS
- Screenshot 01 (110,5 KiB) + 02 (117,7 KiB) ≤ 256 KiB — PASS

`main.ts` run: `MAKEFUN_OUTPUT_DIR=/tmp/gta6-phase1-out node main.ts` → exit 0,
dossier `makefun/dossier/v1`: Source files 9 (43.698 byte), Vendored 1
(748.863 byte = three.module.min.js), Assets none, Totals 12 file (792.561 byte),
teks 44.412 byte (< 163.840 cap), images 2 JPG, cover 01-city-exploration.jpg.

Total: **18/18 PASS** (3x run penuh, hasil stabil).

## CHROME TEST

**PASS** — Google Chrome for Testing 159.0.8154.6 (Playwright Chromium) membuka
game via HTTP, merender scene 3D malam lengkap (menara + jendela menyala, palem,
lampu jalan, crosswalk, karakter, HUD, minimap). Dua screenshot gameplay
diverifikasi visual oleh saya sendiri (lihat EVIDENCE). `file://` tidak dipakai.

## PLAYWRIGHT TEST

**PASS** — playwright-core 1.65.1: launch Chromium, serve HTTP, klik tombol
asli, simulasi keyboard (WASD/Shift/ESC), drag mouse, baca `window.__embers`
(pos, speed, yaw, state, frames, draw calls), kumpulkan console/pageerror/
requestfailed, screenshot JPEG. 18/18.

## OFFLINE TEST

**PASS** — 0 failed requests, 0 external request dalam kedua sesi. Semua yang
di-load game berasal dari `game/` lokal (three.module.min.js, src/*.js,
style.css). Tidak ada CDN, font remote, gambar remote, audio remote, API.

## PERFORMANCE

**Angka nyata (jangan dikarang):**

- Wall-clock FPS @1280×720 full quality, headless SwiftShader: **1,0–1,2 FPS**
  (diukur dari `__embers.frames` selama 5 detik wall-clock; HUD meter sudah
  diperbaiki jadi jujur — sebelumnya memakai clamped dt sehingga membaca ~20).
- Wall-clock FPS @640×360 `?lowfx=1`: **~5 FPS** (dari jarak tempuh vs waktu).
- Scene: **103 draw calls, 1.842 segitiga** (diukur `renderer.info.render`) —
  beban game sangat ringan.
- Game logic frame-rate independent (dt-based): kecepatan jalan terukur tepat
  4,2 m/s dalam game-time di semua viewport (probe: 0,68 m @1 FPS vs 2,72 m
  @3 FPS dalam 5 detik wall = konsisten dengan 4,2 m/s × game-time).

**Penilaian jujur:** angka 1 FPS mengukur rasterizer perangkat lunak
SwiftShader di VM 1,5 vCPU bersama ini, BUKAN game-nya — scene 1.842 segitiga /
103 draw call adalah beban sepele untuk GPU desktop nyata mana pun. 60 FPS di
hardware nyata TIDAK bisa saya verifikasi di lingkungan ini dan TIDAK saya
klaim. Yang terverifikasi: game berjalan benar pada frame rate berapa pun
(dt clamp 0,05 mencegah loncatan fisika; pada FPS rendah game melambat
seperti slow-motion, bukan rusak). Pengukuran 60 FPS di GPU nyata menjadi
tugas Phase 7 (validasi final).

## BUGS FOUND

1. **Screenshot sesi B pertama menunjukkan start screen, bukan gameplay.**
   Penyebab: `?shot=play` dicek di awal modul, lalu `hud.showStart()` di akhir
   menimpanya. Bukan bug game — urutan inisialisasi.
2. **Karakter dari belakang terlalu gelap** (jaket maroon tak terbaca di shot 01).
3. **FPS meter menipu:** memakai clamped dt sehingga membaca ~20 padahal wall FPS ~1.
4. **404 favicon** (console error) di run pertama.
5. **Dead code:** variabel `k` tak terpakai + konstanta `ACCEL` tak terpakai di `player.js`.
6. **Gerakan sangat lambat di run pertama** (0,18 m/2 dtk) — ternyata bukan bug
   logika: SwiftShader hanya ~1 FPS @1280×720 dan dt clamp membuat game-time
   berjalan 1/20 wall-time. Diagnosis via `probe-fps.cjs` (gerak ∝ jumlah frame).

## BUGS FIXED

1. `?shot=play` dipindah ke akhir `main.js` (setelah `showStart()`) — screenshot
   sesi B berikutnya menunjukkan gameplay asli (terverifikasi visual).
2. Hero light hangat ditambahkan di belakang-bahu karakter (posisi lokal
   diperbaiki dari +z depan ke -z belakang; intensitas 12) — jaket maroon kini
   terbaca jelas dari kamera belakang.
3. FPS meter diubah ke wall-clock dt (jujur: 1,0–1,3 di headless).
4. `<link rel="icon" href="data:,">` ditambahkan — 0 console error.
5. Dead code dihapus (`k`, `ACCEL`).
6. Test dipecah 2 sesi + `?lowfx=1` (matikan AA/shadow) untuk sesi logika;
   sesi visual tetap full quality. Semua 18 test lolos 3x berturut-turut.

## REMAINING ISSUES

1. **60 FPS di GPU nyata belum terverifikasi** (lihat PERFORMANCE) — tugas Phase 7.
2. Satu blok saja (by design Phase 1) — ekspansi 3 distrik di Phase 2.
3. Belum ada kendaraan, polisi/wanted, combat, misi, audio (Phase 3–6).
4. Minimap masih dasar (jalan/gedung/panah pemain; belum ada waypoint/GPS — Phase 2).
5. Animasi karakter sederhana (ayun lengan/kaki; belum ada transisi idle/lompat).
6. `thinking_revised`: semua file penting sudah ditulis lalu direvisi di ≥2
   pesan (main.js 4x edit, player.js 3x, world.js 2x, hud.js 2x, camera.js 2x,
   index.html 2x, main.ts + README ditulis fresh di sesi ini).
7. **Sebelum stop recording (nanti, bukan sekarang):** tulis usage rows ke
   `~/.makefun/muse-usage-gta6-01.jsonl` (SELECT dari log record; sertakan
   agent_id sesi ini + subagent lain bila ada). Recording JANGAN di-stop dulu.
8. Repo belum di-commit/push — working tree berisi semua hasil Phase 1
   (parent yang memutuskan commit/push).

## EVIDENCE

- Screenshot 1 — `screenshots/01-city-exploration.jpg` (1280×720, 110,5 KiB):
  third-person di belakang Raka (jaket maroon terlihat), crosswalk, menara
  kiri-kanan dengan jendela menyala, palem, lampu jalan, HUD lengkap
  (distrik, misi, minimap, health/armour, uang, wanted, posisi).
- Screenshot 2 — `screenshots/02-night-street.jpg` (1280×720, 117,7 KiB):
  sudut orbit ~70°, Raka dari samping (jaket maroon, kepala, jeans),
  crosswalk + menara + palem.
- Test run terakhir: 18/18 PASS (output lengkap di atas).
- Dossier: 9 source, 1 vendored, 12 file, 792.561 byte, teks 44.412 byte.
- `vendor/makefun-game.ts` hash tidak berubah.
- Recording: PID 5843, elapsed 26:59 saat laporan ditulis, masih jalan.

## NEXT STEP

**Phase 2: Open-World City, HUD and GPS** — HANYA setelah owner (Mana)
mengucapkan `LANJUT PHASE 2`. Saya STOP di sini. Recording tetap jalan.
Tidak ada kode Phase 2 yang ditulis. JANGAN submit apa pun.
