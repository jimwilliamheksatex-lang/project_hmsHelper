# Implementation Plan: Gantt Chart Enhancement — PPC Warping MES Workstation

## Overview

Implementasi enhancement besar pada sistem PPC Warping MES Workstation berdasarkan requirements.md dan design.md. Stack: Vanilla HTML/CSS/JS (ES6 IIFE modules) tanpa framework. Seluruh file di direktori datar.

Urutan implementasi mengikuti urutan yang disarankan di design.md: setup file structure → DataStore → Renderer statis → Gantt layout → Scheduler → drag & drop → fitur interaktif → OperatorView → HPH → IoT → integrasi akhir.

## Tasks

- [x] 1. Setup Struktur File & Arsitektur Dasar
  - [x] 1.1 Rename `index.html` menjadi `warping_ppc_planner.html`; pastikan semua referensi internal (link, script src) diperbarui
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 1.2 Pindahkan seluruh CSS dari `warping_ppc_planner.html` ke `style.css` dengan struktur: `:root` custom properties, reset/base, shared components, `.planner-*`, `.operator-*`, utility classes
    - _Requirements: 1.1, 1.5, 12.1_
  - [x] 1.3 Pindahkan seluruh JS dari `warping_ppc_planner.html` ke `app.js` dengan struktur IIFE: `DataStore`, `Scheduler`, `Renderer`, `OperatorView`, `IoTHandler` — semua diekspos via namespace global `App`
    - _Requirements: 1.2, 1.3_
  - [x] 1.4 Update `warping_ppc_planner.html` agar memuat `style.css` via `<link>` dan `app.js` via `<script>` di akhir `<body>`; tambahkan `console.error` handling jika load file gagal
    - _Requirements: 1.4, 1.6_
  - [x] 1.5 Pindahkan seluruh CSS dan JS dari `operator_input.html` ke `style.css` dan `app.js` dengan namespace `.operator-*`; update `operator_input.html` agar memuat file shared yang sama
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_


- [x] 2. Implementasi DataStore — Layer Data
  - [x] 2.1 Implementasi `DataStore.load(url)` yang memuat `dummy_data.json` via `fetch()`, dengan error handling: `console.error` + `Renderer.showNotification('error')` + re-throw jika gagal
    - _Requirements: 1.6_
  - [x] 2.2 Implementasi semua getter DataStore: `getMachines`, `getMachineById`, `getMOs`, `getMOById`, `getGanttBlocks`, `getGanttBlockById`, `getConfig`, `getUsers`, `getShifts`, `getBeamDatabase`, `getHPHRecords`, `getYarnTypes` — semua return deep copy
    - _Requirements: 1.3_
  - [x] 2.3 Implementasi semua mutasi DataStore: `updateGanttBlock`, `addGanttBlock`, `removeGanttBlock`, `updateMOStatus`, `updateMachineIoT` — beroperasi pada state in-memory
    - _Requirements: 1.3_
  - [ ]* 2.4 Tulis unit test `tests/unit/datastore.test.js`: load sukses, load gagal (network error), getter mengembalikan deep copy, update sinkron state
    - _Requirements: 1.6_

- [x] 3. Implementasi Renderer — Komponen Statis
  - [x] 3.1 Implementasi `Renderer.init(domRefs)` yang men-cache referensi elemen DOM utama (`ganttEl`, `timelineHeaderEl`, `nowLineEl`, `machineLabelColEl`)
    - _Requirements: 1.3_
  - [x] 3.2 Implementasi `Renderer.renderMOTable(mos)` — merender tabel backlog MO di Table_Section dengan kolom: No MO, Knitting MC, Benang, Lot, Target Beam, GB, Status Stok, Status MO; baris `stock_status = 'not_ready'` ditampilkan dengan ikon ⚠️
    - _Requirements: 8.1_
  - [x] 3.3 Implementasi `Renderer.renderMachineLabels(machines)` — baris 1: nama mesin (bold), baris 2: jenis benang & lot (font-sm, warna oranye), baris 3: nomor MO aktif (font-sm, warna biru muda); mesin diurutkan A–Z; indikator IoT di sisi kiri (hijau/merah/abu-abu)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [x] 3.4 Implementasi `Renderer.updateMachineLabel(machineId, iotStatus, activeMO)` — update satu label mesin tanpa re-render seluruh kolom dalam ≤5 detik; jika gagal lakukan reload halaman sebagai fallback
    - _Requirements: 9.7_
  - [x] 3.5 Implementasi `Renderer.showNotification(msg, type)` dengan type `info`, `warn`, `error` — toast di pojok kanan atas, auto-dismiss 4 detik
    - _Requirements: 4.7, 4.8, 6.8_


- [ ] 4. Implementasi Renderer — Gantt Chart & Timeline Header
  - [ ] 4.1 Implementasi pure functions kalkulasi piksel: `timeToPixel(timestampMs, originMs, zoomPx)`, `pixelToTime(px, originMs, zoomPx)`, `durationToWidth(durationMs, zoomPx)`
    - _Requirements: 2.5, 2.6, 3.3_
  - [ ] 4.2 Implementasi `Renderer.renderTimelineHeader(startMs, endMs, zoomPx)` — baris hari/tanggal (hari ini di-highlight berbeda), baris jam (format `HH:00`); lebar kolom jam = `zoomPx`; sticky clock kiri atas format `HH:MM:SS`
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.8_
  - [ ] 4.3 Implementasi `Renderer.renderGantt(blocks, machines, zoomPx, startMs)` — area Gantt dengan `overflow-x: auto`, baris per mesin `position: relative`, blok MO `position: absolute` dari kalkulasi piksel
    - _Requirements: 2.5, 2.6_
  - [ ] 4.4 Implementasi `Renderer.renderBlock(block, zoomPx, startMs)` — class visual sesuai `gantt_status`; tambahkan class `--not-ready` dengan ikon ⚠️ jika `stock_status = 'not_ready'`
    - _Requirements: 4.4, 8.5, 8.7_
  - [ ] 4.5 Implementasi `Renderer.renderNowLine(nowMs, zoomPx, startMs)` dan `Renderer.updateNowLine(nowMs, zoomPx, startMs)` — garis merah vertikal dengan label `HH:MM` di bagian atas; merentang seluruh area mesin
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 4.6 Implementasi `Renderer.updateStickyClockDisplay(date)` — update sticky clock `HH:MM:SS` setiap detik via `setInterval(1000)`
    - _Requirements: 10.5, 10.8_

- [ ] 5. Implementasi Scheduler — State Management Jadwal
  - [x] 5.1 Implementasi `Scheduler.init(blocks, config)` — inisialisasi `_blocks[]` dari DataStore dan `_zoomLevel` dari config (default 80px/jam)
    - _Requirements: 1.3_
  - [x] 5.2 Implementasi `Scheduler.checkOverlap(machineId, start, end, excludeBlockId)` — return `{ hasOverlap, conflictingBlock }`
    - _Requirements: 6.1_
  - [ ] 5.3 Implementasi `Scheduler.scheduleBlock(moId, machineId, startTime, setupMin)` — validasi overlap, buat GanttBlock baru, update DataStore, return `{ success, blockId, error }`
    - _Requirements: 5.4, 6.1_
  - [ ] 5.4 Implementasi `Scheduler.unscheduleBlock(blockId)` secara atomik: (1) tandai pending_remove, (2) update MO status ke `ready` di DataStore, (3) hapus blok jika sukses, rollback jika gagal — return `{ success, error }`
    - _Requirements: 6.2, 6.3, 6.8_
  - [ ] 5.5 Implementasi `Scheduler.fixPlan()` — ubah semua blok `scheduled` → `fixed` + `locked = true`; collect MO gagal; return `{ success, fixedCount, failedMOs }`
    - _Requirements: 4.3, 4.5, 4.8_
  - [ ] 5.6 Implementasi `Scheduler.evaluateLocks(nowMs)` — lock jika `planned_end <= nowMs` dan `gantt_status !== 'fixed'`; unlock jika `planned_end > nowMs` dan status bukan `fixed`
    - _Requirements: 3.5, 3.5b_
  - [ ] 5.7 Implementasi `Scheduler.unlockByBreakdown(machineId)` — lepaskan lock semua blok pada mesin saat IoT status `rusak`
    - _Requirements: 3.6, 14.3_
  - [ ] 5.8 Implementasi helper: `Scheduler.setZoomLevel(px)`, `getZoomLevel()`, `hasScheduledBlocks()`, `isBlockLocked(blockId)`, `getBlocksForMachine(machineId)`, `handleIoTEvent(machineId, status)`
    - _Requirements: 2.1, 2.7, 4.2_
  - [ ]* 5.9 Tulis unit test `tests/unit/scheduler.test.js`: scheduleBlock valid, scheduleBlock overlap ditolak, unscheduleBlock blok locked gagal, fixPlan tidak ada scheduled, fixPlan partial failure
    - _Requirements: 4.7, 4.8, 5.4, 6.3_


- [ ] 6. Setup Test Infrastructure
  - [ ] 6.1 Buat `package.json` dengan scripts `test` dan `test:pbt`, devDependencies `jest ^29.x` dan `fast-check ^3.x`; jalankan `npm install`
    - Buat struktur direktori `tests/unit/` dan `tests/pbt/`
    - _Requirements: 1.3_

- [ ] 7. Checkpoint — Pastikan semua test melewati sejauh ini
  - Jalankan `npm test`, pastikan semua unit test DataStore dan Scheduler hijau; tanyakan kepada user jika ada pertanyaan.

- [ ] 8. Drag & Drop MO dari Tabel ke Gantt
  - [ ] 8.1 Implementasi `dragstart` pada baris tabel MO: simpan `moId` di `dataTransfer`, aktifkan drop zone visual di Table_Section (border/background berbeda)
    - _Requirements: 6.5_
  - [ ] 8.2 Implementasi `dragover` di area baris mesin Gantt: kalkulasi waktu dari posisi piksel, snap ke 15 menit terdekat, tampilkan Snap_Ghost transparan (dashed border)
    - _Requirements: 6.1, 6.2_
  - [ ] 8.3 Implementasi estimasi durasi MO: `estimateMODurationMs(mo) = (target_beam × order_per_beam_m / speed_target_rpm) × 60000`
    - _Requirements: 5.4_
  - [ ] 8.4 Implementasi drop handler di Gantt: cek `yarn_label` vs `active_yarn` mesin — jika sama langsung `Scheduler.scheduleBlock()`; jika berbeda tampilkan `Duration_Popup` terlebih dahulu
    - _Requirements: 5.1, 5.4_
  - [ ] 8.5 Implementasi drop handler saat `stock_status = 'not_ready'`: tampilkan Stock Warning Modal sebelum penempatan
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.8_
  - [ ] 8.6 Setelah MO berhasil dijadwalkan, update baris MO di tabel via `Renderer.updateMORow(moId, 'scheduled')` dan hapus drop zone visual
    - _Requirements: 6.4, 8.7_

- [ ] 9. Drag MO Kembali ke Tabel — Un-schedule Atomik
  - [ ] 9.1 Implementasi `dragstart` pada Blok MO di Gantt: cek `block.locked` — jika locked tampilkan kursor `not-allowed` dan tooltip "tidak dapat diubah"; jika tidak, simpan `blockId` di `dataTransfer`
    - _Requirements: 3.7, 6.6_
  - [ ] 9.2 Implementasi drop handler di Table_Section: panggil `Scheduler.unscheduleBlock(blockId)` atomik; jika sukses hapus blok dari DOM dan tambahkan kembali baris MO ke tabel; jika gagal rollback dan tampilkan error
    - _Requirements: 6.2, 6.3, 6.4, 6.8_
  - [ ] 9.3 Implementasi highlight drop zone visual di Table_Section saat drag Blok MO berlangsung; hilangkan saat drag selesai
    - _Requirements: 6.5_
  - [ ] 9.4 Jika Blok MO di-drop di area selain Table_Section dan bukan timeline (header, control bar), batalkan operasi dan kembalikan blok ke posisi asal
    - _Requirements: 6.7_


- [ ] 10. Timeline Zoom via Drag pada Header Jam
  - [ ] 10.1 Implementasi `mousedown` handler pada `#timeline-header-hours`: simpan `dragStartX` dan `zoomAtDragStart`; set `isDragging = true`
    - _Requirements: 2.1_
  - [ ] 10.2 Implementasi `mousemove` handler (document-level saat dragging): hitung `deltaZoom = Math.trunc((e.clientX - dragStartX) / 5)`; `newZoom = clamp(zoomAtDragStart + deltaZoom, 30, 300)`; hitung `pivotMs` (titik waktu di tengah viewport), `newOriginMs` dari pivot; re-render Gantt + Timeline Header + Now Line dalam satu pass
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_
  - [ ] 10.3 Implementasi `mouseup` handler: set `isDragging = false`, pertahankan zoom level terakhir
    - _Requirements: 2.7_
  - [ ]* 10.4 Tulis PBT `tests/pbt/zoom.pbt.test.js`
    - **Property 1: Kalkulasi Zoom Selalu Dalam Batas** — zoom hasil operasi drag selalu dalam [30, 300]
    - **Validates: Requirements 2.2, 2.3, 2.4**
  - [ ]* 10.5 Tulis PBT `tests/pbt/zoom.pbt.test.js`
    - **Property 2: Viewport Centering Dipertahankan Saat Zoom** — `timeToPixel(pivotMs, newOrigin, newZoom) ≈ viewportWidth / 2`
    - **Validates: Requirements 2.8**
  - [ ]* 10.6 Tulis PBT `tests/pbt/zoom.pbt.test.js`
    - **Property 3: Posisi Piksel Now Line Akurat Terhadap Formula** — hasil `timeToPixel` konsisten dengan `(nowMs - originMs) / 3600000 * zoomPx`
    - **Validates: Requirements 3.2, 3.3**

- [ ] 11. Now Line Realtime & Sticky Clock
  - [ ] 11.1 Implementasi `startNowLineTimer()`: interval 60 detik memanggil `Renderer.updateNowLine()` dan `Scheduler.evaluateLocks(nowMs)` secara bersamaan
    - _Requirements: 3.2, 10.6_
  - [ ] 11.2 Implementasi `startStickyClockTimer()`: interval 1 detik memanggil `Renderer.updateStickyClockDisplay(new Date())` untuk update `HH:MM:SS`
    - _Requirements: 10.5_
  - [ ] 11.3 Implementasi deteksi clock drift: jika selisih antara timestamp aktual dan yang diharapkan > 30 detik, paksa update posisi Now Line dan header dalam ≤5 detik
    - _Requirements: 10.7_
  - [ ] 11.4 Pastikan saat halaman pertama kali dimuat, Timeline_Header, Now Line, dan sticky clock sudah menampilkan waktu sistem yang akurat
    - _Requirements: 10.8_
  - [ ] 11.5 Implementasi update label jam pada `Timeline_Header` tiap jam baru (saat menit = 0) dalam ≤2 detik setelah transisi
    - _Requirements: 10.3, 10.6_


- [ ] 12. Duration Popup & Stock Warning Modal
  - [ ] 12.1 Implementasi `Renderer.showDurationPopup(context, onConfirm, onCancel)`: modal overlay dengan info mesin target, benang aktif, benang MO baru, field input numerik default 45 menit; nonaktifkan drag & drop saat popup terbuka
    - _Requirements: 5.1, 5.2, 5.3, 5.8_
  - [ ] 12.2 Implementasi validasi input durasi: 1–480 menit; tampilkan pesan error inline jika tidak valid, jangan tutup popup; dismiss via batal/ESC/klik luar → `onCancel`
    - _Requirements: 5.5, 5.6, 5.7, 5.9_
  - [ ] 12.3 Implementasi `Renderer.showStockWarningModal(mo, onConfirm, onCancel)`: modal dengan nomor MO, nama benang, status stok Not Ready; konfirmasi menempatkan blok dengan ikon ⚠️; batal/ESC/klik luar membatalkan penempatan
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.8_

- [ ] 13. Tombol Fix Plan
  - [ ] 13.1 Tambahkan tombol `Fix Plan` di control bar; state `disabled` saat tidak ada blok `scheduled` (visual abu-abu, tidak dapat diklik)
    - _Requirements: 4.1, 4.2_
  - [ ] 13.2 Implementasi click handler: panggil `Scheduler.fixPlan()`, perbarui visual semua blok via `Renderer.updateBlockVisual`, tampilkan badge "Plan Telah Di-Fix" di control bar
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
  - [ ] 13.3 Handle hasil `fixPlan()`: jika `fixedCount = 0` tampilkan notifikasi; jika ada `failedMOs` tampilkan notifikasi per MO; kembalikan tombol ke `disabled` setelah semua `scheduled` berubah jadi `fixed`
    - _Requirements: 4.7, 4.8, 4.9_

- [ ] 14. Kolom Resizable di Tabel Bawah
  - [ ] 14.1 Tambahkan elemen handle di tepi kanan setiap `<th>` dengan lebar minimal 6px, cursor `col-resize`
    - _Requirements: 7.1, 7.6_
  - [ ] 14.2 Implementasi drag handler pada handle kolom: `mousedown` simpan `startX` dan `startWidth`; `mousemove` (document-level) perbarui `width = Math.max(40, startWidth + deltaX)` dalam ≤50ms; `mouseup` selesaikan operasi
    - _Requirements: 7.2, 7.3_
  - [ ] 14.3 Sinkronisasi lebar antara `<th>` dan `<td>` via `style.width`; terapkan `word-wrap: break-word` pada semua `<td>`; pertahankan lebar saat scroll/filter; reset ke default hanya saat reload
    - _Requirements: 7.4, 7.5_
  - [ ]* 14.4 Tulis PBT `tests/pbt/table.pbt.test.js`
    - **Property 7: Lebar Kolom Tidak Pernah Di Bawah Minimum** — setelah urutan operasi resize apapun, lebar kolom selalu ≥ 40px
    - **Validates: Requirements 7.3**


- [ ] 15. Checkpoint — Pastikan semua fitur Planner berjalan
  - Verifikasi alur planner: load data → render Gantt → drag MO → zoom → now line → fix plan; jalankan `npm test`; tanyakan kepada user jika ada pertanyaan.

- [ ] 16. IoTHandler & Integrasi IoT
  - [ ] 16.1 Implementasi `IoTHandler.init(config)`: setup `_lastSeen` map, mulai interval 10 detik untuk `checkOfflineStatus()`
    - _Requirements: 14.1_
  - [ ] 16.2 Implementasi `IoTHandler.simulateStatusChange(machineId, status)`: dispatch `CustomEvent('iot:statusChange', { detail: { machineId, status, timestamp } })` pada `document`; update `_lastSeen[machineId]`
    - _Requirements: 14.2, 14.3, 14.4, 14.5_
  - [ ] 16.3 Implementasi `IoTHandler.checkOfflineStatus()`: jika `Date.now() - _lastSeen[id] > threshold_ms`, tampilkan indikator "IoT: OFFLINE" di header kedua halaman
    - _Requirements: 14.7_
  - [ ] 16.4 Tambahkan event listener global di App init: `iot:statusChange` → panggil `Scheduler.handleIoTEvent()`, `Renderer.updateMachineLabel()`, `OperatorView.updateIoTStatus()` (jika di halaman operator)
    - _Requirements: 14.2, 14.3, 14.4, 14.5_
  - [ ] 16.5 Tambahkan tombol simulasi IoT di control bar planner dan header operator: dropdown per mesin untuk trigger 4 status (`running`, `benang_putus`, `rusak`, `tidak_ada_order`)
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 14.2, 14.3, 14.4, 14.5_
  - [ ]* 16.6 Tulis unit test `tests/unit/iothandler.test.js`: simulateStatusChange dispatch event, checkOfflineStatus threshold, event listener handler
    - _Requirements: 14.7_

- [ ] 17. OperatorView — Tampilan, Job Queue & Form Beam
  - [ ] 17.1 Implementasi `OperatorView.init(machineId)`: baca `machineId` dari query string (`?machine=MC1`), muat MO aktif dan job queue dari DataStore
    - _Requirements: 13.1_
  - [ ] 17.2 Implementasi `OperatorView.renderActiveMOHeader()`: tampilkan nomor MO, jenis benang, lot, target beam, panjang per beam, GB; tampilkan status IoT mesin secara prominan di bagian atas
    - _Requirements: 13.1, 14.6_
  - [ ] 17.3 Implementasi `OperatorView.renderJobQueue()`: daftar MO berikutnya dalam urutan yang ditentukan planner
    - _Requirements: 13.2_
  - [ ] 17.4 Implementasi `OperatorView.startWork()`: catat `_startTime = Date.now()`, tampilkan form input beam; sembunyikan tombol "Mulai Bekerja"
    - _Requirements: 13.3_
  - [ ] 17.5 Implementasi form input beam dengan field: beam_no (dropdown dari `beams_assigned`), speed_rpm, panjang_akhir_m, winding, grade (A/B/C), ua, amplas (checkbox), cacat (text)
    - _Requirements: 13.3, 13.4_
  - [ ] 17.6 Implementasi `OperatorView.updateEstimasiDisplay()`: hitung sisa panjang dan estimasi waktu berdasarkan speed, total target, dan panjang yang sudah selesai; update realtime saat speed atau panjang akhir berubah
    - _Requirements: 13.8, 15.6_


- [ ] 18. OperatorView — HPH, Lifecycle Beam & Selesai MO
  - [ ] 18.1 Implementasi `OperatorView.calcBeratKg(denier, lembar, panjangM)`: return `parseFloat((denier * lembar * panjangM / 9000000).toFixed(2))` — pure function
    - _Requirements: 15.2_
  - [ ] 18.2 Implementasi `OperatorView.addBeam(beamData)`: validasi tidak ada duplikat `beam_no` dalam `_beamsLogged`; jika duplikat return `{ success: false, error }`; jika valid hitung `berat_kg`, push ke `_beamsLogged`, perbarui tabel HPH
    - _Requirements: 13.4, 15.3_
  - [ ] 18.3 Implementasi render tabel HPH setelah setiap `addBeam`: kolom seq, beam_no, UI, speed, panjang, winding, grade, UA, berat, amplas, cacat, waktu_selesai; footer: total panjang dan total berat
    - _Requirements: 15.1_
  - [ ] 18.4 Saat `_beamsLogged.length === mo.target_beam`, sembunyikan form input dan tampilkan tombol "Selesai - Lanjut ke MO Berikutnya"
    - _Requirements: 13.5_
  - [ ] 18.5 Implementasi `OperatorView.finishMO()`: update MO status ke `done` di DataStore, muat MO berikutnya dari queue; jika queue kosong tampilkan pesan "Tidak ada MO berikutnya"
    - _Requirements: 13.6, 13.7_
  - [ ] 18.6 Implementasi `requestDeleteBeam(seq, adminPass)`: prompt password, bandingkan dengan `admin_password_hash`; jika benar hapus dari `_beamsLogged` dan kembalikan beam ke daftar pilihan; jika salah tampilkan "Password salah"
    - _Requirements: 15.4, 15.5_
  - [ ] 18.7 HPH di-group per shift (07:00–15:00 Pagi, 15:00–23:00 Siang, 23:00–07:00 Malam); validasi tidak boleh ada dua record dengan `mo_id` + `shift_date` + `shift_id` yang sama
    - _Requirements: 15.7_
  - [ ]* 18.8 Tulis unit test `tests/unit/operatorview.test.js`: addBeam duplikat ditolak, finishMO queue kosong, calcBeratKg formula, requestDeleteBeam password salah
    - _Requirements: 15.3, 15.5_
  - [ ]* 18.9 Tulis PBT `tests/pbt/operatorview.pbt.test.js`
    - **Property 8: Kalkulasi Berat Beam Sesuai Formula** — `calcBeratKg(d, l, p) === parseFloat((d * l * p / 9000000).toFixed(2))` untuk semua input positif
    - **Validates: Requirements 15.2**
  - [ ]* 18.10 Tulis PBT `tests/pbt/operatorview.pbt.test.js`
    - **Property 9: Validasi Beam Tidak Duplikat dalam Satu Sesi MO** — setelah urutan `addBeam` apapun, set nomor beam di `_beamsLogged` selalu unik
    - **Validates: Requirements 15.3**

- [ ] 19. PBT Scheduler — Property Lock & Fix Plan
  - [ ]* 19.1 Tulis PBT `tests/pbt/scheduler.pbt.test.js`
    - **Property 4: Status Lock Ditentukan Sepenuhnya oleh planned_end vs nowMs** — `block.locked === (planned_end <= nowMs)` untuk semua blok non-fixed setelah `evaluateLocks(nowMs)`
    - **Validates: Requirements 3.5**
  - [ ]* 19.2 Tulis PBT `tests/pbt/scheduler.pbt.test.js`
    - **Property 5: Fix Plan Tidak Meninggalkan Blok 'scheduled'** — setelah `fixPlan()`, tidak ada blok dengan `gantt_status = 'scheduled'` yang tersisa; blok non-scheduled tidak terpengaruh
    - **Validates: Requirements 4.3, 4.5**
  - [ ]* 19.3 Tulis PBT `tests/pbt/scheduler.pbt.test.js`
    - **Property 6: Unschedule Blok Bersifat Atomik** — setelah `unscheduleBlock()` sukses, blok tidak ada di `_blocks[]` DAN MO terkait memiliki `gantt_status = 'unscheduled'` secara bersamaan
    - **Validates: Requirements 6.3**


- [ ] 20. Integrasi Akhir & Verifikasi Menyeluruh
  - [ ] 20.1 Verifikasi alur Planner: load data → render Gantt → drag MO → Duration Popup / Stock Warning → zoom → now line → fix plan → IoT simulasi — semua berjalan tanpa error di console
    - _Requirements: 1.3, 2.1, 3.1, 4.1, 5.1, 6.1, 8.1_
  - [ ] 20.2 Verifikasi alur Operator: buka `?machine=MC1` → lihat job queue → mulai bekerja → input beam → selesai MO → lanjut ke MO berikutnya
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_
  - [ ] 20.3 Verifikasi CSS namespace tidak konflik: buka planner dan operator di dua tab, pastikan tidak ada style bocor
    - _Requirements: 12.5_
  - [ ] 20.4 Verifikasi error handling: nonaktifkan `dummy_data.json` sementara, pastikan notifikasi error tampil tanpa crash di kedua halaman
    - _Requirements: 1.6_
  - [ ] 20.5 Jalankan `npm test` dan pastikan semua test (unit + PBT) hijau
    - _Requirements: semua_

- [ ] 21. Checkpoint Akhir — Semua test hijau
  - Jalankan `npm test`, pastikan semua test hijau; tanyakan kepada user jika ada pertanyaan sebelum menutup spec ini.


## Notes

- Implementasi menggunakan Vanilla HTML/CSS/JS (ES6, IIFE modules, Drag and Drop API native, CustomEvent, fetch — native Chromium modern)
- Data dummy ada di `dummy_data.json` — semua akses data wajib melalui `DataStore`, bukan langsung ke JSON
- CSS namespace: `.planner-*` untuk planner-spesifik, `.operator-*` untuk operator-spesifik, tanpa prefix untuk shared
- IoT disimulasikan via tombol UI — `IoTHandler` menggunakan `CustomEvent` agar mudah diganti WebSocket/polling tanpa mengubah Scheduler atau Renderer
- Shift HPH: 07:00–15:00 Pagi, 15:00–23:00 Siang, 23:00–07:00 Malam
- Formula berat beam: `(denier × lembar × panjang_akhir_m) / 9.000.000` dibulatkan 2 desimal
- Operator mengakses halaman dengan query string: `operator_input.html?machine=MC1`
- Sub-task bertanda `*` adalah optional (test tasks) — dapat dilewati untuk MVP lebih cepat
- Setiap property test mengacu pada property yang didefinisikan di design.md bagian "Correctness Properties"

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2", "3.5"] },
    { "id": 2, "tasks": ["2.4", "3.3", "3.4", "5.1", "5.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.6", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "6.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "5.9"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3", "11.1", "11.2", "11.3", "11.4", "11.5", "13.1", "14.1", "16.1", "17.1"] },
    { "id": 6, "tasks": ["8.4", "8.5", "8.6", "10.1", "13.2", "14.2", "14.3", "16.2", "16.3", "16.4", "16.5", "17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 7, "tasks": ["9.1", "9.2", "9.3", "9.4", "10.2", "10.3", "12.1", "12.2", "12.3", "13.3", "14.4", "16.6"] },
    { "id": 8, "tasks": ["10.4", "10.5", "10.6", "18.1", "18.2", "18.3", "18.4", "18.5", "18.6", "18.7", "19.1", "19.2", "19.3"] },
    { "id": 9, "tasks": ["18.8", "18.9", "18.10", "20.1", "20.2", "20.3", "20.4"] },
    { "id": 10, "tasks": ["20.5"] }
  ]
}
```
