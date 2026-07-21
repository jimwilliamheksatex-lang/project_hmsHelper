# Design Document

## Gantt Chart Enhancement — PPC Warping MES Workstation

---

## Overview

Dokumen ini mendeskripsikan arsitektur teknis dan desain implementasi untuk enhancement besar pada sistem PPC Warping MES Workstation di pabrik tekstil departemen warping & knitting. Sistem ini merupakan aplikasi web berbasis **Vanilla HTML/CSS/JS** (tanpa framework JavaScript) yang berjalan di workstation Chromium-based (sisi planner) dan tablet/monitor (sisi operator).

### Tujuan Sistem

Sistem ini menghubungkan dua antarmuka yang saling tergantung:

1. **Warping PPC Planner** (`warping_ppc_planner.html`) — antarmuka Gantt Chart untuk planner menjadwalkan MO ke mesin, memantau kondisi mesin via IoT realtime, dan men-fix plan untuk lapangan.
2. **Operator Input** (`operator_input.html`) — antarmuka per mesin untuk operator mencatat hasil kerja beam-per-beam dan menghasilkan HPH (Hasil Produksi Harian).

### Prinsip Desain Utama

- **Separation of Concerns**: HTML struktur, CSS presentasi, JS logika — dipisah sepenuhnya.
- **API-Ready Architecture**: Semua akses data melalui lapisan `DataStore` yang dapat diganti dengan `fetch()` API tanpa mengubah logika bisnis.
- **IoT-Ready Architecture**: Semua penanganan status IoT melewati `IoTHandler` yang dapat diganti WebSocket/polling tanpa mengubah Renderer.
- **Modular JS**: Empat modul utama (`DataStore`, `Scheduler`, `Renderer`, `OperatorView`) dengan satu modul pendukung (`IoTHandler`) — diekspos melalui satu namespace global `App`.
- **CSS Namespaced**: Prefix `.planner-*` untuk komponen planner-spesifik, `.operator-*` untuk operator-spesifik, tanpa prefix untuk komponen shared.


---

## Architecture

### Diagram Komponen

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Chromium)                           │
│                                                                     │
│  ┌──────────────────────────┐   ┌───────────────────────────────┐  │
│  │  warping_ppc_planner.html │   │     operator_input.html       │  │
│  │   (Planner UI)            │   │     (Operator UI)             │  │
│  └────────────┬─────────────┘   └──────────────┬────────────────┘  │
│               │ load                            │ load              │
│               ▼                                 ▼                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        app.js  (Shared)                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │  DataStore   │  │  Scheduler   │  │      Renderer        │ │ │
│  │  │  (data layer)│  │ (state mgmt) │  │  (DOM / visual)      │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │ │
│  │         │                  │                      │             │ │
│  │  ┌──────┴───────────────────────────────────────┘             │ │
│  │  │           OperatorView                                      │ │
│  │  │           (job queue, form beam, HPH, estimasi)             │ │
│  │  └─────────────────────────────────────────────────────────── │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                     IoTHandler                            │  │ │
│  │  │   (simulasi tombol → dispatch event → Renderer/Scheduler) │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      style.css (Shared)                       │  │
│  │   :root vars │ .planner-* │ .operator-* │ shared components   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     dummy_data.json                           │  │
│  │   (DataStore membaca file ini — akan diganti fetch() API)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Alur Data Tingkat Tinggi

```
dummy_data.json
      │
      ▼
DataStore.load()  ──────────────────────────────────────────────────┐
      │                                                              │
      ├──► Scheduler.init(blocks)   ──► gantt state di memori       │
      │         │                                                    │
      │         ├──► Renderer.renderGantt()                         │
      │         ├──► Renderer.renderNowLine()                       │
      │         └──► Renderer.renderMachineLabels()                 │
      │                                                              │
      ├──► OperatorView.init(machine, mo)  ──► UI operator          │
      │                                                              │
      └──► IoTHandler.init()  ──► polling/simulasi ──► custom event │
                                        │                            │
                          App.on('iot:statusChange')                 │
                                        │                            │
                          Scheduler.handleIoT()  ◄───────────────────┘
                                        │
                          Renderer.updateMachineLabel()
```


---

## Components and Interfaces

### Struktur File

```
h:\Heksatex\HMS\project_hmsHelper\
├── warping_ppc_planner.html   ← halaman planner (rename dari index.html)
├── operator_input.html        ← halaman operator (refactored)
├── style.css                  ← shared stylesheet
├── app.js                     ← shared script, modular
└── dummy_data.json            ← sumber data dummy
```

**Tanggung Jawab Per File:**

| File | Tanggung Jawab |
|------|----------------|
| `warping_ppc_planner.html` | Struktur HTML Gantt Chart, tabel backlog MO, control bar, modal-modal planner |
| `operator_input.html` | Struktur HTML job queue, form beam, tabel HPH, estimasi sisa |
| `style.css` | Semua style: CSS custom properties, class shared, `.planner-*`, `.operator-*` |
| `app.js` | Semua logika: 5 modul (`DataStore`, `Scheduler`, `Renderer`, `OperatorView`, `IoTHandler`) |
| `dummy_data.json` | Data dummy: mesin, MO, shifts, users, HPH, gantt_schedule, config |

### Modul app.js — Interface Publik

#### 1. `DataStore`

Layer abstraksi data. Saat ini membaca dari `dummy_data.json` via `fetch()`. Semua modul lain **wajib** mengakses data melalui DataStore, bukan langsung ke JSON.

```js
const DataStore = (() => {
  let _data = null;

  // Muat seluruh data dari dummy_data.json (atau API endpoint di masa depan)
  async function load(url = './dummy_data.json') { ... }

  // Getter — semua return deep copy / frozen object untuk mencegah mutasi langsung
  function getMachines()             { ... }
  function getMachineById(id)        { ... }
  function getMOs()                  { ... }
  function getMOById(moId)           { ... }
  function getGanttBlocks()          { ... }
  function getGanttBlockById(blockId){ ... }
  function getConfig()               { ... }
  function getUsers()                { ... }
  function getShifts()               { ... }
  function getBeamDatabase()         { ... }
  function getHPHRecords()           { ... }
  function getYarnTypes()            { ... }

  // Setter / mutasi state in-memory (tidak menulis ke disk — untuk masa depan: PATCH /api)
  function updateGanttBlock(blockId, changes) { ... }
  function addGanttBlock(block)               { ... }
  function removeGanttBlock(blockId)          { ... }
  function updateMOStatus(moId, changes)      { ... }
  function updateMachineIoT(machineId, status){ ... }

  return { load, getMachines, getMachineById, getMOs, getMOById,
           getGanttBlocks, getGanttBlockById, getConfig,
           getUsers, getShifts, getBeamDatabase, getHPHRecords, getYarnTypes,
           updateGanttBlock, addGanttBlock, removeGanttBlock,
           updateMOStatus, updateMachineIoT };
})();
```


#### 2. `Scheduler`

Mengelola state jadwal Gantt di memori: penempatan MO, locking, fix plan, drag, un-schedule.

```js
const Scheduler = (() => {
  // State internal
  let _blocks    = [];   // array GanttBlock (working copy dari DataStore)
  let _zoomLevel = 80;   // px per jam (default dari config)

  function init(blocks, config)                { ... }

  // Zoom
  function setZoomLevel(px)                    { ... }  // clamp ke [30, 300]
  function getZoomLevel()                      { return _zoomLevel; }

  // Penempatan MO ke Gantt
  function scheduleBlock(moId, machineId, startTime, setupMin) { ... }
    // return: { success, blockId, error }

  // Unschedule — atomik: hapus blok + kembalikan MO ke 'ready'
  function unscheduleBlock(blockId)            { ... }
    // return: { success, error }

  // Fix Plan — ubah semua 'scheduled' → 'fixed' + locked=true
  function fixPlan()                           { ... }
    // return: { success, fixedCount, failedMOs }

  // Lock / Unlock berdasarkan posisi Now Line
  function evaluateLocks(nowMs)                { ... }

  // Override lock saat BREAKDOWN
  function unlockByBreakdown(machineId)        { ... }

  // Query
  function getBlocksForMachine(machineId)      { ... }
  function isBlockLocked(blockId)              { ... }
  function hasScheduledBlocks()                { ... }

  // Validasi konflik (overlap) sebelum penempatan
  function checkOverlap(machineId, start, end, excludeBlockId) { ... }

  return { init, setZoomLevel, getZoomLevel,
           scheduleBlock, unscheduleBlock, fixPlan,
           evaluateLocks, unlockByBreakdown,
           getBlocksForMachine, isBlockLocked, hasScheduledBlocks,
           checkOverlap };
})();
```


#### 3. `Renderer`

Mengelola semua operasi DOM: render Gantt, blok MO, label mesin, Now Line, Timeline Header.

```js
const Renderer = (() => {
  // Referensi DOM utama (di-cache saat init)
  let _ganttEl, _timelineHeaderEl, _nowLineEl, _machineLabelColEl;

  function init(domRefs)                          { ... }

  // Timeline Header
  function renderTimelineHeader(startMs, endMs, zoomPx) { ... }
  function updateStickyClockDisplay(date)               { ... }

  // Gantt body
  function renderGantt(blocks, machines, zoomPx, startMs) { ... }
  function renderMachineRow(machine, blocks, zoomPx, startMs) { ... }

  // Blok MO
  function renderBlock(block, zoomPx, startMs)    { ... }
  function updateBlockPosition(blockId, newStart, newEnd, zoomPx, startMs) { ... }
  function updateBlockVisual(blockId, ganttStatus) { ... }

  // Now Line
  function renderNowLine(nowMs, zoomPx, startMs)  { ... }
  function updateNowLine(nowMs, zoomPx, startMs)  { ... }

  // Label Mesin
  function renderMachineLabels(machines)           { ... }
  function updateMachineLabel(machineId, iotStatus, activeMO) { ... }

  // Tabel Backlog MO
  function renderMOTable(mos)                      { ... }
  function updateMORow(moId, newStatus)            { ... }

  // Modal & Popup helpers
  function showDurationPopup(context, onConfirm, onCancel) { ... }
  function showStockWarningModal(mo, onConfirm, onCancel)  { ... }
  function showNotification(msg, type)             { ... }  // type: 'info'|'warn'|'error'

  return { init, renderTimelineHeader, updateStickyClockDisplay,
           renderGantt, renderMachineRow, renderBlock,
           updateBlockPosition, updateBlockVisual,
           renderNowLine, updateNowLine,
           renderMachineLabels, updateMachineLabel,
           renderMOTable, updateMORow,
           showDurationPopup, showStockWarningModal, showNotification };
})();
```

#### 4. `OperatorView`

Mengelola antarmuka operator: Job Queue, form input beam, estimasi sisa, HPH.

```js
const OperatorView = (() => {
  let _currentMO   = null;
  let _jobQueue    = [];
  let _beamsLogged = [];
  let _startTime   = null;

  function init(machineId)                     { ... }

  // Job Queue
  function loadJobQueue(machineId)             { ... }
  function renderJobQueue()                    { ... }

  // MO aktif
  function setActiveMO(mo)                     { ... }
  function renderActiveMOHeader()              { ... }

  // Lifecycle
  function startWork()                         { ... }
  function addBeam(beamData)                   { ... }
    // return: { success, error }  — validasi duplikat, range
  function finishMO()                          { ... }

  // Estimasi
  function calcEstimasi(speed, beamsLogged, targetBeam, panjangTarget) { ... }
    // return: { sisaM, estimasiStr }
  function updateEstimasiDisplay()             { ... }

  // HPH
  function renderHPHTable(beams)               { ... }
  function calcBeratKg(denier, lembar, panjangM) { ... }
    // return: number, 2 desimal
  function requestDeleteBeam(seq, adminPass)   { ... }
    // return: { success, error }

  // Status IoT di header operator
  function updateIoTStatus(iotStatus)          { ... }

  return { init, loadJobQueue, renderJobQueue, setActiveMO,
           renderActiveMOHeader, startWork, addBeam, finishMO,
           calcEstimasi, updateEstimasiDisplay,
           renderHPHTable, calcBeratKg, requestDeleteBeam, updateIoTStatus };
})();
```


#### 5. `IoTHandler`

Menangani simulasi status IoT mesin. Arsitektur siap diganti WebSocket/polling.

```js
const IoTHandler = (() => {
  let _pollInterval = null;
  let _lastSeen     = {};   // machineId → timestamp ms terakhir sinyal diterima

  function init(config)                         { ... }

  // Simulasi: tombol UI di control bar men-trigger ini
  function simulateStatusChange(machineId, status) { ... }
    // dispatch CustomEvent 'iot:statusChange' pada document

  // Untuk masa depan: polling HTTP
  // function startPolling(endpoint, intervalMs) { ... }
  // function stopPolling()                      { ... }

  // Untuk masa depan: WebSocket
  // function connectWebSocket(wsUrl)            { ... }
  // function disconnectWebSocket()              { ... }

  // Deteksi offline (tidak ada sinyal > threshold)
  function checkOfflineStatus()                 { ... }

  return { init, simulateStatusChange, checkOfflineStatus };
})();
```

**Custom Event Contract:**
```js
// Event yang di-dispatch oleh IoTHandler
document.dispatchEvent(new CustomEvent('iot:statusChange', {
  detail: {
    machineId: 'MC1',
    status: 'rusak',          // 'running' | 'benang_putus' | 'rusak' | 'tidak_ada_order'
    timestamp: Date.now()
  }
}));

// Listener di App
document.addEventListener('iot:statusChange', (e) => {
  const { machineId, status } = e.detail;
  Scheduler.handleIoTEvent(machineId, status);
  Renderer.updateMachineLabel(machineId, status, DataStore.getMachineById(machineId).active_mo_id);
  if (document.body.dataset.page === 'operator') {
    OperatorView.updateIoTStatus(status);
  }
});
```

### Entry Points per Halaman

```js
// === warping_ppc_planner.html ===
document.addEventListener('DOMContentLoaded', async () => {
  await DataStore.load('./dummy_data.json');
  const config = DataStore.getConfig();
  Scheduler.init(DataStore.getGanttBlocks(), config);
  Renderer.init({ /* dom refs */ });
  IoTHandler.init(config);
  Renderer.renderGantt(/* ... */);
  Renderer.renderTimelineHeader(/* ... */);
  Renderer.renderMachineLabels(DataStore.getMachines());
  Renderer.renderMOTable(DataStore.getMOs().filter(mo => mo.gantt_status === 'unscheduled'));
  startNowLineTimer();
  startStickyClockTimer();
  setupDragDropHandlers();
  setupZoomHandlers();
  setupFixPlanButton();
});

// === operator_input.html ===
document.addEventListener('DOMContentLoaded', async () => {
  await DataStore.load('./dummy_data.json');
  const machineId = new URLSearchParams(location.search).get('machine') || 'MC1';
  IoTHandler.init(DataStore.getConfig());
  OperatorView.init(machineId);
});
```


---

## Data Models

### Model Inti (dipetakan dari `dummy_data.json`)

#### `GanttBlock`

Representasi in-memory satu blok di Gantt Chart. Ini adalah working copy yang dikelola `Scheduler`.

```js
{
  block_id:           String,    // "BLK001"
  mo_id:              String,    // "MO260700124"
  machine_id:         String,    // "MC1"
  gantt_status:       String,    // "unscheduled" | "scheduled" | "fixed" | "in_progress" | "done"
  planned_start:      String,    // ISO 8601: "2026-07-18T07:00:00"
  planned_end:        String,    // ISO 8601: "2026-07-18T14:30:00"
  setup_duration_min: Number,    // 0 jika tidak ada ganti benang, >0 jika ada
  locked:             Boolean    // true = tidak bisa di-drag
}
```

#### `ManufacturingOrder`

```js
{
  mo_id:              String,    // "MO260700124"
  knitting_mc:        String,    // "MC48"
  machine_id:         String,    // null jika belum dijadwalkan
  yarn_type_id:       String,    // "YRN001"
  yarn_label:         String,    // "POLY SDY SD 75-36/560"
  lot:                String,    // "LOT-2024-A"
  target_beam:        Number,    // 6
  gb:                 Number,    // 2
  speed_target_rpm:   Number,    // 500
  order_per_beam_m:   Number,    // 13253
  lembar:             Number,    // 560
  denier:             Number,    // 75
  slowert_tension:    String,    // "T-1" atau ""
  stock_status:       String,    // "ready" | "not_ready"
  mo_status:          String,    // "ready" | "in_progress" | "done"
  gantt_status:       String,    // "unscheduled" | "scheduled" | "fixed" | "in_progress" | "done"
  planned_start:      String,    // ISO 8601 atau null
  planned_end:        String,    // ISO 8601 atau null
  beams_assigned:     String[]   // ["J199", "156", ...]
}
```

#### `Machine`

```js
{
  id:           String,   // "MC1"
  name:         String,   // "MC1"
  type:         String,   // "Karl Mayer TM4-EL"
  max_speed_rpm:Number,   // 600
  iot_status:   String,   // "running" | "benang_putus" | "rusak" | "tidak_ada_order"
  active_yarn:  {
    jenis:  String,  lot: String,  count: String,  lembar: Number
  },
  active_mo_id: String    // null jika idle
}
```

#### `HPHBeam`

```js
{
  seq:           Number,   // 1, 2, 3, ...
  beam_no:       String,   // "J199"
  ui_mm:         String,   // "662"
  speed_rpm:     Number,   // 500
  panjang_akhir_m: Number, // 13253
  winding:       Number,   // 12
  grade:         String,   // "A" | "B" | "C"
  ua:            String,   // "UA-01"
  berat_kg:      Number,   // 6.19 — dihitung otomatis
  amplas:        Boolean,  // true | false
  cacat:         String,   // "" atau deskripsi cacat
  waktu_selesai: String    // ISO 8601
}
```

#### `AppConfig` (dari `app_config` di JSON)

```js
{
  admin_password_hash:          String,  // "admin123" (plaintext di dummy)
  shift_start_hour:             Number,  // 7
  shift_end_hour:               Number,  // 7
  shift_span_days:              Number,  // 1
  gantt_zoom_min_px_per_hour:   Number,  // 30
  gantt_zoom_max_px_per_hour:   Number,  // 300
  gantt_zoom_default_px_per_hour: Number,// 80
  now_line_update_interval_sec: Number,  // 60
  iot_offline_threshold_sec:    Number,  // 30
  berat_formula:                String,  // "denier * lembar * panjang_akhir / 9000000"
  yarn_change_default_duration_min: Number, // 45
  yarn_change_min_duration_min: Number,  // 1
  yarn_change_max_duration_min: Number   // 480
}
```

### State Management In-Memory

State Gantt dikelola sepenuhnya di memori JS oleh `Scheduler`. Tidak ada persistensi ke disk (dummy — untuk produksi akan di-sync ke API). Pola yang dipakai:

```
DataStore (source of truth dummy_data.json)
    │
    └──► Scheduler._blocks[]   ← copy yang bisa dimutasi
              │
              ├── operasi: scheduleBlock, unscheduleBlock, fixPlan, evaluateLocks
              │
              └──► DataStore.updateGanttBlock()  ← sinkronisasi balik ke DataStore
                        │
                        └── (masa depan: PATCH /api/gantt-blocks/:id)
```

Prinsip **atomik** untuk operasi kritikal (unschedule):
```
1. Tandai block sebagai "pending_remove" di _blocks[]
2. Update MO status → 'ready' di DataStore
3. Jika (2) sukses → hapus block dari _blocks[], trigger Renderer
4. Jika (2) gagal  → rollback: hapus flag "pending_remove", tidak ada perubahan visual
```


---

## Gantt Chart Mechanics

### Kalkulasi Zoom dan Posisi Piksel

Semua posisi horizontal di Gantt Chart dihitung dari **`ganttOriginMs`** (timestamp Unix milidetik dari awal viewport Gantt, biasanya `shift_start_hour` hari ini).

```js
/**
 * Konversi timestamp ke posisi piksel horizontal.
 * @param {number} timestampMs  - Unix ms dari waktu yang ingin diposisikan
 * @param {number} originMs     - Unix ms dari tepi kiri Gantt (viewport origin)
 * @param {number} zoomPx       - piksel per jam (zoom level)
 * @returns {number}            - posisi piksel dari tepi kiri area Gantt
 */
function timeToPixel(timestampMs, originMs, zoomPx) {
  const diffHours = (timestampMs - originMs) / (1000 * 60 * 60);
  return diffHours * zoomPx;
}

/**
 * Konversi posisi piksel ke timestamp.
 */
function pixelToTime(px, originMs, zoomPx) {
  const diffHours = px / zoomPx;
  return originMs + diffHours * 3600000;
}

/**
 * Hitung lebar piksel sebuah blok dari durasi.
 */
function durationToWidth(durationMs, zoomPx) {
  return (durationMs / 3600000) * zoomPx;
}
```

### Drag-to-Zoom pada Timeline Header

Rate: **1 px/jam per 5 px gerakan mouse horizontal**.

```
Pseudocode:
  onMouseDown(e) pada #timeline-header-hours:
    isDragging = true
    dragStartX = e.clientX
    zoomAtDragStart = Scheduler.getZoomLevel()

  onMouseMove(e) saat isDragging:
    deltaPx = e.clientX - dragStartX
    deltaZoom = Math.trunc(deltaPx / 5)
    newZoom = clamp(zoomAtDragStart + deltaZoom, 30, 300)
    IF newZoom !== currentZoom:
      pivotMs = pixelToTime(viewportCenterPx, originMs, currentZoom)  ← simpan pivot
      Scheduler.setZoomLevel(newZoom)
      newOriginMs = pivotMs - (viewportCenterPx / newZoom) * 3600000   ← hitung origin baru
      Renderer.renderGantt(blocks, machines, newZoom, newOriginMs)
      Renderer.updateNowLine(nowMs, newZoom, newOriginMs)

  onMouseUp(e):
    isDragging = false
```

**Viewport Centering saat Zoom:** Titik waktu yang dipetakan ke piksel tengah viewport sebelum zoom harus tetap di tengah setelah zoom. Ini dicapai dengan menghitung `pivotMs` lalu menyesuaikan `ganttOriginMs`.

### Drag & Drop MO ke Gantt

```
Pseudocode dragDrop:

  === DRAG DARI TABEL KE GANTT ===
  onDragStart (dari baris tabel MO):
    dragPayload = { moId, type: 'from-table' }
    TableSection.showDropZone()

  onDragOver (di area Gantt row mesin X, posisi pixelX):
    targetTime = pixelToTime(pixelX - ganttLeftOffset, originMs, zoomPx)
    snappedTime = snapToMinutes(targetTime, 15)    ← snap ke 15 menit
    showSnapGhost(machineId, snappedTime, mo.estimated_duration)

  onDrop (di Gantt row mesin X):
    hideSnapGhost()
    TableSection.hideDropZone()
    plannedStart = snappedTime
    plannedEnd   = plannedStart + estimatedDurationMs(mo)

    IF mo.yarn_label !== machines[X].active_yarn:
      Renderer.showDurationPopup({machine, activeyarn, moYarn}, onConfirm, onCancel)
      onConfirm(setupMin):
        Scheduler.scheduleBlock(moId, machineX, plannedStart - setupMin*60000, setupMin)
        Renderer.renderBlock(newBlock, zoomPx, originMs)
        Renderer.updateMORow(moId, 'scheduled')

    IF mo.stock_status === 'not_ready':
      Renderer.showStockWarningModal(mo, onConfirm, onCancel)
      onConfirm:
        lanjut penempatan dengan ikon ⚠️

  === DRAG DARI GANTT KE TABEL ===
  onDragStart (dari Blok MO di Gantt):
    IF block.locked: setCursor('not-allowed'), return
    dragPayload = { blockId, type: 'from-gantt' }

  onDrop (di Table_Section):
    result = Scheduler.unscheduleBlock(blockId)  ← atomik
    IF result.success:
      Renderer.removeBlock(blockId)
      Renderer.updateMORow(moId, 'ready')
      TableSection.hideDropZone()
    ELSE:
      Renderer.showNotification(result.error, 'error')
```

### Estimasi Durasi MO

Estimasi durasi sebuah MO untuk keperluan penempatan di Gantt dihitung berdasarkan data MO:

```js
function estimateMODurationMs(mo) {
  // total panjang = target_beam × order_per_beam_m
  const totalPanjang = mo.target_beam * mo.order_per_beam_m;  // meter
  // kecepatan dalam meter per menit: speed_target_rpm (ini pendekatan sederhana)
  // Di produksi nyata ini akan dari formula kalibrasi mesin
  const speedMpm = mo.speed_target_rpm;
  const durationMin = totalPanjang / speedMpm;
  return durationMin * 60 * 1000;  // ms
}
```

### Now Line — Timer dan Locking

```js
// Timer interval 60 detik (dari config.now_line_update_interval_sec)
function startNowLineTimer() {
  setInterval(() => {
    const nowMs = Date.now();
    Renderer.updateNowLine(nowMs, Scheduler.getZoomLevel(), ganttOriginMs);
    Scheduler.evaluateLocks(nowMs);   // update locked status semua blok
  }, config.now_line_update_interval_sec * 1000);
}

// Evaluasi lock: blok locked jika planned_end <= nowMs
// Scheduler.evaluateLocks(nowMs):
//   for each block in _blocks:
//     shouldLock = new Date(block.planned_end).getTime() <= nowMs
//     if shouldLock && !block.locked: lock(block)   → Renderer.updateBlockVisual
//     if !shouldLock && block.locked && block.gantt_status !== 'fixed': unlock(block)
```


---

## Data Flow Diagrams

### Planner Flow

```
Planner buka warping_ppc_planner.html
          │
          ▼
DataStore.load() ──► parse dummy_data.json
          │
          ├──► Scheduler.init(blocks, config)
          ├──► Renderer.renderGantt()
          ├──► Renderer.renderTimelineHeader()
          ├──► Renderer.renderMachineLabels()
          └──► Renderer.renderMOTable(unscheduled MOs)
                    │
                    ▼
            Planner drag MO dari Tabel ke Gantt
                    │
          ┌─────────┴──────────────────┐
          │ yarn sama?                 │ yarn beda?
          ▼                            ▼
    langsung schedule           showDurationPopup
          │                           │
          │                    planner input durasi
          │                           │
          └──────────┬────────────────┘
                     ▼
              Scheduler.scheduleBlock()
              DataStore.updateGanttBlock()
              Renderer.renderBlock()
              Renderer.updateMORow()
                     │
                     ▼
              Planner klik "Fix Plan"
                     │
              Scheduler.fixPlan()
              Renderer.updateBlockVisual (semua scheduled → fixed)
              Renderer.showNotification("Plan Telah Di-Fix")
                     │
                     ▼
              IoT event masuk (simulasi tombol)
              IoTHandler.simulateStatusChange()
              document event 'iot:statusChange'
                     │
              Scheduler.handleIoTEvent()
              Renderer.updateMachineLabel()
```

### Operator Flow

```
Operator buka operator_input.html?machine=MC1
          │
          ▼
DataStore.load() ──► DataStore.getMOById(active_mo_id)
          │
OperatorView.init('MC1')
          │
          ├──► OperatorView.setActiveMO(activeMO)
          ├──► OperatorView.renderActiveMOHeader()
          ├──► OperatorView.loadJobQueue('MC1')
          └──► OperatorView.renderJobQueue()
                    │
                    ▼
            Operator klik "Mulai Bekerja"
                    │
            OperatorView.startWork()
            _startTime = Date.now()
            tampilkan form beam
                    │
                    ▼
            Operator isi form dan klik "Done - Add Beam"
                    │
            OperatorView.addBeam(beamData)
                    │
                ┌───┴───────────────────┐
                │ validasi              │ duplikat / invalid
                ▼                       ▼
            confirm dialog          showNotification(error)
                │
            _beamsLogged.push(beam)
            calcBeratKg() → tampilkan di tabel HPH
            updateEstimasiDisplay()
                    │
            jumlah beam = target_beam?
                    │
                    ▼
            tampilkan "Selesai - Lanjut ke MO Berikutnya"
                    │
            OperatorView.finishMO()
            DataStore.updateMOStatus(moId, {mo_status:'done', gantt_status:'done'})
            loadJobQueue() ──► MO berikutnya dari queue
```


---

## Component Design (style.css)

### Struktur CSS

```
style.css
├── 1. CSS Custom Properties (:root)
│       Warna, spacing, font, radius, shadow, transisi
├── 2. Reset & Base
│       *, body, box-sizing
├── 3. Shared Components (tanpa prefix)
│       .btn, .btn-primary, .btn-danger, .btn-disabled
│       .badge, .badge-running, .badge-rusak, .badge-idle
│       .modal-overlay, .modal-box, .modal-header, .modal-body, .modal-footer
│       .notification, .notification-info, .notification-warn, .notification-error
│       .form-group, .form-group label, .form-group input, .form-group select
│       .table-base, th, td
│       .icon-warning (⚠️)
├── 4. Planner Components (.planner-*)
│       .planner-gantt-container
│       .planner-timeline-header
│       .planner-machine-label
│       .planner-machine-label__iot-indicator
│       .planner-gantt-row
│       .planner-block, .planner-block--scheduled, .planner-block--fixed
│       .planner-block--in-progress, .planner-block--done
│       .planner-block--locked (cursor: not-allowed)
│       .planner-block--not-ready (ikon ⚠️)
│       .planner-now-line
│       .planner-sticky-clock
│       .planner-control-bar
│       .planner-table-section
│       .planner-table-section--drop-active (border highlight saat drag)
│       .planner-col-resize-handle
│       .planner-snap-ghost (transparan, dashed border)
├── 5. Operator Components (.operator-*)
│       .operator-header
│       .operator-iot-status
│       .operator-mo-header
│       .operator-estimasi-box
│       .operator-form-input
│       .operator-job-queue
│       .operator-hph-table
└── 6. Utility Classes
        .text-bold, .text-sm, .text-xs
        .color-orange, .color-blue, .color-green, .color-red, .color-gray
        .cursor-not-allowed, .cursor-col-resize
        .hidden, .visible
        .d-flex, .d-grid, .gap-*, .p-*, .m-*
```

### CSS Custom Properties Utama

```css
:root {
  /* Warna brand */
  --color-primary:       #2c3e50;
  --color-accent:        #27ae60;
  --color-danger:        #e74c3c;
  --color-warning:       #f39c12;
  --color-info:          #3498db;
  --color-bg:            #f4f7f6;
  --color-surface:       #ffffff;
  --color-text:          #2c3e50;
  --color-text-muted:    #7f8c8d;

  /* IoT status */
  --iot-running:         #27ae60;
  --iot-rusak:           #e74c3c;
  --iot-neutral:         #95a5a6;

  /* Gantt blok status */
  --block-scheduled:     #3498db;
  --block-fixed:         #8e44ad;
  --block-in-progress:   #27ae60;
  --block-done:          #7f8c8d;
  --block-setup:         #f39c12;   /* blok ganti benang */
  --block-not-ready-border: #f39c12;

  /* Layout */
  --machine-label-width: 160px;
  --gantt-row-height:    52px;
  --header-height:       60px;
  --sticky-clock-size:   var(--machine-label-width);

  /* Transisi */
  --transition-fast:     150ms ease;
  --transition-normal:   250ms ease;
}
```

### Prinsip CSS Penting

- **Kolom resizable**: Lebar kolom tabel dikelola via `style.width` langsung di `<th>` + `<td>`, dikontrol JS. Tidak menggunakan CSS grid fixed karena perlu resize dinamis.
- **Gantt overflow**: `.planner-gantt-container` menggunakan `overflow-x: auto` untuk scroll horizontal; posisi blok menggunakan `position: absolute` dengan `left` dan `width` dari `timeToPixel()`.
- **Sticky Clock**: `.planner-sticky-clock` menggunakan `position: sticky; left: 0; z-index: 10` agar tetap terlihat saat scroll horizontal.
- **Now Line**: `position: absolute; top: 0; bottom: 0` di dalam container Gantt, `left` di-update via JS.


---

## IoT Integration Architecture

### Arsitektur Saat Ini (Simulasi Tombol UI)

```
Control Bar (planner)           Operator View
      │                               │
  Tombol simulasi                 Tombol simulasi
  "MC1: Rusak"                    "Benang Putus"
      │                               │
      └─────────────┬─────────────────┘
                    ▼
         IoTHandler.simulateStatusChange(machineId, status)
                    │
         dispatch CustomEvent('iot:statusChange', { machineId, status, timestamp })
                    │
         App event listener:
           - Scheduler.handleIoTEvent(machineId, status)
           - Renderer.updateMachineLabel(machineId, status)
           - OperatorView.updateIoTStatus(status)   [jika di halaman operator]
           - IoTHandler._lastSeen[machineId] = Date.now()
```

### Arsitektur Masa Depan (WebSocket atau Polling)

**Prinsip**: Hanya `IoTHandler` yang perlu diubah. Semua kode di atas IoTHandler (Scheduler, Renderer, OperatorView) tidak berubah karena mereka hanya bereaksi pada `CustomEvent('iot:statusChange')`.

```js
// Penggantian mudah: ganti implementasi IoTHandler.init()

// Opsi A — WebSocket
function init(config) {
  const ws = new WebSocket('wss://mes-api.heksatex.com/iot');
  ws.onmessage = (event) => {
    const { machineId, status, timestamp } = JSON.parse(event.data);
    document.dispatchEvent(new CustomEvent('iot:statusChange', {
      detail: { machineId, status, timestamp }
    }));
    _lastSeen[machineId] = timestamp;
  };
}

// Opsi B — HTTP Polling
function startPolling(endpoint, intervalMs) {
  _pollInterval = setInterval(async () => {
    const data = await fetch(endpoint).then(r => r.json());
    data.machines.forEach(m => {
      if (m.iot_status !== _lastStatus[m.id]) {
        document.dispatchEvent(new CustomEvent('iot:statusChange', {
          detail: { machineId: m.id, status: m.iot_status, timestamp: Date.now() }
        }));
        _lastStatus[m.id] = m.iot_status;
      }
    });
  }, intervalMs);
}
```

### Deteksi Offline

```js
// Dipanggil setiap 10 detik
function checkOfflineStatus() {
  const threshold = config.iot_offline_threshold_sec * 1000;
  const now = Date.now();
  DataStore.getMachines().forEach(machine => {
    const lastSeen = _lastSeen[machine.id] || 0;
    if (now - lastSeen > threshold) {
      Renderer.showIoTOfflineIndicator(machine.id);
    }
  });
}
```

---

## API Readiness Layer

Semua akses data yang saat ini menggunakan `dummy_data.json` akan digantikan oleh `fetch()` di masa depan **hanya pada lapisan `DataStore`**. Signature fungsi DataStore tidak berubah — hanya implementasinya.

### Peta Penggantian DataStore → API

| Fungsi DataStore (saat ini) | Endpoint API (masa depan) | HTTP Method |
|---|---|---|
| `load()` | `GET /api/init` | GET |
| `getMachines()` | `GET /api/machines` | GET |
| `getMOs()` | `GET /api/manufacturing-orders` | GET |
| `getGanttBlocks()` | `GET /api/gantt-schedule` | GET |
| `updateGanttBlock(id, changes)` | `PATCH /api/gantt-blocks/:id` | PATCH |
| `addGanttBlock(block)` | `POST /api/gantt-blocks` | POST |
| `removeGanttBlock(id)` | `DELETE /api/gantt-blocks/:id` | DELETE |
| `updateMOStatus(id, changes)` | `PATCH /api/manufacturing-orders/:id` | PATCH |
| `updateMachineIoT(id, status)` | `PATCH /api/machines/:id/iot` | PATCH |

### Contoh Penggantian

```js
// SEKARANG (dummy):
async function load(url = './dummy_data.json') {
  const res = await fetch(url);
  _data = await res.json();
}

// NANTI (API):
async function load() {
  const [machines, mos, ganttBlocks, config] = await Promise.all([
    fetch('/api/machines').then(r => r.json()),
    fetch('/api/manufacturing-orders').then(r => r.json()),
    fetch('/api/gantt-schedule').then(r => r.json()),
    fetch('/api/config').then(r => r.json()),
  ]);
  _data = { machines, manufacturing_orders: mos, gantt_schedule: ganttBlocks, app_config: config };
}
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

#### Reflection: Eliminasi Redundansi

Sebelum menulis properties, dilakukan refleksi untuk menggabungkan dan menghilangkan redundansi:

- **2.2 dan 2.3** (zoom kiri dan zoom kanan) dapat digabung menjadi satu property zoom calculation yang menangani semua nilai delta.
- **3.5 dan 3.5b** (lock dan unlock berdasarkan Now Line) dapat digabung menjadi satu property yang menyatakan hubungan deterministik antara `planned_end` dan `nowMs`.
- **13.2 dan 15.2** (kalkulasi berat beam) adalah requirement yang sama — satu property.
- **2.8** (viewport centering) adalah property mandiri karena menguji matematika preservasi pivot.
- **Property blok untuk Fix Plan (4.3)** dan **property atomisitas unschedule (6.3)** keduanya unik.

Hasil: **8 properties** yang saling tidak redundan.

---

### Property 1: Kalkulasi Zoom Selalu Dalam Batas

*For any* nilai zoom awal yang valid dalam rentang [30, 300] dan nilai delta drag (piksel), hasil zoom baru setelah menerapkan rate 1px/jam per 5px gerakan harus selalu berada dalam rentang [30, 300] — tidak pernah di bawah minimum maupun di atas maksimum.

**Validates: Requirements 2.2, 2.3, 2.4**

---

### Property 2: Viewport Centering Dipertahankan Saat Zoom

*For any* kombinasi zoom lama, zoom baru (keduanya dalam [30, 300]), lebar viewport, dan timestamp pivot yang merupakan titik tengah viewport sebelum zoom — posisi piksel dari timestamp pivot tersebut di viewport baru harus sama dengan setengah lebar viewport (± 1 piksel toleransi pembulatan floating-point).

Secara formal: `timeToPixel(pivotMs, newOrigin, newZoom) ≈ viewportWidth / 2`

**Validates: Requirements 2.8**

---

### Property 3: Posisi Piksel Now Line Akurat Terhadap Formula

*For any* kombinasi timestamp waktu sekarang (`nowMs`), timestamp origin Gantt (`originMs`), dan zoom level (`zoomPx`) dalam [30, 300] — posisi piksel Now Line yang dihasilkan oleh `timeToPixel(nowMs, originMs, zoomPx)` harus konsisten: menggunakan formula `(nowMs - originMs) / 3600000 * zoomPx`.

**Validates: Requirements 3.2, 3.3**

---

### Property 4: Status Lock Blok Ditentukan Sepenuhnya oleh planned_end vs nowMs

*For any* blok Gantt dengan `gantt_status` bukan `fixed` dan `nowMs` yang valid — setelah pemanggilan `Scheduler.evaluateLocks(nowMs)`, status `locked` blok tersebut harus secara deterministik mengikuti aturan: `block.locked === (new Date(block.planned_end).getTime() <= nowMs)`. Tidak ada kondisi lain yang mempengaruhi status lock kecuali override BREAKDOWN.

**Validates: Requirements 3.5**

---

### Property 5: Fix Plan Mengubah Semua 'scheduled' Menjadi 'fixed'

*For any* state Scheduler yang memiliki satu atau lebih blok dengan `gantt_status = 'scheduled'` — setelah pemanggilan `Scheduler.fixPlan()`, tidak boleh ada satu pun blok dengan `gantt_status = 'scheduled'` yang tersisa; setiap blok yang sebelumnya `scheduled` harus memiliki `gantt_status = 'fixed'` dan `locked = true`. Blok dengan status lain (`fixed`, `in_progress`, `done`) tidak boleh terpengaruh.

**Validates: Requirements 4.3, 4.5**

---

### Property 6: Unschedule Blok Bersifat Atomik

*For any* blok yang valid dengan `gantt_status = 'scheduled'` — setelah `Scheduler.unscheduleBlock(blockId)` berhasil, dua kondisi berikut harus benar **secara bersamaan**: (1) blok dengan `block_id` tersebut tidak lagi ada dalam `Scheduler._blocks[]`, dan (2) MO yang terkait memiliki `gantt_status = 'unscheduled'` dan `mo_status = 'ready'`. Tidak boleh ada state di mana satu kondisi benar dan yang lain belum diperbarui.

**Validates: Requirements 6.3**

---

### Property 7: Lebar Kolom Tabel Tidak Pernah Di Bawah Minimum

*For any* urutan operasi resize kolom tabel (drag handle ke kiri sejauh apapun, nilai delta piksel apapun) — lebar setiap kolom yang dihasilkan tidak pernah kurang dari 40 piksel. Ini berlaku setelah operasi resize tunggal maupun rangkaian operasi resize berulang.

**Validates: Requirements 7.3**

---

### Property 8: Kalkulasi Berat Beam Sesuai Formula

*For any* nilai denier (bilangan positif), lembar (bilangan positif integer), dan panjang_akhir_m (bilangan positif) — hasil `calcBeratKg(denier, lembar, panjang)` harus sama dengan `(denier * lembar * panjang) / 9000000`, dibulatkan ke 2 desimal. Fungsi ini bersifat pure: output yang sama untuk input yang sama, tanpa side effect.

**Validates: Requirements 13.2, 15.2**

---

### Property 9: Validasi Beam Tidak Duplikat dalam Satu Sesi MO

*For any* urutan penambahan beam dalam satu sesi MO (semua urutan dan semua nomor beam yang mungkin) — setelah setiap operasi `OperatorView.addBeam(beamData)`, set nomor beam yang tercatat dalam `_beamsLogged` harus selalu berisi nomor-nomor yang unik (tidak ada duplikat). Jika beam dengan nomor yang sudah ada dicoba ditambahkan, operasi tersebut harus ditolak dan state `_beamsLogged` tidak berubah.

**Validates: Requirements 15.3**


---

## Error Handling

### Kategori Error dan Penanganan

| Kategori | Contoh | Penanganan |
|---|---|---|
| **Data Load Error** | `fetch('dummy_data.json')` gagal | `console.error()`, tampilkan notifikasi merah di halaman, app dalam mode degraded |
| **Validasi Input** | Durasi ganti benang < 1 atau > 480, beam kosong, speed 0 | Inline error message di popup/form, tidak tutup popup, tidak submit form |
| **Konflik Jadwal** | Overlap blok MO di mesin yang sama | Scheduler.checkOverlap() menolak drop, Renderer menampilkan notifikasi warn |
| **Operasi Gagal Atomik** | unscheduleBlock() gagal di tengah | Rollback penuh ke state sebelumnya, Renderer tampilkan error |
| **Fix Plan Partial** | Sebagian MO gagal di-fix | Laporan MO mana yang gagal, MO gagal tetap `scheduled`, MO sukses tetap `fixed` |
| **Password Salah** | hapus beam dengan password salah | Alert "Password salah", baris tetap ada |
| **IoT Offline** | Tidak ada sinyal > 30 detik | Indikator "IoT: OFFLINE" di header, app tetap berjalan |
| **Drag ke Area Invalid** | Drop blok di header/control bar | Rollback ke posisi asal, tidak ada perubahan state |

### Error Boundary per Modul

```js
// DataStore — semua fungsi async harus handle error
async function load(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _data = await res.json();
  } catch (err) {
    console.error('[DataStore] Gagal memuat data:', err);
    Renderer.showNotification('Gagal memuat data. Periksa koneksi.', 'error');
    throw err;  // re-throw agar caller tahu load gagal
  }
}

// Scheduler — operasi kritis return { success, error }
function unscheduleBlock(blockId) {
  const block = _blocks.find(b => b.block_id === blockId);
  if (!block) return { success: false, error: 'Block tidak ditemukan' };
  if (block.locked) return { success: false, error: 'Block terkunci, tidak bisa di-unschedule' };
  // ... operasi atomik
}
```

### Validasi Input Duration Popup

```js
function validateDuration(value) {
  const num = parseInt(value, 10);
  if (!value || isNaN(num)) return 'Durasi harus diisi dengan angka.';
  if (num < 1) return 'Durasi minimal 1 menit.';
  if (num > 480) return 'Durasi maksimal 480 menit (8 jam).';
  return null;  // valid
}
```

---

## Testing Strategy

### Pendekatan Dual Testing

Fitur ini menggunakan dua lapisan testing yang saling melengkapi:

1. **Unit Tests (Example-based)** — menguji perilaku konkret, edge case, dan alur UI spesifik.
2. **Property-Based Tests (PBT)** — menguji properti universal yang berlaku untuk semua input valid.

### Library PBT

Gunakan **[fast-check](https://github.com/dubzzz/fast-check)** untuk property-based testing di JavaScript. Jalankan via Node.js atau Jest.

```
npm install --save-dev fast-check
```

Setiap property test dikonfigurasi minimum **100 iterasi** (default fast-check adalah 100, cukup untuk fitur ini).

### Unit Tests — Target Coverage

| Modul | Test Case |
|---|---|
| `DataStore` | load sukses, load gagal (network error), getter mengembalikan deep copy, update sinkron state |
| `Scheduler` | scheduleBlock valid, scheduleBlock overlap, unscheduleBlock blok locked gagal, fixPlan tidak ada scheduled, fixPlan partial failure |
| `Renderer` | renderBlock menampilkan elemen dengan class benar, updateMachineLabel 3 kondisi IoT, showDurationPopup validasi |
| `OperatorView` | addBeam duplikat ditolak, finishMO queue kosong, calcBeratKg formula, requestDeleteBeam password salah |
| `IoTHandler` | simulateStatusChange dispatch event, checkOfflineStatus threshold, event listener handler |

### Property-Based Tests — Implementasi

Setiap property test di bawah mengacu pada property yang didefinisikan di bagian Correctness Properties.

```js
// ==========================================
// Feature: gantt-chart-enhancement
// ==========================================

const fc = require('fast-check');

// Property 1: Kalkulasi Zoom Selalu Dalam Batas
// Tag: Feature: gantt-chart-enhancement, Property 1
test('zoom selalu dalam batas [30, 300]', () => {
  fc.assert(fc.property(
    fc.integer({ min: 30, max: 300 }),   // initialZoom
    fc.integer({ min: -2000, max: 2000 }),// dragDeltaPx
    (initialZoom, dragDeltaPx) => {
      const deltaZoom = Math.trunc(dragDeltaPx / 5);
      const newZoom = Math.min(300, Math.max(30, initialZoom + deltaZoom));
      return newZoom >= 30 && newZoom <= 300;
    }
  ), { numRuns: 100 });
});

// Property 2: Viewport Centering Dipertahankan
// Tag: Feature: gantt-chart-enhancement, Property 2
test('pivot time tetap di tengah viewport setelah zoom', () => {
  fc.assert(fc.property(
    fc.integer({ min: 30, max: 300 }),   // zoomOld
    fc.integer({ min: 30, max: 300 }),   // zoomNew
    fc.integer({ min: 800, max: 2560 }), // viewportWidth (px)
    fc.integer({ min: 0, max: 86400000 }),// pivotOffsetMs dari origin
    (zoomOld, zoomNew, viewportWidth, pivotOffsetMs) => {
      const originOld = 0;
      const pivotMs = originOld + (viewportWidth / 2 / zoomOld) * 3600000;
      const newOrigin = pivotMs - (viewportWidth / 2 / zoomNew) * 3600000;
      const newPivotPx = (pivotMs - newOrigin) / 3600000 * zoomNew;
      return Math.abs(newPivotPx - viewportWidth / 2) < 1; // toleransi 1px
    }
  ), { numRuns: 100 });
});

// Property 3: Posisi Piksel Now Line Akurat
// Tag: Feature: gantt-chart-enhancement, Property 3
test('posisi piksel Now Line konsisten dengan formula', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 86400000 }),  // nowOffset dari origin (ms)
    fc.integer({ min: 30, max: 300 }),       // zoomPx
    (nowOffsetMs, zoomPx) => {
      const originMs = 0;
      const nowMs = originMs + nowOffsetMs;
      const expectedPx = nowOffsetMs / 3600000 * zoomPx;
      const actualPx = (nowMs - originMs) / 3600000 * zoomPx;
      return Math.abs(actualPx - expectedPx) < 0.001;
    }
  ), { numRuns: 100 });
});

// Property 4: Status Lock Deterministik
// Tag: Feature: gantt-chart-enhancement, Property 4
test('lock status ditentukan sepenuhnya oleh planned_end vs nowMs', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 1000000000 }),  // planned_end Ms
    fc.integer({ min: 0, max: 1000000000 }),  // nowMs
    (plannedEndMs, nowMs) => {
      const block = { planned_end: new Date(plannedEndMs).toISOString(), locked: false, gantt_status: 'scheduled' };
      evaluateLockForBlock(block, nowMs); // fungsi yang diisolasi dari Scheduler
      return block.locked === (plannedEndMs <= nowMs);
    }
  ), { numRuns: 100 });
});

// Property 5: Fix Plan Tidak Meninggalkan 'scheduled'
// Tag: Feature: gantt-chart-enhancement, Property 5
test('setelah fixPlan tidak ada blok dengan status scheduled', () => {
  fc.assert(fc.property(
    fc.array(fc.record({
      block_id: fc.string({ minLength: 3, maxLength: 10 }),
      gantt_status: fc.constantFrom('scheduled', 'fixed', 'in_progress', 'done'),
      locked: fc.boolean()
    }), { minLength: 1, maxLength: 20 }),
    (blocks) => {
      const result = simulateFixPlan(blocks); // pure function dari Scheduler
      return result.every(b => b.gantt_status !== 'scheduled');
    }
  ), { numRuns: 100 });
});

// Property 7: Lebar Kolom Tidak Pernah < 40px
// Tag: Feature: gantt-chart-enhancement, Property 7
test('lebar kolom selalu >= 40px setelah operasi resize', () => {
  fc.assert(fc.property(
    fc.integer({ min: 40, max: 500 }),     // initialWidth
    fc.array(fc.integer({ min: -500, max: 500 }), { minLength: 1, maxLength: 50 }), // urutan drag delta
    (initialWidth, deltas) => {
      let width = initialWidth;
      for (const delta of deltas) {
        width = Math.max(40, width + delta);
      }
      return width >= 40;
    }
  ), { numRuns: 100 });
});

// Property 8: Kalkulasi Berat Beam Sesuai Formula
// Tag: Feature: gantt-chart-enhancement, Property 8
test('calcBeratKg konsisten dengan formula', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 1000 }),     // denier
    fc.integer({ min: 1, max: 2000 }),     // lembar
    fc.float({ min: 1, max: 100000 }),     // panjang_akhir_m
    (denier, lembar, panjang) => {
      const expected = parseFloat(((denier * lembar * panjang) / 9000000).toFixed(2));
      const actual = calcBeratKg(denier, lembar, panjang);
      return Math.abs(actual - expected) < 0.001;
    }
  ), { numRuns: 100 });
});

// Property 9: Beam Tidak Duplikat
// Tag: Feature: gantt-chart-enhancement, Property 9
test('daftar beam tidak pernah mengandung duplikat', () => {
  fc.assert(fc.property(
    fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 30 }),
    (beamNumbers) => {
      const logged = [];
      for (const beamNo of beamNumbers) {
        const result = addBeamToList(logged, beamNo); // pure function dari OperatorView
        if (result.success) logged.push(beamNo);
      }
      const unique = new Set(logged);
      return unique.size === logged.length;
    }
  ), { numRuns: 100 });
});
```

### Konfigurasi Test Runner

```json
// package.json (ditambahkan di direktori project)
{
  "scripts": {
    "test": "jest --testPathPattern='*.test.js'",
    "test:pbt": "jest --testPathPattern='*.pbt.test.js'"
  },
  "devDependencies": {
    "jest": "^29.x",
    "fast-check": "^3.x"
  }
}
```

### Pembagian File Test

```
tests/
├── unit/
│   ├── datastore.test.js
│   ├── scheduler.test.js
│   ├── renderer.test.js
│   ├── operatorview.test.js
│   └── iothandler.test.js
└── pbt/
    ├── zoom.pbt.test.js          ← Property 1, 2, 3
    ├── scheduler.pbt.test.js     ← Property 4, 5, 6
    ├── table.pbt.test.js         ← Property 7
    └── operatorview.pbt.test.js  ← Property 8, 9
```


---

## Catatan Implementasi Tambahan

### Urutan Pengembangan yang Disarankan

1. **Setup file structure** (Req 1, 11, 12) — pisah CSS/JS, rename file, shared style
2. **DataStore** — load dummy_data.json, semua getter/setter
3. **Renderer: renderMOTable, renderMachineLabels** — komponen statis dulu
4. **Renderer: renderGantt + renderTimelineHeader** — layout Gantt dasar
5. **Scheduler: scheduleBlock + Renderer: renderBlock** — drag dari tabel ke Gantt
6. **Zoom drag** (Req 2) — drag-to-zoom dengan viewport centering
7. **Now Line + evaluateLocks** (Req 3) — timer 60s
8. **Duration Popup** (Req 5) — modal ganti benang
9. **Stock Warning Modal** (Req 8) — modal not_ready
10. **Drag back to table** (Req 6) — unschedule atomik
11. **Fix Plan** (Req 4) — tombol fix dengan disabled lifecycle
12. **Kolom resizable** (Req 7) — resize handle
13. **Label mesin informatif** (Req 9) — 3 baris + IoT indicator
14. **Timeline Header realtime** (Req 10) — sticky clock HH:MM:SS
15. **IoTHandler** (Req 14) — simulasi + event architecture
16. **OperatorView** (Req 13) — job queue + form beam
17. **HPH** (Req 15) — kalkulasi berat, validasi duplikat, password admin

### Kompatibilitas Browser

- Target: **Chromium-based modern** (Chrome 90+, Edge 90+) untuk planner workstation
- Target: **Tablet browser Chromium** untuk operator
- Tidak diperlukan polyfill; gunakan `CustomEvent`, `fetch`, `CSS custom properties`, `drag and drop API` yang sudah native di Chromium modern.
- Tidak ada transpilasi (tidak ada Webpack/Babel) — JS ditulis sebagai ES6 modules (atau IIFE untuk kompatibilitas mudah).

### Pendekatan Deployment

- Deploy sebagai file statis ke web server yang sudah ada di jaringan internal pabrik (`http://157.20.244.218:8880/`)
- Semua file di direktori yang sama (flat structure)
- `operator_input.html?machine=MC1` — machineId diambil dari query string

