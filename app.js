/* app.js — Shared script for PPC Warping MES Workstation
   Modular IIFE architecture: DataStore, Scheduler, Renderer, OperatorView, IoTHandler
   Entry point determined by document.body.dataset.page ('planner' | 'operator')
*/
(function () {
  'use strict';

  // ============================================================
  // UTILS: Pure pixel / time calculation functions (Task 4.1)
  // ============================================================

  /**
   * Convert a Unix-ms timestamp to a horizontal pixel position.
   * @param {number} timestampMs - Unix ms of the time to position
   * @param {number} originMs    - Unix ms of the left edge of the Gantt viewport
   * @param {number} zoomPx      - pixels per hour (zoom level)
   * @returns {number} pixel offset from the left edge
   */
  function timeToPixel(timestampMs, originMs, zoomPx) {
    var diffHours = (timestampMs - originMs) / 3600000;
    return diffHours * zoomPx;
  }

  /**
   * Convert a horizontal pixel position back to a Unix-ms timestamp.
   * @param {number} px       - pixel offset from the left edge of the Gantt viewport
   * @param {number} originMs - Unix ms of the left edge
   * @param {number} zoomPx   - pixels per hour
   * @returns {number} Unix ms timestamp
   */
  function pixelToTime(px, originMs, zoomPx) {
    var diffHours = px / zoomPx;
    return originMs + diffHours * 3600000;
  }

  /**
   * Convert a duration in milliseconds to a pixel width.
   * @param {number} durationMs - duration in milliseconds
   * @param {number} zoomPx     - pixels per hour
   * @returns {number} width in pixels
   */
  function durationToWidth(durationMs, zoomPx) {
    return (durationMs / 3600000) * zoomPx;
  }

  // ============================================================
  // MODULE: DataStore
  // ============================================================
  const DataStore = (() => {
    // Internal state — populated by load()
    let _data = null;

    // ---- Legacy config used by Scheduler/Renderer before load() completes ----
    // These are the old hard-coded values kept for backward compat with existing
    // Scheduler / Renderer code that calls getConfig() synchronously at module init.
    const _legacyConfig = {
      totalDays: 30,
      todayIndex: 15,
      baseDate: new Date(2026, 6, 1),
      hourWidth: 120,
      slotWidth: 20,
      colMachineWidth: 180,
      adminPassword: 'admin123',
    };

    // ---- Task 2.1: load(url) ----
    async function load(url) {
      url = url || './dummy_data.json';
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' ' + response.statusText);
        }
        _data = await response.json();
        return _data;
      } catch (err) {
        console.error('[DataStore] Failed to load:', err);
        // Renderer may not be defined yet at this point in very early failures,
        // so guard with typeof check
        if (typeof Renderer !== 'undefined' && Renderer.showNotification) {
          Renderer.showNotification('Gagal memuat data. Periksa koneksi.', 'error');
        }
        throw err;
      }
    }

    // ---- Task 2.2: Getters (all return deep copies) ----

    function getMachines() {
      if (!_data || !_data.machines) return [];
      return JSON.parse(JSON.stringify(_data.machines));
    }

    function getMachineById(id) {
      if (!_data || !_data.machines) return null;
      const m = _data.machines.find(function(x) { return x.id === id; });
      return m ? JSON.parse(JSON.stringify(m)) : null;
    }

    function getMOs() {
      if (!_data || !_data.manufacturing_orders) return [];
      return JSON.parse(JSON.stringify(_data.manufacturing_orders));
    }

    function getMOById(moId) {
      if (!_data || !_data.manufacturing_orders) return null;
      const mo = _data.manufacturing_orders.find(function(x) { return x.mo_id === moId; });
      return mo ? JSON.parse(JSON.stringify(mo)) : null;
    }

    function getGanttBlocks() {
      if (!_data || !_data.gantt_schedule || !_data.gantt_schedule.scheduled_blocks) return [];
      return JSON.parse(JSON.stringify(_data.gantt_schedule.scheduled_blocks));
    }

    function getGanttBlockById(blockId) {
      if (!_data || !_data.gantt_schedule || !_data.gantt_schedule.scheduled_blocks) return null;
      const b = _data.gantt_schedule.scheduled_blocks.find(function(x) { return x.block_id === blockId; });
      return b ? JSON.parse(JSON.stringify(b)) : null;
    }

    function getConfig() {
      if (!_data || !_data.app_config) return Object.assign({}, _legacyConfig);
      // Merge legacy layout props (hourWidth, slotWidth, etc.) with app_config from JSON
      return Object.assign({}, _legacyConfig, JSON.parse(JSON.stringify(_data.app_config)));
    }

    function getUsers() {
      if (!_data || !_data.users) return [];
      return JSON.parse(JSON.stringify(_data.users));
    }

    function getShifts() {
      if (!_data || !_data.shifts) return [];
      return JSON.parse(JSON.stringify(_data.shifts));
    }

    function getBeamDatabase() {
      if (!_data || !_data.beam_database) return {};
      // beam_database has a _comment key — exclude it
      const db = JSON.parse(JSON.stringify(_data.beam_database));
      delete db._comment;
      return db;
    }

    function getHPHRecords() {
      if (!_data || !_data.hph_records) return [];
      // hph_records is an object keyed by HPH id — convert to array
      const records = JSON.parse(JSON.stringify(_data.hph_records));
      delete records._comment;
      return Object.values(records);
    }

    function getYarnTypes() {
      if (!_data || !_data.yarn_types) return [];
      return JSON.parse(JSON.stringify(_data.yarn_types));
    }

    // ---- Task 2.3: Mutations (operate on in-memory _data) ----

    function updateGanttBlock(blockId, changes) {
      if (!_data || !_data.gantt_schedule || !_data.gantt_schedule.scheduled_blocks) return;
      const block = _data.gantt_schedule.scheduled_blocks.find(function(x) { return x.block_id === blockId; });
      if (block) Object.assign(block, changes);
    }

    function addGanttBlock(block) {
      if (!_data) return;
      if (!_data.gantt_schedule) _data.gantt_schedule = { scheduled_blocks: [] };
      if (!_data.gantt_schedule.scheduled_blocks) _data.gantt_schedule.scheduled_blocks = [];
      _data.gantt_schedule.scheduled_blocks.push(block);
    }

    function removeGanttBlock(blockId) {
      if (!_data || !_data.gantt_schedule || !_data.gantt_schedule.scheduled_blocks) return;
      _data.gantt_schedule.scheduled_blocks = _data.gantt_schedule.scheduled_blocks.filter(
        function(x) { return x.block_id !== blockId; }
      );
    }

    function updateMOStatus(moId, changes) {
      if (!_data || !_data.manufacturing_orders) return;
      const mo = _data.manufacturing_orders.find(function(x) { return x.mo_id === moId; });
      if (mo) Object.assign(mo, changes);
    }

    function updateMachineIoT(machineId, status) {
      if (!_data || !_data.machines) return;
      const machine = _data.machines.find(function(x) { return x.id === machineId; });
      if (machine) machine.iot_status = status;
    }

    // ---- Backward-compat shims for existing code that uses old API ----
    // The old code used getMachines() returning objects with {id,name,label,speed}
    // and getMachineByLabel(label). We keep getMachineByLabel as a convenience alias.
    function getMachineByLabel(label) {
      if (!_data || !_data.machines) return null;
      const m = _data.machines.find(function(x) { return x.name === label || x.id === label; });
      return m ? JSON.parse(JSON.stringify(m)) : null;
    }

    return {
      load,
      // Getters
      getMachines, getMachineById, getMachineByLabel,
      getMOs, getMOById,
      getGanttBlocks, getGanttBlockById,
      getConfig,
      getUsers, getShifts,
      getBeamDatabase,
      getHPHRecords,
      getYarnTypes,
      // Mutations
      updateGanttBlock, addGanttBlock, removeGanttBlock,
      updateMOStatus,
      updateMachineIoT,
    };
  })();

  // ============================================================
  // MODULE: Scheduler
  // ============================================================
  const Scheduler = (() => {
    const CONFIG = DataStore.getConfig();

    // Task 5.1 — private state
    let _blocks    = [];
    let _zoomLevel = 80; // default px/hour

    // Task 5.1 — init(blocks, config)
    function init(blocks, config) {
      _blocks    = blocks ? blocks.slice() : [];
      _zoomLevel = (config && config.gantt_zoom_default_px_per_hour) || 80;
    }

    // Task 5.1 — zoom helpers
    function setZoomLevel(px) {
      _zoomLevel = Math.min(300, Math.max(30, px));
    }

    function getZoomLevel() {
      return _zoomLevel;
    }

    function calculateDuration(length, speed, beams) {
      if (!speed || speed === 0) return 0;
      const baseTime = length / (speed * 0.7);
      return Math.ceil((baseTime + 15) * beams);
    }

    function getDurationForMO(moId, machineLabel) {
      const mo = DataStore.getMOById(moId);
      if (!mo) return 0;
      const machine = DataStore.getMachineByLabel(machineLabel);
      if (!machine) return 0;
      return calculateDuration(mo.length, machine.speed, mo.beams);
    }

    function dateToOffset(date) {
      const base = new Date(CONFIG.baseDate);
      base.setDate(base.getDate() - CONFIG.todayIndex);
      const diffMs = date - base;
      const diffMin = diffMs / (1000 * 60);
      return diffMin * (CONFIG.hourWidth / 60);
    }

    function formatTime(totalMinutes) {
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = Math.round(totalMinutes % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // Task 5.2 — checkOverlap(machineId, start, end, excludeBlockId)
    // Returns { hasOverlap: boolean, conflictingBlock: block|null }
    function checkOverlap(machineId, start, end, excludeBlockId) {
      const startMs = new Date(start).getTime();
      const endMs   = new Date(end).getTime();
      for (const block of _blocks) {
        if (block.machine_id !== machineId) continue;
        if (excludeBlockId && block.block_id === excludeBlockId) continue;
        const bStart = new Date(block.planned_start).getTime();
        const bEnd   = new Date(block.planned_end).getTime();
        if (startMs < bEnd && endMs > bStart) {
          return { hasOverlap: true, conflictingBlock: block };
        }
      }
      return { hasOverlap: false, conflictingBlock: null };
    }

    return {
      init, setZoomLevel, getZoomLevel,
      calculateDuration, getDurationForMO, dateToOffset, formatTime,
      checkOverlap
    };
  })();


  // ============================================================
  // MODULE: Renderer  (Planner UI logic)
  // ============================================================
  const Renderer = (() => {
    // Task 3.1 — cached DOM references (populated by init())
    let _ganttEl, _timelineHeaderEl, _nowLineEl, _machineLabelColEl;

    const CONFIG = DataStore.getConfig();
    const totalHours = CONFIG.totalDays * 24;
    const totalWidthPx = totalHours * CONFIG.hourWidth;

    // Task 3.1 — init(domRefs)
    function init(domRefs) {
      domRefs = domRefs || {};
      _ganttEl           = domRefs.ganttEl           || document.getElementById('ganttBody');
      _timelineHeaderEl  = domRefs.timelineHeaderEl  || document.getElementById('timeHeaderTrack');
      _nowLineEl         = domRefs.nowLineEl          || document.getElementById('nowLine');
      _machineLabelColEl = domRefs.machineLabelColEl  || document.getElementById('machineLabelCol');
    }

    // ---- Timeline Header (Task 4.2) ----
    // renderTimelineHeader(startMs, endMs, zoomPx)
    //   startMs / endMs : Unix-ms timestamps for the visible range
    //   zoomPx          : pixels per hour
    // If called with no arguments, falls back to the CONFIG-based legacy rendering.
    function renderTimelineHeader(startMs, endMs, zoomPx) {
      var container = _timelineHeaderEl || document.getElementById('timeHeaderTrack');
      if (!container) return;
      container.innerHTML = '';

      // ---- Ensure sticky-corner has a stickyClockDisplay element ----
      var stickyCorner = document.querySelector('.sticky-corner');
      if (stickyCorner && !document.getElementById('stickyClockDisplay')) {
        var clockEl = document.createElement('div');
        clockEl.id = 'stickyClockDisplay';
        clockEl.style.cssText = 'font-size:1.1em;font-weight:bold;font-family:monospace;padding:4px 8px;';
        stickyCorner.appendChild(clockEl);
      }

      // ---- New API: startMs/endMs/zoomPx provided ----
      if (typeof startMs === 'number' && typeof endMs === 'number' && typeof zoomPx === 'number') {
        var dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        var months   = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        var todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        var todayMs = todayMidnight.getTime();

        // Walk day by day through the range
        var cursor = new Date(startMs);
        cursor.setHours(0, 0, 0, 0);  // snap to midnight of the start day

        while (cursor.getTime() < endMs) {
          var dayStartMs = cursor.getTime();
          var dayEndMs   = dayStartMs + 86400000; // +24 h

          // Only render hours that fall within [startMs, endMs]
          var rangeStart = Math.max(dayStartMs, startMs);
          var rangeEnd   = Math.min(dayEndMs, endMs);
          var hoursInRange = Math.ceil((rangeEnd - rangeStart) / 3600000);
          if (hoursInRange <= 0) { cursor = new Date(dayEndMs); continue; }

          var dayGroup = document.createElement('div');
          dayGroup.className = 'day-header-group';
          dayGroup.style.width = (hoursInRange * zoomPx) + 'px';

          var title = document.createElement('div');
          var dayStr = dayNames[cursor.getDay()] + ', ' + cursor.getDate() + ' ' + months[cursor.getMonth()];
          if (dayStartMs === todayMs) {
            title.className = 'day-title today-title';
            title.innerText = '🎯 HARI INI (' + dayStr + ')';
          } else if (dayStartMs < todayMs) {
            title.className = 'day-title';
            title.innerText = '⏪ ' + dayStr;
          } else {
            title.className = 'day-title';
            title.innerText = '⏩ ' + dayStr;
          }
          dayGroup.appendChild(title);

          var hoursRow = document.createElement('div');
          hoursRow.className = 'hours-row';
          var startHour = new Date(rangeStart).getHours();
          for (var h = 0; h < hoursInRange; h++) {
            var slot = document.createElement('div');
            slot.className = 'hour-slot';
            slot.style.width = zoomPx + 'px';
            slot.innerText = String((startHour + h) % 24).padStart(2, '0') + ':00';
            hoursRow.appendChild(slot);
          }
          dayGroup.appendChild(hoursRow);
          container.appendChild(dayGroup);

          cursor = new Date(dayEndMs);
        }
        return;
      }

      // ---- Legacy fallback: CONFIG-based rendering (no args) ----
      var legacyConfig = CONFIG;
      var totalDays = legacyConfig.totalDays;
      var todayIndex = legacyConfig.todayIndex;
      var baseDate   = legacyConfig.baseDate;
      var hourWidth  = legacyConfig.hourWidth;
      var dayNamesL  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      var monthsL    = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

      for (var d = 0; d < totalDays; d++) {
        var date = new Date(baseDate);
        date.setDate(baseDate.getDate() - (todayIndex - d));
        var dayGroup2 = document.createElement('div');
        dayGroup2.className = 'day-header-group';
        dayGroup2.style.width = (24 * hourWidth) + 'px';

        var title2 = document.createElement('div');
        title2.className = 'day-title';
        var dayStr2 = dayNamesL[date.getDay()] + ', ' + date.getDate() + ' ' + monthsL[date.getMonth()];
        if (d === todayIndex) {
          title2.classList.add('today-title');
          title2.innerText = '🎯 HARI INI (' + dayStr2 + ')';
        } else if (d < todayIndex) {
          title2.innerText = '⏪ ' + dayStr2 + ' (-' + (todayIndex - d) + ' Hari)';
        } else {
          title2.innerText = '⏩ ' + dayStr2 + ' (+' + (d - todayIndex) + ' Hari)';
        }
        dayGroup2.appendChild(title2);

        var hoursRow2 = document.createElement('div');
        hoursRow2.className = 'hours-row';
        for (var hh = 0; hh < 24; hh++) {
          var slot2 = document.createElement('div');
          slot2.className = 'hour-slot';
          slot2.innerText = String(hh).padStart(2, '0') + ':00';
          hoursRow2.appendChild(slot2);
        }
        dayGroup2.appendChild(hoursRow2);
        container.appendChild(dayGroup2);
      }
    }

    // ---- Gantt Machine Labels ----
    function getActiveBlockOnMachine(machineLabel) {
      const track = document.querySelector(`.drop-track[data-machine="${machineLabel}"]`);
      if (!track) return null;
      const blocks = track.querySelectorAll('.gantt-block');
      for (let b of blocks) {
        if (b.classList.contains('status-running') ||
            b.classList.contains('status-trouble') ||
            b.classList.contains('status-setup')) {
          return b;
        }
      }
      return null;
    }

    // Task 3.3 — renderMachineLabels(machines)
    // Renders the machine label column (left sidebar) on the Gantt chart.
    // Each label shows: IoT dot, machine name (bold), active yarn+lot (orange), active MO# (blue).
    // Machines are sorted A-Z by name.
    function renderMachineLabels(machines) {
      var container = _machineLabelColEl || document.getElementById('machineLabelCol');

      // Sort A-Z by name
      var sorted = (machines ? machines.slice() : DataStore.getMachines()).sort(function(a, b) {
        var nameA = (a.name || a.id || '').toUpperCase();
        var nameB = (b.name || b.id || '').toUpperCase();
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      });

      // If a dedicated label column element exists, render into it;
      // otherwise update labels inside the existing .machine-row elements.
      if (container) {
        container.innerHTML = '';
        sorted.forEach(function(machine) {
          var el = _buildMachineLabelEl(machine);
          container.appendChild(el);
        });
      } else {
        // Fallback: update/replace .machine-label inside each .machine-row
        sorted.forEach(function(machine) {
          var machineKey = machine.label || machine.name || machine.id;
          var row = document.querySelector('.machine-row[data-machine="' + machineKey + '"]');
          if (!row) return;
          var old = row.querySelector('.machine-label');
          var el  = _buildMachineLabelEl(machine);
          if (old) { row.replaceChild(el, old); } else { row.insertBefore(el, row.firstChild); }
        });
      }
    }

    // Helper: build a single .machine-label DOM element for a machine object.
    function _buildMachineLabelEl(machine) {
      var machineId  = machine.id   || machine.name || '';
      var machineName = machine.name || machine.id  || '';
      var iotStatus  = machine.iot_status || '';
      var activeMO   = machine.active_mo_id || null;
      var activeYarn = machine.active_yarn  || null;

      // IoT dot color
      var dotColor;
      if (iotStatus === 'running')      { dotColor = '#22c55e'; }
      else if (iotStatus === 'rusak')   { dotColor = '#ef4444'; }
      else                              { dotColor = '#64748b'; }

      // Yarn / lot text
      var yarnText, moText;
      if (activeMO && activeYarn) {
        var jenis = activeYarn.jenis || activeYarn;
        var lot   = activeYarn.lot   || '';
        yarnText  = lot ? (jenis + ' | ' + lot) : jenis;
        moText    = activeMO;
      } else {
        yarnText = '⏸️ Idle';
        moText   = '';
      }

      var el = document.createElement('div');
      el.className = 'machine-label';
      el.dataset.machineId = machineId;

      var dot = document.createElement('div');
      dot.className = 'iot-indicator ico-dot';
      dot.style.cssText = 'background:' + dotColor + ';width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-right:6px;align-self:center;';

      var info = document.createElement('div');
      info.className = 'machine-info';

      var nameDiv = document.createElement('div');
      nameDiv.className = 'machine-name';
      nameDiv.style.fontWeight = 'bold';
      nameDiv.textContent = machineName;

      var yarnDiv = document.createElement('div');
      yarnDiv.className = 'machine-yarn text-sm';
      yarnDiv.style.cssText = 'color:#f97316;font-size:0.75em;';
      yarnDiv.textContent = yarnText;

      var moDiv = document.createElement('div');
      moDiv.className = 'machine-mo text-sm';
      moDiv.style.cssText = 'color:#38bdf8;font-size:0.75em;';
      moDiv.textContent = moText;

      info.appendChild(nameDiv);
      info.appendChild(yarnDiv);
      info.appendChild(moDiv);

      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.appendChild(dot);
      el.appendChild(info);

      return el;
    }

    // Task 3.4 — updateMachineLabel(machineId, iotStatus, activeMO)
    // Performs a surgical DOM update on a single machine label — no full re-render.
    // activeMO: { mo_id, yarn_label, lot } object, or null if idle.
    function updateMachineLabel(machineId, iotStatus, activeMO) {
      try {
        var el = document.querySelector('.machine-label[data-machine-id="' + machineId + '"]');
        if (!el) return;

        // Update IoT dot color
        var dot = el.querySelector('.iot-indicator');
        if (dot) {
          var dotColor;
          if (iotStatus === 'running')    { dotColor = '#22c55e'; }
          else if (iotStatus === 'rusak') { dotColor = '#ef4444'; }
          else                            { dotColor = '#64748b'; }
          dot.style.background = dotColor;
        }

        // Update yarn text
        var yarnEl = el.querySelector('.machine-yarn');
        if (yarnEl) {
          if (activeMO) {
            var jenis = (activeMO.active_yarn && activeMO.active_yarn.jenis) || activeMO.yarn_label || '';
            var lot   = (activeMO.active_yarn && activeMO.active_yarn.lot)   || activeMO.lot        || '';
            yarnEl.textContent = lot ? (jenis + ' | ' + lot) : jenis;
          } else {
            yarnEl.textContent = '⏸️ Idle';
          }
        }

        // Update MO number text
        var moEl = el.querySelector('.machine-mo');
        if (moEl) {
          moEl.textContent = activeMO ? (activeMO.mo_id || activeMO.active_mo_id || '') : '';
        }
      } catch (err) {
        console.error('[Renderer.updateMachineLabel] Error updating label for', machineId, err);
        location.reload();
      }
    }

    // Backward-compat alias: updateMachineLabels() → renderMachineLabels()
    function updateMachineLabels() {
      renderMachineLabels(DataStore.getMachines());
    }


    // ---- Render Gantt ----
    function renderGantt() {
      const body = document.getElementById('ganttBody');
      if (!body) return;
      body.innerHTML = '';
      const machines = DataStore.getMachines();
      const moDataList = DataStore.getMOs();

      machines.forEach(machine => {
        // Support both new JSON format (id/name) and old format (id/name/label)
        const machineKey = machine.label || machine.name || machine.id;

        const row = document.createElement('div');
        row.className = 'machine-row';
        row.dataset.machine = machineKey;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'machine-label';
        labelDiv.innerHTML = `<div class="machine-name">${machine.name}</div>`;
        row.appendChild(labelDiv);

        const trackArea = document.createElement('div');
        trackArea.className = 'timeline-track-area';

        const grid = document.createElement('div');
        grid.className = 'timeline-grid';
        grid.style.width = `${totalWidthPx}px`;
        for (let h = 0; h < totalHours; h++) {
          const hourDiv = document.createElement('div');
          hourDiv.className = 'grid-hour';
          for (let m = 0; m < 6; m++) {
            const minDiv = document.createElement('div');
            minDiv.className = 'grid-10min';
            hourDiv.appendChild(minDiv);
          }
          grid.appendChild(hourDiv);
        }
        trackArea.appendChild(grid);

        const dropTrack = document.createElement('div');
        dropTrack.className = 'drop-track';
        dropTrack.dataset.machine = machineKey;
        dropTrack.style.width = `${totalWidthPx}px`;
        trackArea.appendChild(dropTrack);

        row.appendChild(trackArea);
        body.appendChild(row);
      });

      // Place initial demo blocks — only for old data format (legacy)
      // New JSON format places blocks from gantt_schedule via Scheduler.init()
      const isLegacyData = moDataList.length > 0 && moDataList[0].mo && !moDataList[0].mo_id;
      if (isLegacyData) {
        const now = new Date(CONFIG.baseDate);
        const moRunning = moDataList.find(m => m.stockReady && m.mc === 'MC7');
        const moTrouble = moDataList.find(m => m.stockReady && m.mc === 'MC1');
        const moSetup   = moDataList.find(m => m.stockReady && m.mc === 'MC3');

        const initialBlocks = [];
        if (moRunning) {
          const machine = machines.find(m => (m.label || m.name) === moRunning.mc);
          if (machine) {
            initialBlocks.push({ machineKey: machine.label || machine.name, moId: moRunning.id,
              startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0),
              status: 'running', locked: true });
            moRunning.status = 'Running';
            moRunning.stock  = `⏳ Running (${machine.label || machine.name})`;
          }
        }
        if (moTrouble) {
          const machine = machines.find(m => (m.label || m.name) === moTrouble.mc);
          if (machine) {
            initialBlocks.push({ machineKey: machine.label || machine.name, moId: moTrouble.id,
              startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30),
              status: 'trouble', locked: false });
            moTrouble.status = 'Trouble';
            moTrouble.stock  = `🔴 Trouble (${machine.label || machine.name})`;
          }
        }
        if (moSetup) {
          const machine = machines.find(m => (m.label || m.name) === moSetup.mc);
          if (machine) {
            initialBlocks.push({ machineKey: machine.label || machine.name, moId: moSetup.id,
              startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0),
              status: 'setup', locked: false });
            moSetup.status = 'Setup';
            moSetup.stock  = `🔵 Setup (${machine.label || machine.name})`;
          }
        }

        initialBlocks.forEach(block => {
          const mo = DataStore.getMOById(block.moId);
          if (!mo) return;
          const track = document.querySelector(`.drop-track[data-machine="${block.machineKey}"]`);
          if (!track) return;
          const leftPx = Scheduler.dateToOffset(block.startDate);
          const duration = Scheduler.getDurationForMO(mo.id, block.machineKey);
          createGanttBlock(track, mo, leftPx, duration, block.status, block.locked);
        });
      }

      updateMachineLabels();
    }


    // ---- Create Gantt Block ----
    function createGanttBlock(track, moData, leftPx, durationMinutes, statusClass, locked) {
      const block = document.createElement('div');
      block.className = `gantt-block status-${statusClass}`;
      block.id = `block-${moData.id}-${Date.now()}`;
      block.setAttribute('data-id', moData.id);
      block.setAttribute('data-mo', moData.mo);
      block.setAttribute('data-sc', moData.sc);
      block.setAttribute('data-yarn', moData.yarn);
      block.setAttribute('data-lot', moData.mc || '-');
      block.setAttribute('data-ends', moData.ends);
      block.setAttribute('data-duration', durationMinutes);
      block.style.left = `${leftPx}px`;
      block.style.width = `${durationMinutes * (CONFIG.hourWidth / 60)}px`;
      block.setAttribute('draggable', locked ? 'false' : 'true');

      const startMin = (leftPx / CONFIG.hourWidth) * 60;
      const endMin   = startMin + durationMinutes;
      const startStr = Scheduler.formatTime(startMin);
      const endStr   = Scheduler.formatTime(endMin);

      let statusLabel = '';
      if (statusClass === 'running') statusLabel = '🟢 RUNNING 🔒';
      else if (statusClass === 'trouble') statusLabel = '🔴 TROUBLE';
      else if (statusClass === 'setup')   statusLabel = '🔵 SETUP';
      else                                statusLabel = '🟡 SCHEDULED';

      block.innerHTML = `
        <div class="block-header">
          <span>${moData.mo} • ${moData.sc}</span>
          <span>${statusLabel}</span>
        </div>
        <div class="block-sub">${moData.ends} Ends | ⏱️ ${startStr} - ${endStr} WIB (${durationMinutes} mnt)</div>
      `;
      track.appendChild(block);
      return block;
    }

    // ---- Render MO Table ----
    function renderTable() {
      const searchEl = document.getElementById('searchInput');
      const statusEl = document.getElementById('statusFilter');
      if (!searchEl || !statusEl) return;
      const searchVal = searchEl.value.toLowerCase();
      const statusVal = statusEl.value;
      const tbody = document.getElementById('moTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      DataStore.getMOs().forEach(item => {
        const matchSearch = item.mo.toLowerCase().includes(searchVal) ||
                            item.sc.toLowerCase().includes(searchVal) ||
                            item.yarn.toLowerCase().includes(searchVal);
        let matchStatus = true;
        if (statusVal === 'NOT_SCHEDULED') {
          if (!['Ready','Waiting','Shortage'].includes(item.status)) matchStatus = false;
        } else if (statusVal !== 'ALL') {
          if (item.status !== statusVal) matchStatus = false;
        }
        if (!matchSearch || !matchStatus) return;

        const tr = document.createElement('tr');
        tr.id = `row-${item.id}`;
        tr.dataset.id = item.id;

        const isDraggable = ['Ready','Waiting','Shortage'].includes(item.status);
        if (isDraggable && item.stockReady) {
          tr.classList.add('draggable-row');
          tr.setAttribute('draggable', 'true');
        } else {
          tr.style.opacity = '0.5';
        }

        const badgeMap = {
          'Ready':     `<span class="badge badge-ready">🟢 Ready</span>`,
          'Scheduled': `<span class="badge badge-scheduled">✔ Scheduled</span>`,
          'Running':   `<span class="badge badge-running">⚙️ Running 🔒</span>`,
          'Trouble':   `<span class="badge badge-trouble">🔴 Trouble</span>`,
          'Setup':     `<span class="badge badge-scheduled" style="background:#1e3a8a;color:#fff;">🔵 Setup</span>`,
          'Waiting':   `<span class="badge badge-waiting">🟡 Waiting</span>`,
          'Shortage':  `<span class="badge badge-shortage">🔴 Shortage</span>`,
        };
        const stockBadge = item.stockReady
          ? '<span class="badge badge-ready">🟢 Ready</span>'
          : '<span class="badge badge-notready">🔴 Not Ready</span>';

        tr.innerHTML = `
          <td>${item.no}</td>
          <td><strong>${item.mo}</strong></td>
          <td>${item.mc}</td>
          <td>🧵 ${item.yarn}</td>
          <td>${item.sc}</td>
          <td>${item.gb}</td>
          <td>${item.jmlBeam}</td>
          <td>${item.lembar}</td>
          <td>${item.displayPanjangBeam}</td>
          <td>${item.displayTarget}</td>
          <td>${stockBadge}</td>
          <td>${badgeMap[item.status] || badgeMap['Ready']}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // ---- Task 3.2: renderMOTable(mos) ----
    // Renders MO backlog table in #moTableBody.
    // Columns: No MO, Knitting MC, Benang, Lot, Target Beam, GB, Status Stok, Status MO
    // Also aliased as renderTable() for backward compat.
    function renderMOTable(mos) {
      const tbody = document.getElementById('moTableBody');
      if (!tbody) return;

      // If mos not passed, fall back to full list (backward compat)
      var moList;
      if (mos) {
        moList = mos;
      } else {
        // Legacy fallback: apply search/filter from DOM controls
        const searchEl = document.getElementById('searchInput');
        const statusEl = document.getElementById('statusFilter');
        const searchVal = searchEl ? searchEl.value.toLowerCase() : '';
        const statusVal = statusEl ? statusEl.value : 'ALL';

        // Try new JSON-based getMOs() first, fall back to legacy list
        var allMOs = DataStore.getMOs();
        if (allMOs.length && allMOs[0].mo_id) {
          // New JSON format
          moList = allMOs.filter(function(item) {
            var matchSearch = !searchVal ||
              (item.mo_id && item.mo_id.toLowerCase().includes(searchVal)) ||
              (item.yarn_label && item.yarn_label.toLowerCase().includes(searchVal)) ||
              (item.knitting_mc && item.knitting_mc.toLowerCase().includes(searchVal));
            var matchStatus = true;
            if (statusVal === 'NOT_SCHEDULED') {
              matchStatus = item.gantt_status === 'unscheduled';
            } else if (statusVal !== 'ALL') {
              matchStatus = (item.mo_status === statusVal || item.gantt_status === statusVal);
            }
            return matchSearch && matchStatus;
          });
        } else {
          // Legacy format — delegate to old renderTable logic
          _renderLegacyTable();
          return;
        }
      }

      // Render rows from new JSON format
      tbody.innerHTML = '';
      moList.forEach(function(item, idx) {
        var isUnscheduled = item.gantt_status === 'unscheduled';
        var isNotReady    = item.stock_status === 'not_ready';

        var tr = document.createElement('tr');
        tr.dataset.moId = item.mo_id;

        if (isUnscheduled) {
          tr.setAttribute('draggable', 'true');
          tr.classList.add('draggable-row');
        }

        var stockBadge = isNotReady
          ? '<span class="badge badge-notready">⚠️ Not Ready</span>'
          : '<span class="badge badge-ready">🟢 Ready</span>';

        var statusBadge;
        if (item.gantt_status === 'fixed') {
          statusBadge = '<span class="badge badge-running">🔒 Fixed</span>';
        } else if (item.gantt_status === 'scheduled') {
          statusBadge = '<span class="badge badge-scheduled">✔ Scheduled</span>';
        } else if (item.mo_status === 'in_progress') {
          statusBadge = '<span class="badge badge-running">⚙️ Running</span>';
        } else if (item.mo_status === 'done') {
          statusBadge = '<span class="badge" style="background:#6b7280;color:#fff;">✅ Done</span>';
        } else {
          statusBadge = '<span class="badge badge-ready">🟢 Ready</span>';
        }

        // Columns: No, Nomor MO, MC (Knitting MC), Jenis Benang, Lot, Target Beam, GB, Status Stok, Status MO
        tr.innerHTML =
          '<td>' + (idx + 1) + '</td>' +
          '<td><strong>' + item.mo_id + '</strong></td>' +
          '<td>' + (item.knitting_mc || '-') + '</td>' +
          '<td>' + (isNotReady ? '⚠️ ' : '') + (item.yarn_label || '-') + '</td>' +
          '<td>' + (item.lot || '-') + '</td>' +
          '<td>' + (item.target_beam || '-') + '</td>' +
          '<td>' + (item.gb || '-') + '</td>' +
          '<td>' + stockBadge + '</td>' +
          '<td>' + statusBadge + '</td>';

        tbody.appendChild(tr);
      });
    }

    // Backward-compat alias
    function renderTable() {
      // If data is already in new JSON format, use renderMOTable with full list
      var allMOs = DataStore.getMOs();
      if (allMOs.length && allMOs[0].mo_id) {
        renderMOTable(null); // null → applies filter/search inside renderMOTable
      } else {
        _renderLegacyTable();
      }
    }

    // Legacy renderTable implementation (old hardcoded data format)
    function _renderLegacyTable() {
      const searchEl = document.getElementById('searchInput');
      const statusEl = document.getElementById('statusFilter');
      if (!searchEl || !statusEl) return;
      const searchVal = searchEl.value.toLowerCase();
      const statusVal = statusEl.value;
      const tbody = document.getElementById('moTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      DataStore.getMOs().forEach(item => {
        const matchSearch = item.mo.toLowerCase().includes(searchVal) ||
                            item.sc.toLowerCase().includes(searchVal) ||
                            item.yarn.toLowerCase().includes(searchVal);
        let matchStatus = true;
        if (statusVal === 'NOT_SCHEDULED') {
          if (!['Ready','Waiting','Shortage'].includes(item.status)) matchStatus = false;
        } else if (statusVal !== 'ALL') {
          if (item.status !== statusVal) matchStatus = false;
        }
        if (!matchSearch || !matchStatus) return;

        const tr = document.createElement('tr');
        tr.id = `row-${item.id}`;
        tr.dataset.id = item.id;

        const isDraggable = ['Ready','Waiting','Shortage'].includes(item.status);
        if (isDraggable && item.stockReady) {
          tr.classList.add('draggable-row');
          tr.setAttribute('draggable', 'true');
        } else {
          tr.style.opacity = '0.5';
        }

        const badgeMap = {
          'Ready':     `<span class="badge badge-ready">🟢 Ready</span>`,
          'Scheduled': `<span class="badge badge-scheduled">✔ Scheduled</span>`,
          'Running':   `<span class="badge badge-running">⚙️ Running 🔒</span>`,
          'Trouble':   `<span class="badge badge-trouble">🔴 Trouble</span>`,
          'Setup':     `<span class="badge badge-scheduled" style="background:#1e3a8a;color:#fff;">🔵 Setup</span>`,
          'Waiting':   `<span class="badge badge-waiting">🟡 Waiting</span>`,
          'Shortage':  `<span class="badge badge-shortage">🔴 Shortage</span>`,
        };
        const stockBadge = item.stockReady
          ? '<span class="badge badge-ready">🟢 Ready</span>'
          : '<span class="badge badge-notready">🔴 Not Ready</span>';

        tr.innerHTML = `
          <td>${item.no}</td>
          <td><strong>${item.mo}</strong></td>
          <td>${item.mc}</td>
          <td>🧵 ${item.yarn}</td>
          <td>${item.sc}</td>
          <td>${item.gb}</td>
          <td>${item.jmlBeam}</td>
          <td>${item.lembar}</td>
          <td>${item.displayPanjangBeam}</td>
          <td>${item.displayTarget}</td>
          <td>${stockBadge}</td>
          <td>${badgeMap[item.status] || badgeMap['Ready']}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // ---- Task 3.5: showNotification(msg, type) ----
    function showNotification(msg, type) {
      type = type || 'info';
      const el = document.createElement('div');
      el.className = 'notification notification-' + type;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(function() {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 4000);
    }

    return { init, renderTimelineHeader, renderGantt, renderTable, renderMOTable,
             createGanttBlock,
             renderMachineLabels, updateMachineLabel, updateMachineLabels,
             getActiveBlockOnMachine,
             showNotification };
  })();


  // ============================================================
  // MODULE: OperatorView  (Operator UI logic)
  // ============================================================
  const OperatorView = (() => {
    const ADMIN_PASS = DataStore.getConfig().adminPassword;
    let startTime  = null;
    let isStarted  = false;
    let usedBeams  = [];

    // ---- Helpers ----
    function getHeaderValue(id) {
      const el = document.getElementById(id);
      if (!el) return 0;
      const num = parseFloat(el.innerText.trim().replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    }

    function getPanjangTargetNumerik() {
      const span = document.getElementById('panjangTarget');
      if (!span) return 0;
      const cleaned = span.innerText.trim().replace(/\./g, '').replace(/[^0-9]/g, '');
      return parseFloat(cleaned) || 0;
    }

    function getTotalPanjangSelesai() {
      const tbody = document.querySelector('#beamTable tbody');
      if (!tbody) return 0;
      let total = 0;
      for (let row of tbody.rows) {
        const cell = row.cells[4];
        if (cell) {
          const val = parseFloat(cell.innerText);
          if (!isNaN(val)) total += val;
        }
      }
      return total;
    }

    function formatTime(date) {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return h + ':' + m;
    }

    function updateBeamList() {
      const datalist = document.getElementById('beamList');
      if (!datalist) return;
      datalist.innerHTML = '';
      const beamDatabase = DataStore.getBeamDatabase();
      Object.keys(beamDatabase).forEach(key => {
        if (!usedBeams.includes(key)) {
          const option = document.createElement('option');
          option.value = key;
          datalist.appendChild(option);
        }
      });
    }

    function updateEstimasiSisa() {
      const speedEl = document.getElementById('speed');
      if (!speedEl) return;
      const speed = parseFloat(speedEl.value) || 0;
      const estimasiEl = document.getElementById('estimasiValue');
      if (!estimasiEl) return;

      if (speed <= 0) { estimasiEl.textContent = '— (isi speed)'; return; }

      const targetBeam  = getHeaderValue('targetBeam');
      const panjangTarget = getPanjangTargetNumerik();
      const totalTarget = targetBeam * panjangTarget;
      const totalSelesai = getTotalPanjangSelesai();
      const sisa = Math.max(0, totalTarget - totalSelesai);

      if (sisa <= 0) { estimasiEl.textContent = '✅ Semua beam selesai!'; return; }

      const totalMinutes = sisa / speed;
      if (totalMinutes <= 0) { estimasiEl.textContent = '— (periksa input)'; return; }

      const hours   = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);
      let display = '';
      if (hours > 0) display += hours + ' jam ';
      display += minutes + ' menit';
      estimasiEl.textContent = `~ ${display} (sisa ${sisa.toFixed(0)} m)`;
    }

    function updateUI() {
      const beamNoEl = document.getElementById('beamNo');
      const uiValEl  = document.getElementById('uiValue');
      if (!beamNoEl || !uiValEl) return;
      const beamDatabase = DataStore.getBeamDatabase();
      uiValEl.value = beamDatabase[beamNoEl.value] || '';
    }

    function checkLimitAndUI() {
      const table     = document.getElementById('beamTable');
      const startBtn  = document.getElementById('startBtn');
      const formInput = document.getElementById('formInput');
      const addBtn    = document.getElementById('addBtn');
      const finishBtn = document.getElementById('finishBtn');
      if (!table || !startBtn || !formInput || !addBtn || !finishBtn) return;

      const tbody = table.getElementsByTagName('tbody')[0];
      const targetBeam   = getHeaderValue('targetBeam');
      const currentCount = tbody ? tbody.rows.length : 0;

      if (!isStarted) {
        startBtn.style.display  = 'block';
        formInput.style.display = 'none';
        addBtn.style.display    = 'none';
        finishBtn.style.display = 'none';
        return;
      }
      startBtn.style.display = 'none';
      if (currentCount >= targetBeam) {
        formInput.style.display = 'none';
        addBtn.style.display    = 'none';
        finishBtn.style.display = 'block';
      } else {
        formInput.style.display = 'grid';
        addBtn.style.display    = 'block';
        finishBtn.style.display = 'none';
      }
    }


    // ---- Public API ----
    function startTimer() {
      isStarted = true;
      startTime = new Date();
      const startBtn  = document.getElementById('startBtn');
      const formInput = document.getElementById('formInput');
      const addBtn    = document.getElementById('addBtn');
      if (startBtn)  startBtn.style.display  = 'none';
      if (formInput) formInput.style.display = 'grid';
      if (addBtn)    addBtn.style.display    = 'block';
    }

    function addBeam() {
      const beamDatabase = DataStore.getBeamDatabase();
      const beamVal     = (document.getElementById('beamNo')      || {}).value || '';
      const operatorName = ((document.getElementById('opName')    || {}).innerText || '').trim();
      const operatorShift = ((document.getElementById('opShift')  || {}).innerText || '').trim();
      const panjangAkhir = parseFloat((document.getElementById('panjangAkhir') || {}).value) || 0;
      const winding      = (document.getElementById('winding')    || {}).value || 0;
      const speed        = parseFloat((document.getElementById('speed') || {}).value) || 0;
      const ui           = (document.getElementById('uiValue')    || {}).value || '';
      const grade        = (document.getElementById('grade')      || {}).value || 'A';
      const ua           = (document.getElementById('ua')         || {}).value || '';
      const cacat        = (document.getElementById('cacat')      || {}).value || '';
      const amplasEl     = document.getElementById('amplas');
      const amplas       = amplasEl && amplasEl.checked ? '✔️' : '❌';

      if (!beamVal)          { alert('Mohon isi nomor Beam!'); return; }
      if (usedBeams.includes(beamVal)) { alert('Beam ini sudah digunakan!'); return; }
      if (panjangAkhir <= 0) { alert('Mohon isi Panjang Akhir dengan benar!'); return; }
      if (speed <= 0)        { alert('Mohon isi Speed!'); return; }

      const denier = getHeaderValue('denierValue');
      const lembar = getHeaderValue('lembarValue');
      let berat = 0;
      if (denier > 0 && lembar > 0 && panjangAkhir > 0) {
        berat = (denier * lembar * panjangAkhir) / 9000000;
      }
      const beratStr = berat.toFixed(2);

      const msg =
        `Konfirmasi data Beam:\n\n` +
        `Beam No.  : ${beamVal}\n` +
        `UI        : ${ui || '-'}\n` +
        `Speed     : ${speed}\n` +
        `Panjang   : ${panjangAkhir} m\n` +
        `Winding   : ${winding}\n` +
        `Grade     : ${grade}\n` +
        `UA        : ${ua || '-'}\n` +
        `Amplas    : ${amplas}\n` +
        `Cacat     : ${cacat || '-'}\n` +
        `Berat     : ${beratStr} kg\n\n` +
        `Apakah data sudah benar?`;

      if (!confirm(msg)) return;

      usedBeams.push(beamVal);
      updateBeamList();

      const now = new Date();
      const waktuSelesai = formatTime(now);
      const table = document.getElementById('beamTable');
      if (!table) return;
      const tbody = table.getElementsByTagName('tbody')[0];
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>${waktuSelesai}</td>
        <td>${beamVal}</td>
        <td>${ui}</td>
        <td>${speed}</td>
        <td>${panjangAkhir}</td>
        <td>${winding}</td>
        <td>${cacat}</td>
        <td>${grade}</td>
        <td>${ua}</td>
        <td>${beratStr}</td>
        <td>${amplas}</td>
        <td>${operatorName}</td>
        <td>${operatorShift}</td>
        <td class="action-cell"><button class="btn-hapus" onclick="App.OperatorView.requestDelete(this)">Hapus</button></td>
      `;

      // Reset inputs
      ['beamNo','uiValue','cacat','ua'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      if (amplasEl) amplasEl.checked = false;

      updateEstimasiSisa();
      checkLimitAndUI();
    }

    function requestDelete(btn) {
      const td = btn.parentNode;
      td.innerHTML = `
        <input type="password" id="passInput" placeholder="Pass" style="width:60px;padding:2px;font-size:0.75em;">
        <button onclick="App.OperatorView.confirmDelete(this)" style="padding:2px 6px;margin:0;font-size:0.7em;background:#27ae60;color:white;border:none;border-radius:3px;cursor:pointer;">OK</button>
        <button onclick="App.OperatorView.cancelDelete(this)" style="padding:2px 6px;margin:0;font-size:0.7em;background:#95a5a6;color:white;border:none;border-radius:3px;cursor:pointer;">Batal</button>
      `;
      const passEl = td.querySelector('input[type="password"]');
      if (passEl) passEl.focus();
    }

    function confirmDelete(btn) {
      const td   = btn.parentNode;
      const pass = (td.querySelector('input[type="password"]') || {}).value || '';
      if (pass === ADMIN_PASS) {
        const row     = td.parentNode;
        const beamVal = (row.cells[1] || {}).innerText || '';
        const idx     = usedBeams.indexOf(beamVal);
        if (idx !== -1) usedBeams.splice(idx, 1);
        updateBeamList();
        row.parentNode.removeChild(row);
        updateEstimasiSisa();
        checkLimitAndUI();
      } else {
        alert('Password salah!');
        td.innerHTML = `<button class="btn-hapus" onclick="App.OperatorView.requestDelete(this)">Hapus</button>`;
      }
    }

    function cancelDelete(btn) {
      const td = btn.parentNode;
      td.innerHTML = `<button class="btn-hapus" onclick="App.OperatorView.requestDelete(this)">Hapus</button>`;
    }

    function finishMO() {
      if (confirm('MO akan diselesaikan. Yakin?')) { location.reload(); }
    }

    // ---- Operator Init ----
    function init() {
      if (!document.getElementById('startBtn')) return; // not operator page
      isStarted = false;
      usedBeams = [];
      document.getElementById('startBtn').style.display  = 'block';
      document.getElementById('formInput').style.display = 'none';
      document.getElementById('addBtn').style.display    = 'none';
      document.getElementById('finishBtn').style.display = 'none';

      updateBeamList();

      const speedSpan = document.getElementById('mcSpeed');
      if (speedSpan) {
        const speedNum = parseFloat(speedSpan.innerText.replace(/[^0-9.]/g, ''));
        const speedEl  = document.getElementById('speed');
        if (!isNaN(speedNum) && speedEl) speedEl.value = speedNum;
      }
      const defPanjang = getPanjangTargetNumerik();
      const panjangEl  = document.getElementById('panjangAkhir');
      if (defPanjang > 0 && panjangEl) panjangEl.value = defPanjang;

      updateEstimasiSisa();

      const speedEl2   = document.getElementById('speed');
      const panjangEl2 = document.getElementById('panjangAkhir');
      const beamNoEl   = document.getElementById('beamNo');
      if (speedEl2)   speedEl2.addEventListener('input',   updateEstimasiSisa);
      if (panjangEl2) panjangEl2.addEventListener('input', updateEstimasiSisa);
      if (beamNoEl)   beamNoEl.addEventListener('input',   updateUI);
    }

    return { init, startTimer, addBeam, requestDelete, confirmDelete,
             cancelDelete, finishMO, updateEstimasiSisa, updateUI };
  })();


  // ============================================================
  // MODULE: IoTHandler  (placeholder — expanded in later tasks)
  // ============================================================
  const IoTHandler = (() => {
    function init() { /* expanded in Task 16 */ }
    function simulateStatusChange(machineId, status) {
      document.dispatchEvent(new CustomEvent('iot:statusChange', {
        detail: { machineId, status, timestamp: Date.now() }
      }));
    }
    return { init, simulateStatusChange };
  })();

  // ============================================================
  // PLANNER — Drag & Drop
  // ============================================================
  let draggedData    = null;
  let draggedElement = null;

  function initDragDrop() {
    const ganttContainer = document.getElementById('ganttScroll');
    const snapGhost      = document.getElementById('snapGhost');
    const CONFIG         = DataStore.getConfig();
    if (!ganttContainer || !snapGhost) return;

    document.getElementById('moTableBody').addEventListener('dragstart', (e) => {
      const row = e.target.closest('tr.draggable-row');
      if (!row) return;
      const item = DataStore.getMOById(row.dataset.id);
      if (!item) return;
      if (!item.stockReady) {
        alert(`⚠️ Stok benang untuk ${item.mo} (${item.yarn}) belum tersedia!`);
        e.preventDefault();
        return;
      }
      row.classList.add('dragging-row');
      draggedData    = { id: item.id, mo: item.mo, sc: item.sc, yarn: item.yarn,
                         lot: item.mc, ends: item.ends, length: item.length,
                         beams: item.beams, fromMachine: null };
      draggedElement = null;
    });

    ganttContainer.addEventListener('dragstart', (e) => {
      const block = e.target.closest('.gantt-block');
      if (!block) return;
      if (block.getAttribute('draggable') === 'false') { e.preventDefault(); return; }
      block.classList.add('dragging-block');
      draggedElement = block;
      const parentTrack = block.closest('.drop-track');
      const fromMachine = parentTrack ? parentTrack.dataset.machine : null;
      const mo = DataStore.getMOById(block.dataset.id);
      if (!mo) return;
      draggedData = { id: mo.id, mo: mo.mo, sc: mo.sc, yarn: mo.yarn,
                      lot: mo.mc, ends: mo.ends, length: mo.length,
                      beams: mo.beams, fromMachine };
    });

    ganttContainer.addEventListener('dragend', (e) => {
      const block = e.target.closest('.gantt-block');
      if (block) block.classList.remove('dragging-block');
      const row = e.target.closest('tr.draggable-row');
      if (row) row.classList.remove('dragging-row');
      snapGhost.style.display = 'none';
      snapGhost.classList.remove('warn-ghost');
    });

    ganttContainer.addEventListener('dragover', (e) => {
      const track = e.target.closest('.drop-track');
      if (!track) return;
      e.preventDefault();
      if (!draggedData) return;
      const rect     = track.getBoundingClientRect();
      const mouseX   = e.clientX - rect.left;
      const snappedX = Math.round(mouseX / CONFIG.slotWidth) * CONFIG.slotWidth;
      const machineLabel = track.dataset.machine;
      const duration = Scheduler.getDurationForMO(draggedData.id, machineLabel);
      const blockWidthPx = duration * (CONFIG.hourWidth / 60);

      track.appendChild(snapGhost);
      snapGhost.style.display = 'flex';
      snapGhost.style.left    = `${snappedX}px`;
      snapGhost.style.width   = `${blockWidthPx}px`;

      const isReroute = (draggedData.fromMachine && draggedData.fromMachine !== machineLabel);
      if (isReroute) {
        snapGhost.classList.add('warn-ghost');
        snapGhost.innerHTML = `⚠️ Pindahkan ke <strong>${machineLabel}</strong> (${duration} mnt)`;
      } else {
        snapGhost.classList.remove('warn-ghost');
        const totalMinutes = (snappedX / CONFIG.hourWidth) * 60;
        const timeStr = Scheduler.formatTime(totalMinutes);
        snapGhost.innerHTML = `📍 Snap Jeda: <strong>${timeStr} WIB</strong> (${duration} mnt)`;
      }
    });

    ganttContainer.addEventListener('dragleave', (e) => {
      if (!e.target.closest('.drop-track')) snapGhost.style.display = 'none';
    });

    ganttContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const track = e.target.closest('.drop-track');
      if (!track || !draggedData) return;
      snapGhost.style.display = 'none';

      const rect     = track.getBoundingClientRect();
      const mouseX   = e.clientX - rect.left;
      const snappedX = Math.round(mouseX / CONFIG.slotWidth) * CONFIG.slotWidth;
      const targetMachine = track.dataset.machine;

      const activeBlock = Renderer.getActiveBlockOnMachine(targetMachine);
      let yarnMismatch = false, activeYarn = null;
      if (activeBlock) {
        activeYarn   = activeBlock.dataset.yarn;
        yarnMismatch = (activeYarn !== draggedData.yarn);
      }

      if ((draggedData.fromMachine && draggedData.fromMachine !== targetMachine) || yarnMismatch) {
        showRerouteWarning(draggedData, targetMachine, snappedX, track, yarnMismatch, activeYarn);
        return;
      }
      executeDrop(draggedData, targetMachine, snappedX, track);
    });
  }


  // ============================================================
  // PLANNER — Reroute warning modal & execute drop
  // ============================================================
  let pendingReroute = null;

  function showRerouteWarning(data, targetMachine, snappedX, trackElem, yarnMismatch, activeYarn) {
    pendingReroute = { data, targetMachine, snappedX, trackElem, yarnMismatch, activeYarn };
    let warnMsg = `Anda akan menempatkan order <strong>${data.mo}</strong> (Benang: ${data.yarn}) ke <strong>${targetMachine}</strong>.<br><br>`;
    if (yarnMismatch && activeYarn) {
      warnMsg += `<span style="color:#f97316;font-weight:bold;">⚠️ PERHATIAN:</span> Mesin ini sedang menggunakan benang <strong>${activeYarn}</strong>.<br>`;
      warnMsg += `Order yang akan ditempatkan menggunakan benang <strong>${data.yarn}</strong> (berbeda).<br>`;
      warnMsg += `Diperlukan waktu <strong>+45 menit</strong> untuk penggantian creel.<br><br>`;
    }
    if (data.fromMachine && data.fromMachine !== targetMachine) {
      warnMsg += `⚡ Anda memindahkan order dari <strong>${data.fromMachine}</strong> ke <strong>${targetMachine}</strong>.<br>`;
      warnMsg += `Pastikan kapasitas creel mencukupi.`;
    }
    const textEl   = document.getElementById('modalTextContent');
    const overlayEl = document.getElementById('warningModal');
    if (textEl)    textEl.innerHTML = warnMsg;
    if (overlayEl) overlayEl.style.display = 'flex';
  }

  function closeModal() {
    const overlayEl = document.getElementById('warningModal');
    if (overlayEl) overlayEl.style.display = 'none';
    pendingReroute = null;
  }

  function executeDrop(data, targetMachine, snappedX, track, isRerouted) {
    const moItem = DataStore.getMOById(data.id);
    if (!moItem) return;
    if (draggedElement && data.fromMachine) { draggedElement.remove(); draggedElement = null; }

    const duration = Scheduler.getDurationForMO(moItem.id, targetMachine);
    const block    = Renderer.createGanttBlock(track, moItem, snappedX, duration, 'scheduled', false);

    if (isRerouted) {
      block.style.background  = '#0369a1';
      block.style.borderLeft  = '5px solid #eab308';
      const h1 = block.querySelector('.block-header span:first-child');
      const h2 = block.querySelector('.block-header span:last-child');
      if (h1) h1.innerHTML = `⚡ [REROUTED] ${moItem.mo} • ${moItem.sc}`;
      if (h2) h2.innerHTML = '🟡 REROUTED';
    }

    DataStore.updateMOStatus(moItem.id, { status: 'Scheduled', stock: `✔ Dialokasikan (${targetMachine})` });
    Renderer.renderTable();
    Renderer.updateMachineLabels();
  }

  // ============================================================
  // PLANNER — Toggle Trouble (IoT simulation)
  // ============================================================
  let isTroubleActive = true;

  function toggleTrouble() {
    let block = document.querySelector('.drop-track[data-machine="MC1"] .gantt-block');
    if (!block) block = document.querySelector('.drop-track .gantt-block.status-trouble');
    if (!block) return;

    const btn    = document.getElementById('btnToggleTrouble');
    const moId   = block.dataset.id;
    const moItem = DataStore.getMOById(moId);
    if (!moItem) return;
    const machineName = (block.closest('.drop-track') || {}).dataset.machine || 'MC1';

    if (isTroubleActive) {
      block.className = 'gantt-block status-running';
      block.setAttribute('draggable', 'false');
      const hs = block.querySelector('.block-header span:last-child');
      if (hs) hs.innerHTML = '🟢 RUNNING 🔒';
      if (btn) { btn.className = 'btn-sim active-red'; btn.innerText = `🔴 Trigger Trouble: ${machineName}`; }
      isTroubleActive = false;
      DataStore.updateMOStatus(moItem.id, { status: 'Running', stock: `🟢 In Machine (${machineName})` });
    } else {
      block.className = 'gantt-block status-trouble';
      block.setAttribute('draggable', 'true');
      const hs = block.querySelector('.block-header span:last-child');
      if (hs) hs.innerHTML = '🔴 TROUBLE';
      if (btn) { btn.className = 'btn-sim'; btn.innerText = `🟢 Selesaikan Trouble: ${machineName}`; }
      isTroubleActive = true;
      DataStore.updateMOStatus(moItem.id, { status: 'Trouble', stock: `🔴 Trouble (${machineName})` });
    }
    Renderer.renderTable();
    Renderer.updateMachineLabels();
  }

  function scrollToToday() {
    const CONFIG  = DataStore.getConfig();
    const targetX = CONFIG.todayIndex * 24 * CONFIG.hourWidth + 8 * CONFIG.hourWidth;
    const el      = document.getElementById('ganttScroll');
    if (el) el.scrollTo({ left: targetX, behavior: 'smooth' });
  }

  function filterTable() { Renderer.renderTable(); }


  // ============================================================
  // EXPOSE globals + App namespace
  // ============================================================
  window.App = { DataStore, Scheduler, Renderer, OperatorView, IoTHandler };

  // Legacy globals for backward compat (onclick attributes)
  window.scrollToToday = scrollToToday;
  window.filterTable   = filterTable;
  window.closeModal    = closeModal;

  // ============================================================
  // ENTRY POINTS
  // ============================================================
  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body && document.body.dataset.page;

    // --- Planner entry point ---
    if (page === 'planner') {
      await DataStore.load('./dummy_data.json');
      Renderer.init({
        ganttEl:           document.getElementById('ganttBody'),
        timelineHeaderEl:  document.getElementById('timeHeaderTrack'),
        nowLineEl:         document.getElementById('nowLine'),
        machineLabelColEl: document.getElementById('machineLabelCol')
      });
      Renderer.renderTimelineHeader();
      Renderer.renderGantt();
      Renderer.renderTable();
      initDragDrop();

      const confirmBtn = document.getElementById('btnConfirmReroute');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (!pendingReroute) return;
          const { data, targetMachine, snappedX, trackElem, yarnMismatch } = pendingReroute;
          executeDrop(data, targetMachine, snappedX, trackElem, true);
          closeModal();
        });
      }

      const troubleBtn = document.getElementById('btnToggleTrouble');
      if (troubleBtn) troubleBtn.addEventListener('click', toggleTrouble);

      setTimeout(scrollToToday, 200);
      return;
    }

    // --- Operator entry point ---
    if (page === 'operator') {
      await DataStore.load('./dummy_data.json');
      OperatorView.init();
      return;
    }

    // Fallback: try to detect by DOM presence
    if (document.getElementById('ganttBody')) {
      await DataStore.load('./dummy_data.json');
      Renderer.init({
        ganttEl:           document.getElementById('ganttBody'),
        timelineHeaderEl:  document.getElementById('timeHeaderTrack'),
        nowLineEl:         document.getElementById('nowLine'),
        machineLabelColEl: document.getElementById('machineLabelCol')
      });
      Renderer.renderTimelineHeader();
      Renderer.renderGantt();
      Renderer.renderTable();
      initDragDrop();
      const confirmBtn = document.getElementById('btnConfirmReroute');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (!pendingReroute) return;
          const { data, targetMachine, snappedX, trackElem } = pendingReroute;
          executeDrop(data, targetMachine, snappedX, trackElem, true);
          closeModal();
        });
      }
      const troubleBtn = document.getElementById('btnToggleTrouble');
      if (troubleBtn) troubleBtn.addEventListener('click', toggleTrouble);
      setTimeout(scrollToToday, 200);
    } else if (document.getElementById('startBtn')) {
      await DataStore.load('./dummy_data.json');
      OperatorView.init();
    }
  });

})();
