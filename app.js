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

    // Merges into (or creates) a machine's active_yarn — used when a new
    // cheese is loaded (full replace of jenis/count/lot/kg_per_cheese) or
    // when the currently-mounted cheese's remaining length is consumed
    // (partial patch of sisa_panjang_m only).
    function updateMachineActiveYarn(machineId, activeYarnPatch) {
      if (!_data || !_data.machines) return;
      const machine = _data.machines.find(function(x) { return x.id === machineId; });
      if (!machine) return;
      machine.active_yarn = Object.assign({}, machine.active_yarn, activeYarnPatch);
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
      updateMachineActiveYarn,
    };
  })();

  // ============================================================
  // MODULE: AppTime
  // Single configurable setting for the timezone the whole planner treats
  // as "wall clock" — the now-line, hour grid, and day boundaries all
  // funnel through here instead of trusting the viewing browser/OS's own
  // local timezone (which may not be WIB). Indonesia has no DST, so a
  // fixed UTC-hour offset is sufficient — change setOffsetHours() below
  // (or call it at runtime, e.g. window.App.AppTime.setOffsetHours(8,
  // 'WITA')) to retarget the app to a different zone.
  // ============================================================
  const AppTime = (() => {
    let _offsetHours = 7;    // WIB = UTC+7
    let _label = 'WIB';

    function setOffsetHours(hours, label) {
      _offsetHours = hours;
      if (label) _label = label;
    }
    function getOffsetHours() { return _offsetHours; }
    function getLabel() { return _label; }

    // Real Date/timestamp -> a Date whose UTC-* getters read as that
    // instant's wall-clock time in the configured zone. Only use this
    // representation for reading calendar/clock fields (getUTCDate(),
    // getUTCHours(), ...) — its .getTime() is NOT a real, storable instant.
    function toZoned(date) {
      return new Date(date.getTime() + _offsetHours * 3600000);
    }

    // Inverse of toZoned() — turns a zoned representation back into a
    // real, correct instant (e.g. before .toISOString() to persist it).
    function fromZoned(zonedDate) {
      return new Date(zonedDate.getTime() - _offsetHours * 3600000);
    }

    function now() { return toZoned(new Date()); }

    return { setOffsetHours, getOffsetHours, getLabel, toZoned, fromZoned, now };
  })();

  // ============================================================
  // MODULE: Scheduler
  // Pure time/pixel math for the planner Gantt. Anchored on AppTime's
  // configured wall-clock "today" (TODAY_INDEX day of a TOTAL_DAYS
  // window) so the timeline and the now-line always agree, regardless of
  // which dates happen to appear in dummy_data.json or what timezone the
  // viewing browser itself is set to.
  // ============================================================
  const Scheduler = (() => {
    const TOTAL_DAYS  = 30;
    const TODAY_INDEX = 15;

    // Continuous zoom: every hour always gets its own column (no grouping
    // into wider multi-hour slots) — only the pixel width of one hour
    // changes. Bounds/default come from dummy_data.json's app_config via
    // configureZoom(), called once DataStore has loaded.
    let _pxPerHour    = 80;
    let _minPxPerHour = 20;
    let _maxPxPerHour = 400;

    function configureZoom(defaultPx, minPx, maxPx) {
      if (minPx) _minPxPerHour = minPx;
      if (maxPx) _maxPxPerHour = maxPx;
      _pxPerHour = Math.min(_maxPxPerHour, Math.max(_minPxPerHour, defaultPx || _pxPerHour));
    }

    // Midnight, TODAY_INDEX days ago, in AppTime's configured zone —
    // returned as a real, storable Date (dateToOffset/offsetToDate below
    // are plain epoch-ms arithmetic from here on, so they stay correct
    // without needing to know about timezones themselves).
    function getBaseDate() {
      const zonedNow = AppTime.now();
      const zonedMidnight = new Date(Date.UTC(zonedNow.getUTCFullYear(), zonedNow.getUTCMonth(), zonedNow.getUTCDate()));
      zonedMidnight.setUTCDate(zonedMidnight.getUTCDate() - TODAY_INDEX);
      return AppTime.fromZoned(zonedMidnight);
    }

    function getPxPerHour()    { return _pxPerHour; }
    function getMinPxPerHour() { return _minPxPerHour; }
    function getMaxPxPerHour() { return _maxPxPerHour; }
    function setPxPerHour(px) {
      _pxPerHour = Math.min(_maxPxPerHour, Math.max(_minPxPerHour, px));
      return _pxPerHour;
    }

    function getTotalHours()   { return TOTAL_DAYS * 24; }
    function getTotalWidthPx() { return getTotalHours() * _pxPerHour; }

    function dateToOffset(date) {
      const diffHours = (date.getTime() - getBaseDate().getTime()) / 3600000;
      return diffHours * _pxPerHour;
    }

    function offsetToDate(px) {
      const diffHours = px / _pxPerHour;
      return new Date(getBaseDate().getTime() + diffHours * 3600000);
    }

    function durationToWidth(durationMinutes) {
      return (durationMinutes / 60) * _pxPerHour;
    }

    function formatTime(totalMinutes) {
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = Math.round(totalMinutes % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function calculateDuration(lengthMeters, speedRpm, beams) {
      if (!speedRpm) return 0;
      return Math.ceil((lengthMeters / (speedRpm * 0.7) + 15) * beams);
    }

    // mo: a manufacturing_orders entry (dummy_data.json shape). machine: a machines entry.
    function getDurationForMO(mo, machine) {
      if (!mo) return 0;
      const speed = mo.speed_target_rpm || (machine && machine.max_speed_rpm) || 0;
      return calculateDuration(mo.order_per_beam_m || 0, speed, mo.target_beam || 0);
    }

    return {
      TOTAL_DAYS, TODAY_INDEX,
      getBaseDate, configureZoom,
      getPxPerHour, setPxPerHour, getMinPxPerHour, getMaxPxPerHour,
      getTotalHours, getTotalWidthPx,
      dateToOffset, offsetToDate, durationToWidth, formatTime,
      calculateDuration, getDurationForMO,
    };
  })();


  // ============================================================
  // MODULE: Renderer  (Planner UI logic)
  // Fully data-driven off DataStore (dummy_data.json): machines +
  // manufacturing_orders are the single source of truth for the Gantt.
  // ============================================================
  const Renderer = (() => {
    function init(domRefs) {
      // Kept for API compatibility with the bootstrap entry point below —
      // all render functions look up their elements by id on demand, so
      // there is no DOM state to cache here.
    }

    // ---- Timeline Header ----
    function renderTimelineHeader() {
      const container = document.getElementById('timeHeaderTrack');
      if (!container) return;
      container.innerHTML = '';

      const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const months   = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const baseDate = Scheduler.getBaseDate();
      const pxPerHour = Scheduler.getPxPerHour();

      for (let d = 0; d < Scheduler.TOTAL_DAYS; d++) {
        // Pure epoch-ms arithmetic (not local setDate()) so this can't be
        // thrown off by the viewing browser's own timezone; the calendar
        // fields for labeling are then read via AppTime's configured zone.
        const date = new Date(baseDate.getTime() + d * 86400000);
        const zonedDate = AppTime.toZoned(date);

        const dayGroup = document.createElement('div');
        dayGroup.className = 'planner-day-header-group';
        dayGroup.style.width = `${24 * pxPerHour}px`;

        const title = document.createElement('div');
        title.className = 'planner-day-title';
        const dayStr = `${dayNames[zonedDate.getUTCDay()]}, ${zonedDate.getUTCDate()} ${months[zonedDate.getUTCMonth()]}`;
        if (d === Scheduler.TODAY_INDEX) {
          title.classList.add('today-title');
          title.textContent = `🎯 HARI INI (${dayStr})`;
        } else if (d < Scheduler.TODAY_INDEX) {
          title.textContent = `⏪ ${dayStr}`;
        } else {
          title.textContent = `⏩ ${dayStr}`;
        }
        dayGroup.appendChild(title);

        // One tick per hour, always — zoom only changes pxPerHour, never
        // how many hours are shown or whether they're grouped.
        const hoursRow = document.createElement('div');
        hoursRow.className = 'planner-hours-row';
        for (let h = 0; h < 24; h++) {
          const slot = document.createElement('div');
          slot.className = 'planner-hour-slot';
          slot.style.width = `${pxPerHour}px`;
          slot.style.minWidth = `${pxPerHour}px`;
          slot.textContent = `${String(h).padStart(2, '0')}:00`;
          hoursRow.appendChild(slot);
        }
        dayGroup.appendChild(hoursRow);
        container.appendChild(dayGroup);
      }

      const zoomLabelEl = document.getElementById('zoomLabel');
      if (zoomLabelEl) zoomLabelEl.textContent = `${Math.round(pxPerHour)} px/jam`;
    }

    // ---- Machine label (sidebar) ----
    function _machineLabelHTML(machine) {
      const dotClass = machine.iot_status === 'running' ? 'ico-dot-green'
        : (machine.iot_status === 'rusak' || machine.iot_status === 'benang_putus') ? 'ico-dot-red'
        : 'ico-dot-grey';

      // Yarn/remaining-length shows whenever a cheese is mounted, even if the
      // machine has no active MO right now — a planner needs to see "still
      // has 90,000m of X loaded" just as much when the machine is idle.
      let yarnLine = '⏸️ Idle';
      let moLine = '';
      if (machine.active_yarn) {
        const jenis = machine.active_yarn.jenis || '';
        const lot = machine.active_yarn.lot || '';
        const sisa = machine.active_yarn.sisa_panjang_m;
        yarnLine = `🧵 ${lot ? jenis + ' | ' + lot : jenis}`;
        if (typeof sisa === 'number') yarnLine += ` (sisa ~${Math.round(sisa).toLocaleString('id-ID')}m)`;
      }
      if (machine.active_mo_id) {
        moLine = `📋 ${machine.active_mo_id}`;
      }

      return `
        <div class="machine-name"><span class="ico ico-dot ${dotClass}" style="margin-right:6px;"></span>${machine.name}</div>
        <div class="machine-yarn">${yarnLine}</div>
        ${moLine ? `<div class="machine-mo">${moLine}</div>` : ''}
      `;
    }

    function updateMachineLabels() {
      DataStore.getMachines().forEach(machine => {
        const label = document.querySelector(`.planner-machine-label[data-machine-id="${machine.id}"]`);
        if (!label) return;
        label.innerHTML = _machineLabelHTML(machine);
        label.classList.remove('running-well', 'machine-trouble');
        if (machine.iot_status === 'running') label.classList.add('running-well');
        else if (machine.iot_status === 'rusak' || machine.iot_status === 'benang_putus') label.classList.add('machine-trouble');
      });
    }

    // ---- Block status derivation ----
    // Combines the MO's own scheduling state (gantt_status) with the
    // machine's live IoT status to decide how a block should look and
    // whether it can be dragged.
    function _deriveBlockStatus(mo, machine) {
      const isActiveOnMachine = !!(machine && machine.active_mo_id === mo.mo_id);
      if (isActiveOnMachine && machine && (machine.iot_status === 'rusak' || machine.iot_status === 'benang_putus')) {
        return { statusClass: 'trouble', locked: false };
      }
      if (mo.gantt_status === 'fixed') {
        if (isActiveOnMachine && machine && machine.iot_status === 'running') {
          return { statusClass: 'running', locked: true };
        }
        return { statusClass: 'fixed', locked: true };
      }
      return { statusClass: 'scheduled', locked: false };
    }

    // ---- Render Gantt ----
    // interactive=false renders the exact same blocks (same status colors,
    // same positions) but with no fix/unfix/remove buttons, no drag, no
    // click handlers — used by the read-only supervisor Gantt view so it
    // can't accidentally mutate the schedule.
    function renderGantt(interactive) {
      if (interactive === undefined) interactive = true;
      const body = document.getElementById('ganttBody');
      if (!body) return;

      // #snapGhost gets reparented into a drop-track while dragging; if a
      // re-render fires mid-drag it must be rescued first or body.innerHTML
      // wipes it from the DOM permanently.
      const snapGhost = document.getElementById('snapGhost');
      const ganttScrollEl = document.getElementById('ganttScroll');
      if (snapGhost && ganttScrollEl && snapGhost.parentElement !== ganttScrollEl) {
        ganttScrollEl.appendChild(snapGhost);
        snapGhost.style.display = 'none';
      }

      body.innerHTML = '';

      const machines = DataStore.getMachines().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const totalWidthPx = Scheduler.getTotalWidthPx();
      const totalHours = Scheduler.getTotalHours();
      const pxPerHour = Scheduler.getPxPerHour();

      machines.forEach(machine => {
        const row = document.createElement('div');
        row.className = 'planner-machine-row';
        row.dataset.machine = machine.id;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'planner-machine-label';
        labelDiv.dataset.machineId = machine.id;
        labelDiv.innerHTML = _machineLabelHTML(machine);
        if (machine.iot_status === 'running') labelDiv.classList.add('running-well');
        else if (machine.iot_status === 'rusak' || machine.iot_status === 'benang_putus') labelDiv.classList.add('machine-trouble');
        row.appendChild(labelDiv);

        const trackArea = document.createElement('div');
        trackArea.className = 'planner-timeline-track-area';

        const grid = document.createElement('div');
        grid.className = 'planner-timeline-grid';
        grid.style.width = `${totalWidthPx}px`;
        for (let h = 0; h < totalHours; h++) {
          const hourDiv = document.createElement('div');
          hourDiv.className = 'planner-grid-hour';
          hourDiv.style.width = `${pxPerHour}px`;
          hourDiv.style.minWidth = `${pxPerHour}px`;
          for (let m = 0; m < 6; m++) {
            const sub = document.createElement('div');
            sub.className = 'planner-grid-10min';
            hourDiv.appendChild(sub);
          }
          grid.appendChild(hourDiv);
        }
        trackArea.appendChild(grid);

        const dropTrack = document.createElement('div');
        dropTrack.className = 'planner-drop-track';
        dropTrack.dataset.machine = machine.id;
        dropTrack.style.width = `${totalWidthPx}px`;
        trackArea.appendChild(dropTrack);

        row.appendChild(trackArea);
        body.appendChild(row);
      });

      // Place a block for every MO that already occupies a machine slot.
      DataStore.getMOs().forEach(mo => {
        if (mo.gantt_status === 'unscheduled' || !mo.machine_id || !mo.planned_start || !mo.planned_end) return;
        const track = document.querySelector(`.planner-drop-track[data-machine="${mo.machine_id}"]`);
        if (!track) return;
        const machine = DataStore.getMachineById(mo.machine_id);
        const start = new Date(mo.planned_start);
        const end = new Date(mo.planned_end);
        const leftPx = Scheduler.dateToOffset(start);
        const durationMin = Math.max(0, (end - start) / 60000);
        createGanttBlock(track, mo, machine, leftPx, durationMin, _deriveBlockStatus(mo, machine), 0, interactive);
      });

      updateMachineLabels();
      updateNowLine();
    }

    // ---- Create Gantt Block ----
    function createGanttBlock(track, mo, machine, leftPx, durationMinutes, statusInfo, extraSetupMin, interactive) {
      extraSetupMin = extraSetupMin || 0;
      if (interactive === undefined) interactive = true;
      const statusClass = statusInfo.statusClass;
      const locked = statusInfo.locked;

      const block = document.createElement('div');
      block.className = `planner-gantt-block gantt-block status-${statusClass}`;
      if (locked) block.classList.add('locked-block');
      if (statusClass === 'fixed') block.classList.add('fixed-block');
      block.id = `block-${mo.mo_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      block.dataset.id = mo.mo_id;
      block.dataset.yarn = mo.yarn_label || '';
      block.dataset.lot = mo.lot || '';
      block.dataset.duration = durationMinutes;
      block.style.left = `${leftPx}px`;
      block.style.width = `${Scheduler.durationToWidth(durationMinutes)}px`;
      block.setAttribute('draggable', (interactive && !locked) ? 'true' : 'false');

      const startMin = (leftPx / Scheduler.getPxPerHour()) * 60;
      const endMin = startMin + durationMinutes;
      const labelMap = { running: '🟢 RUNNING', trouble: '🔴 TROUBLE', fixed: '✅ FIXED', scheduled: '🟡 SCHEDULED' };
      let statusLabel = labelMap[statusClass] || '🟡 SCHEDULED';
      if (locked && statusClass === 'running') statusLabel += ' 🔒';

      const actionsHTML = !interactive ? '' : `
        ${statusClass === 'scheduled' ? '<button class="btn-fix" type="button">🔒 Fix</button>' : ''}
        ${statusClass === 'fixed' ? '<button class="btn-unfix" type="button">🔓 Unfix</button>' : ''}
        ${!locked ? '<button class="btn-remove-block" type="button">🗑️</button>' : ''}
      `;

      block.innerHTML = `
        <div class="block-header"><span>${mo.mo_id}${mo.lot ? ' • ' + mo.lot : ''}</span><span>${statusLabel}</span></div>
        <div class="block-sub">${mo.lembar || '-'} Lembar | ⏱️ ${Scheduler.formatTime(startMin)}-${Scheduler.formatTime(endMin)} ${AppTime.getLabel()} (${durationMinutes} mnt)${extraSetupMin > 0 ? ' +setup ' + extraSetupMin + 'mnt' : ''}</div>
        ${interactive ? `<div class="block-actions">${actionsHTML}</div>` : ''}
      `;
      track.appendChild(block);

      if (interactive) {
        block.addEventListener('click', e => {
          if (e.target.closest('.btn-fix')) { fixBlock(block, mo.mo_id); return; }
          if (e.target.closest('.btn-unfix')) { unfixBlock(block, mo.mo_id); return; }
          if (e.target.closest('.btn-remove-block')) { removeScheduledBlock(block, mo.mo_id); return; }
        });
        block.addEventListener('contextmenu', e => {
          e.preventDefault();
          const isFixed = block.classList.contains('fixed-block');
          const isLocked = block.classList.contains('locked-block');
          if (isFixed) { if (confirm(`Unfix ${mo.mo_id}?`)) unfixBlock(block, mo.mo_id); }
          else if (!isLocked) { if (confirm(`Fix ${mo.mo_id}?`)) fixBlock(block, mo.mo_id); }
        });
      }

      return block;
    }

    // ---- Fix / Unfix / Remove ----
    function fixBlock(block, moId) {
      DataStore.updateMOStatus(moId, { gantt_status: 'fixed' });
      block.classList.add('fixed-block', 'locked-block');
      block.classList.remove('status-scheduled');
      block.classList.add('status-fixed');
      block.setAttribute('draggable', 'false');
      const lastSpan = block.querySelector('.block-header span:last-child');
      if (lastSpan) lastSpan.textContent = '✅ FIXED';
      const actions = block.querySelector('.block-actions');
      if (actions) actions.innerHTML = '<button class="btn-unfix" type="button">🔓 Unfix</button>';
      updateMachineLabels();
      renderMOTable();
      showNotification(`${moId} di-FIX.`, 'info');
    }

    function unfixBlock(block, moId) {
      DataStore.updateMOStatus(moId, { gantt_status: 'scheduled' });
      block.classList.remove('fixed-block', 'locked-block', 'status-fixed');
      block.classList.add('status-scheduled');
      block.setAttribute('draggable', 'true');
      const lastSpan = block.querySelector('.block-header span:last-child');
      if (lastSpan) lastSpan.textContent = '🟡 SCHEDULED';
      const actions = block.querySelector('.block-actions');
      if (actions) actions.innerHTML = '<button class="btn-fix" type="button">🔒 Fix</button><button class="btn-remove-block" type="button">🗑️</button>';
      updateMachineLabels();
      renderMOTable();
      showNotification(`${moId} di-unfix.`, 'warn');
    }

    function removeScheduledBlock(block, moId) {
      DataStore.updateMOStatus(moId, { machine_id: null, planned_start: null, planned_end: null, gantt_status: 'unscheduled' });
      block.remove();
      updateMachineLabels();
      renderMOTable();
      showNotification(`${moId} dikembalikan ke daftar.`, 'warn');
    }

    // ---- Now Line ----
    function updateNowLine() {
      const nowLineEl = document.getElementById('nowLine');
      if (!nowLineEl) return;
      const offset = Scheduler.dateToOffset(new Date());
      // #nowLine is a direct sibling of #ganttScroll, not nested inside the
      // sticky machine-label column like the hour ticks and gantt-blocks
      // are (they live inside .planner-timeline-track-area, which starts
      // col-machine-width px in) — so it needs that same offset added, or
      // it renders one column-width too far left of everything else.
      const colWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--col-machine-width')) || 180;
      nowLineEl.style.left = `${offset + colWidth}px`;
      nowLineEl.style.display = 'block';
      nowLineEl.style.top = '0';
      const header = document.getElementById('ganttHeaderRow');
      const body = document.getElementById('ganttBody');
      const headerH = header ? header.offsetHeight : 48;
      const bodyH = body ? body.offsetHeight : 0;
      nowLineEl.style.height = `${headerH + bodyH}px`;

      // Blocks whose window has fully elapsed can no longer be dragged
      // (unless they're already fixed/running/trouble, which manage their
      // own lock state).
      document.querySelectorAll('.planner-gantt-block').forEach(block => {
        if (!block.classList.contains('status-scheduled')) return;
        const leftPx = parseFloat(block.style.left) || 0;
        const widthPx = parseFloat(block.style.width) || 0;
        const isPastEnd = (leftPx + widthPx) < offset;
        block.classList.toggle('locked-block', isPastEnd);
        block.setAttribute('draggable', isPastEnd ? 'false' : 'true');
      });
    }

    // ---- Render MO Table ----
    function renderMOTable() {
      const tbody = document.getElementById('moTableBody');
      if (!tbody) return;
      const searchEl = document.getElementById('searchInput');
      const statusEl = document.getElementById('statusFilter');
      const searchVal = searchEl ? searchEl.value.toLowerCase() : '';
      const statusVal = statusEl ? statusEl.value : 'ALL';

      const moList = DataStore.getMOs().filter(item => {
        const matchSearch = !searchVal ||
          (item.mo_id && item.mo_id.toLowerCase().includes(searchVal)) ||
          (item.yarn_label && item.yarn_label.toLowerCase().includes(searchVal)) ||
          (item.knitting_mc && item.knitting_mc.toLowerCase().includes(searchVal)) ||
          (item.lot && item.lot.toLowerCase().includes(searchVal));
        let matchStatus = true;
        if (statusVal === 'NOT_SCHEDULED') matchStatus = item.gantt_status === 'unscheduled';
        else if (statusVal !== 'ALL') matchStatus = (item.mo_status === statusVal || item.gantt_status === statusVal);
        return matchSearch && matchStatus;
      });

      tbody.innerHTML = '';
      moList.forEach((item, idx) => {
        const isUnscheduled = item.gantt_status === 'unscheduled';
        const isNotReady = item.stock_status === 'not_ready';

        const tr = document.createElement('tr');
        tr.dataset.moId = item.mo_id;
        if (isUnscheduled) {
          tr.classList.add('draggable-row');
          tr.setAttribute('draggable', 'true');
        } else {
          tr.style.opacity = '0.55';
        }

        const stockBadge = isNotReady
          ? '<span class="badge badge-notready">⚠️ Not Ready</span>'
          : '<span class="badge badge-ready">🟢 Ready</span>';

        let statusBadge;
        if (item.gantt_status === 'fixed') statusBadge = '<span class="badge badge-fixed">🔒 Fixed</span>';
        else if (item.gantt_status === 'scheduled') statusBadge = '<span class="badge badge-scheduled">✔ Scheduled</span>';
        else if (item.mo_status === 'in_progress') statusBadge = '<span class="badge badge-running">⚙️ Running</span>';
        else if (item.mo_status === 'done') statusBadge = '<span class="badge badge-done">✅ Done</span>';
        else statusBadge = '<span class="badge badge-ready">🟢 Ready</span>';

        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td><strong>${item.mo_id}</strong></td>
          <td>${item.knitting_mc || '-'}</td>
          <td>🧵 ${item.yarn_label || '-'}</td>
          <td>${item.lot || '-'}</td>
          <td>${item.target_beam || '-'}</td>
          <td>${item.gb || '-'}</td>
          <td>${stockBadge}</td>
          <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // ---- Zoom by dragging the time header (like a trading-chart time axis) ----
    // Horizontal drag scales pxPerHour around the point where the drag
    // started: drag right to zoom in, left to zoom out. The grabbed date
    // stays pinned under the cursor's start position for the whole gesture.
    function initHeaderZoomDrag() {
      const headerTrack = document.getElementById('timeHeaderTrack');
      const scrollEl = document.getElementById('ganttScroll');
      if (!headerTrack || !scrollEl) return;

      const ZOOM_SENSITIVITY_PX = 150; // px of drag per doubling/halving of scale

      let dragging = false;
      let dragStartX = 0;
      let startPxPerHour = 0;
      let anchorDate = null;
      let colWidth = 0;
      let rafPending = false;
      let latestClientX = 0;

      function applyZoomFrame() {
        rafPending = false;
        if (!dragging) return;
        const deltaX = latestClientX - dragStartX;
        Scheduler.setPxPerHour(startPxPerHour * Math.pow(2, deltaX / ZOOM_SENSITIVITY_PX));
        renderTimelineHeader();
        renderGantt();
        const scrollRect = scrollEl.getBoundingClientRect();
        const newOffsetPx = Scheduler.dateToOffset(anchorDate);
        scrollEl.scrollLeft = Math.max(0, newOffsetPx - (dragStartX - scrollRect.left - colWidth));
      }

      headerTrack.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        dragStartX = e.clientX;
        latestClientX = e.clientX;
        startPxPerHour = Scheduler.getPxPerHour();
        colWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--col-machine-width')) || 180;
        const scrollRect = scrollEl.getBoundingClientRect();
        const contentX = (e.clientX - scrollRect.left - colWidth) + scrollEl.scrollLeft;
        anchorDate = Scheduler.offsetToDate(contentX);
        document.body.style.cursor = 'ew-resize';
      });

      window.addEventListener('mousemove', e => {
        if (!dragging) return;
        latestClientX = e.clientX;
        if (!rafPending) { rafPending = true; requestAnimationFrame(applyZoomFrame); }
      });

      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
      });
    }

    // ---- Column resize (MO table headers) ----
    function initColumnResize() {
      let resizing = false, th = null, startX = 0, startWidth = 0;
      document.querySelectorAll('.planner-table-section th .resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', e => {
          resizing = true;
          th = handle.parentElement;
          startX = e.clientX;
          startWidth = th.offsetWidth;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        });
      });
      document.addEventListener('mousemove', e => {
        if (!resizing || !th) return;
        const newWidth = Math.max(40, startWidth + e.clientX - startX);
        th.style.width = `${newWidth}px`;
        th.style.minWidth = `${newWidth}px`;
      });
      document.addEventListener('mouseup', () => {
        if (resizing) {
          resizing = false;
          th = null;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

    // ---- IoT trouble simulator (control-bar button) ----
    let _troubleMachineId = null;
    let _troubleActive = false;

    function initTroubleSim() {
      const machines = DataStore.getMachines();
      const troubled = machines.find(m => m.iot_status === 'rusak' || m.iot_status === 'benang_putus');
      _troubleMachineId = troubled ? troubled.id : ((machines[0] && machines[0].id) || null);
      _troubleActive = !!troubled;
      _updateTroubleButton();
    }

    function _updateTroubleButton() {
      const btn = document.getElementById('btnToggleTrouble');
      if (!btn || !_troubleMachineId) return;
      if (_troubleActive) {
        btn.className = 'planner-btn-sim active-red';
        btn.textContent = `🟢 Selesaikan Trouble ${_troubleMachineId}`;
      } else {
        btn.className = 'planner-btn-sim';
        btn.textContent = `🔴 Trigger Trouble ${_troubleMachineId}`;
      }
    }

    function toggleTrouble() {
      if (!_troubleMachineId) return;
      if (_troubleActive) {
        DataStore.updateMachineIoT(_troubleMachineId, 'running');
        _troubleActive = false;
        showNotification(`${_troubleMachineId} kembali normal.`, 'info');
      } else {
        DataStore.updateMachineIoT(_troubleMachineId, 'rusak');
        _troubleActive = true;
        showNotification(`${_troubleMachineId} mengalami trouble!`, 'error');
      }
      _updateTroubleButton();
      renderGantt();
    }

    // ---- Scroll timeline to "today" ----
    function scrollToToday() {
      // Pure epoch-ms arithmetic off getBaseDate() (already WIB-anchored
      // midnight) — not local setDate()/setHours(), which would drift by
      // whatever offset the viewing browser's own timezone happens to be.
      const target = new Date(Scheduler.getBaseDate().getTime() + Scheduler.TODAY_INDEX * 86400000 + 8 * 3600000);
      const offset = Scheduler.dateToOffset(target);
      const el = document.getElementById('ganttScroll');
      if (el) el.scrollTo({ left: Math.max(0, offset - 100), behavior: 'smooth' });
    }

    // ---- Notifications (toast) ----
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

    return {
      init, renderTimelineHeader, renderGantt, renderMOTable,
      createGanttBlock, removeScheduledBlock,
      updateMachineLabels, updateNowLine,
      initHeaderZoomDrag, initColumnResize,
      initTroubleSim, toggleTrouble,
      scrollToToday, showNotification,
      deriveBlockStatus: _deriveBlockStatus,
    };
  })();


  // ============================================================
  // MODULE: OperatorView  (Operator UI logic)
  // ============================================================
  const OperatorView = (() => {
    const ADMIN_PASS = DataStore.getConfig().adminPassword;

    // Grade choices (static). Shift choices derive from DataStore.getShifts()
    // with a sensible fallback if data hasn't loaded.
    const GRADE_OPTIONS = (DataStore.getConfig().grade_options) || ['A', 'B', 'C'];
    function getShiftOptions() {
      const shifts = DataStore.getShifts();
      if (shifts && shifts.length) return shifts.map(function (s) { return s.label; });
      return ['Pagi', 'Siang', 'Malam'];
    }

    // ---- Row-based workflow state ----
    let isMOStarted    = false;
    let activeRowIndex = -1;

    // Default values captured from the first completed row, applied to later rows.
    let defaultWinding = null;
    let defaultUA      = null;

    // Ordered list of beam numbers per table row (null = empty slot).
    let beamOrder      = [];
    // Beam numbers that have been completed ("Selesai").
    let completedBeams = [];
    // Per-beam timing state: { waktuMulai, waktuSelesai } keyed by beam number.
    let beamData       = {};
    // Per-beam runtime edits (panjang/speed/winding/grade/ua/cacat/amplas/ui)
    // keyed by beam number. Kept local so DataStore.getBeamDatabase() stays read-only.
    let beamRuntime    = {};

    // ---- Beam catalog (from DataStore) ----
    // Returns the runtime record for a beam, seeding `ui` from the beam DB.
    function getBeam(beamNo) {
      if (!beamRuntime[beamNo]) {
        const db = DataStore.getBeamDatabase();
        beamRuntime[beamNo] = { ui: db[beamNo] || '' };
      }
      return beamRuntime[beamNo];
    }
    function beamExists(beamNo) {
      const db = DataStore.getBeamDatabase();
      return Object.prototype.hasOwnProperty.call(db, beamNo);
    }

    // ---- Parser angka format Indonesia ----
    // Format ID pakai titik (.) sebagai pemisah ribuan dan koma (,) sebagai desimal.
    // Contoh: "13.253" berarti 13253 (bukan 13.253 dalam artian desimal Inggris).
    function parseIndoNumber(str) {
      if (str === null || str === undefined) return 0;
      let txt = String(str).trim();
      txt = txt.replace(/[^0-9.,]/g, '');
      if (txt === '') return 0;
      txt = txt.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(txt);
      return isNaN(num) ? 0 : num;
    }

    // ---- Helpers ----
    function getHeaderValue(id) {
      const el = document.getElementById(id);
      if (!el) return 0;
      return parseIndoNumber(el.innerText);
    }

    // Order per Beam sebagai angka murni (meter), satu-satunya sumber panjang per beam.
    function getPanjangTargetNumerik() {
      const span = document.getElementById('panjangTarget');
      if (!span) return 0;
      return parseIndoNumber(span.innerText);
    }

    // Total panjang beam yang sudah selesai, dihitung dari panjang AKTUAL tiap beam.
    function getTotalPanjangSelesai() {
      let total = 0;
      completedBeams.forEach(b => {
        const beam = beamRuntime[b];
        const p = (beam && beam.panjang !== undefined && beam.panjang !== null)
          ? beam.panjang : getPanjangTargetNumerik();
        total += p;
      });
      return total;
    }

    // Speed default: diambil dari header Speed Target (span#mcSpeed), fallback 500.
    function getDefaultSpeed() {
      const speedSpan = document.getElementById('mcSpeed');
      let speed = 500;
      if (speedSpan) {
        const speedNum = parseIndoNumber(speedSpan.innerText);
        if (speedNum > 0) speed = speedNum;
      }
      return speed;
    }

    function formatTime(date) {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return h + ':' + m;
    }

    function hitungBerat(panjangMeter) {
      const denier = getHeaderValue('denierValue');
      const lembar = getHeaderValue('lembarValue');
      if (denier > 0 && lembar > 0 && panjangMeter > 0) {
        return (denier * lembar * panjangMeter) / 9000000;
      }
      return 0;
    }

    // Beam numbers still available to assign (not yet in beamOrder, or already completed).
    function getAvailableBeams() {
      const db = DataStore.getBeamDatabase();
      return Object.keys(db).filter(b => !beamOrder.includes(b) || completedBeams.includes(b));
    }

    function updateEstimasiSisa() {
      const estimasiEl = document.getElementById('estimasiValue');
      if (!estimasiEl) return;

      const targetBeam    = getHeaderValue('targetBeam');
      const panjangTarget = getPanjangTargetNumerik();
      const totalTarget   = targetBeam * panjangTarget;
      const totalSelesai  = getTotalPanjangSelesai();
      const sisa          = Math.max(0, totalTarget - totalSelesai);

      if (!isMOStarted && activeRowIndex === -1 && completedBeams.length === 0) {
        estimasiEl.textContent = '— (belum mulai)';
        return;
      }
      if (sisa <= 0 && beamOrder.length > 0) {
        estimasiEl.textContent = '✅ Semua beam selesai!';
        return;
      }

      const speed = getDefaultSpeed();
      const totalMinutes = sisa / speed;
      if (totalMinutes <= 0 || !isFinite(totalMinutes)) {
        estimasiEl.textContent = '— (periksa input)';
        return;
      }

      const hours   = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);
      let display = '';
      if (hours > 0) display += hours + ' jam ';
      display += minutes + ' menit';
      estimasiEl.textContent = '~ ' + display + ' (sisa ' + Math.round(sisa) + ' m)';
    }

    // ---- Cell builders ----

    // <select> untuk kolom Beam (langsung tampil, tanpa perlu klik dulu).
    function buildBeamSelect(rowIndex, beamKey) {
      const select = document.createElement('select');
      select.className = 'edit-select';

      const available = getAvailableBeams();
      let options = available.slice();
      if (beamKey && !options.includes(beamKey)) options.unshift(beamKey);

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-- Pilih Beam --';
      select.appendChild(placeholder);

      options.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        if (b === beamKey) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        const newValue = select.value;
        const oldValue = beamKey;
        if (newValue === '' || newValue === oldValue) return;

        if (beamOrder.includes(newValue) && !completedBeams.includes(newValue)) {
          alert('Beam ini sudah digunakan!');
          select.value = oldValue || '';
          return;
        }
        if (!beamExists(newValue)) {
          alert('Data beam tidak ditemukan!');
          select.value = oldValue || '';
          return;
        }
        const newData = getBeam(newValue);

        if (rowIndex > 0 && defaultWinding !== null && defaultUA !== null) {
          if (newData.winding === null || newData.winding === undefined) newData.winding = defaultWinding;
          if (newData.ua === null || newData.ua === undefined) newData.ua = defaultUA;
        }
        // Nilai default saat beam baru dipasang di baris ini.
        if (newData.panjang === undefined || newData.panjang === null) {
          newData.panjang = getPanjangTargetNumerik();
        }
        if (newData.speed === undefined || newData.speed === null) {
          newData.speed = getDefaultSpeed();
        }
        if (!newData.grade) {
          newData.grade = 'A';
        }

        if (!oldValue) {
          if (rowIndex < beamOrder.length) beamOrder[rowIndex] = newValue;
          else beamOrder.push(newValue);
          if (!beamData[newValue]) beamData[newValue] = {};
          if (isMOStarted) beamData[newValue].waktuMulai = formatTime(new Date());
        } else {
          const idx = beamOrder.indexOf(oldValue);
          if (idx !== -1) beamOrder[idx] = newValue;
          if (beamData[oldValue]) {
            beamData[newValue] = beamData[oldValue];
            delete beamData[oldValue];
          }
          const compIdx = completedBeams.indexOf(oldValue);
          if (compIdx !== -1) completedBeams[compIdx] = newValue;
        }
        renderTable();
        updateEstimasiSisa();
      });

      return select;
    }

    // <input> teks/angka untuk field bebas (langsung tampil).
    function buildTextInput(beamKey, field, currentValue, type, onSaved) {
      const input = document.createElement('input');
      input.type = type || 'text';
      input.className = 'edit-input';
      input.value = (currentValue === '-' || currentValue === undefined || currentValue === null) ? '' : currentValue;

      input.addEventListener('change', () => {
        const newValue = input.value.trim();
        if (newValue === '') return;
        let saved;
        if (type === 'number') {
          saved = parseIndoNumber(newValue);
        } else {
          saved = newValue;
        }
        getBeam(beamKey)[field] = saved;
        if (typeof onSaved === 'function') onSaved(saved);
      });

      return input;
    }

    // <select> untuk Cacat / Grade (langsung tampil).
    function buildChoiceSelect(beamKey, field, currentValue, choices) {
      const select = document.createElement('select');
      select.className = 'edit-select';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-';
      select.appendChild(placeholder);

      choices.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === currentValue) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        getBeam(beamKey)[field] = select.value;
      });

      return select;
    }

    function toggleAmplas(beamKey, checked) {
      if (!beamKey) return;
      getBeam(beamKey).amplas = checked;
    }

    // ---- Cell append helpers ----
    function appendTextCell(row, value) {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    }

    function appendFieldCell(row, isEditable, beamKey, field, value, type, onSaved) {
      const td = document.createElement('td');
      if (isEditable && beamKey) {
        td.appendChild(buildTextInput(beamKey, field, value, type, onSaved));
      } else {
        td.textContent = value;
      }
      row.appendChild(td);
    }

    function appendChoiceCell(row, isEditable, beamKey, field, value, choices) {
      const td = document.createElement('td');
      if (isEditable && beamKey) {
        td.appendChild(buildChoiceSelect(beamKey, field, value, choices));
      } else {
        td.textContent = value || '-';
      }
      row.appendChild(td);
    }

    // ---- Render tabel ----
    function renderTable() {
      const tbody = document.getElementById('tableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      const targetBeam = getHeaderValue('targetBeam');
      while (beamOrder.length < targetBeam) beamOrder.push(null);

      let firstIncompleteIndex = -1;
      for (let i = 0; i < beamOrder.length; i++) {
        const b = beamOrder[i];
        if (!b || !completedBeams.includes(b)) { firstIncompleteIndex = i; break; }
      }

      if (activeRowIndex !== -1 && activeRowIndex < beamOrder.length) {
        const b = beamOrder[activeRowIndex];
        if (b && completedBeams.includes(b)) { activeRowIndex = -1; isMOStarted = false; }
      }

      const panjangPerBeam = getPanjangTargetNumerik();
      const operatorName  = (document.getElementById('opName')  || {}).innerText || '';
      const operatorShift = (document.getElementById('opShift') || {}).innerText || '';
      const shiftOptions  = getShiftOptions();

      for (let i = 0; i < beamOrder.length; i++) {
        const beamKey = beamOrder[i];
        const data = beamKey ? getBeam(beamKey) : null;
        const isCompleted = beamKey ? completedBeams.includes(beamKey) : false;
        const isEditable = (i === activeRowIndex) && !isCompleted && isMOStarted;
        const isLocked = !isEditable && !isCompleted && isMOStarted;
        const isStartable = !isMOStarted && !isCompleted && (i === firstIncompleteIndex);

        const row = document.createElement('tr');
        if (isCompleted) row.classList.add('completed');
        else if (isEditable) row.classList.add('active-row');
        else if (isLocked) row.classList.add('locked');
        else if (!isMOStarted && i === firstIncompleteIndex) row.classList.add('empty-row');
        else if (!isMOStarted) row.classList.add('locked');

        let panjangMeter = '-', beratStr = '-';
        let ui = '-', speed = '-', winding = '-', cacat = '', grade = '', ua = '-', amplasChecked = false;
        let waktuMulai = '-', waktuSelesai = '-';

        if (data) {
          const panjangAktual = (data.panjang !== undefined && data.panjang !== null) ? data.panjang : panjangPerBeam;
          panjangMeter = Math.round(panjangAktual);
          beratStr = hitungBerat(panjangAktual).toFixed(2);
          ui = data.ui || '-';
          speed = (data.speed !== undefined && data.speed !== null) ? data.speed : '-';
          winding = (data.winding !== null && data.winding !== undefined) ? data.winding : '-';
          cacat = data.cacat || '';
          grade = data.grade || '';
          ua = (data.ua !== null && data.ua !== undefined) ? data.ua : '-';
          amplasChecked = !!data.amplas;
          waktuMulai = (beamData[beamKey] && beamData[beamKey].waktuMulai) || '-';
          waktuSelesai = isCompleted ? ((beamData[beamKey] && beamData[beamKey].waktuSelesai) || formatTime(new Date())) : '-';
        }

        // No
        appendTextCell(row, i + 1);

        // Beam
        const beamTd = document.createElement('td');
        if (isEditable) beamTd.appendChild(buildBeamSelect(i, beamKey));
        else beamTd.textContent = beamKey || '-';
        row.appendChild(beamTd);

        // UI (selalu read-only — melekat pada data fisik beam)
        appendTextCell(row, ui);
        // Speed (default dari Speed Target header, tetap bisa diedit)
        appendFieldCell(row, isEditable, beamKey, 'speed', speed, 'number');
        // Panjang (default dari Order per Beam, bisa diedit; mengubahnya
        // langsung memperbarui Berat di baris yang sama)
        {
          const panjangTd = document.createElement('td');
          if (isEditable && beamKey) {
            const panjangInput = buildTextInput(beamKey, 'panjang', panjangMeter, 'number', (savedValue) => {
              const beratCell = panjangTd.closest('tr').cells[9];
              if (beratCell) beratCell.textContent = hitungBerat(savedValue).toFixed(2);
              updateEstimasiSisa();
            });
            panjangTd.appendChild(panjangInput);
          } else {
            panjangTd.textContent = panjangMeter;
          }
          row.appendChild(panjangTd);
        }
        // Winding
        appendFieldCell(row, isEditable, beamKey, 'winding', winding, 'number');
        // Cacat (teks bebas — lihat keterangan di bawah tabel)
        appendFieldCell(row, isEditable, beamKey, 'cacat', cacat, 'text');
        // Grade (dropdown A-C, default "A")
        appendChoiceCell(row, isEditable, beamKey, 'grade', grade, GRADE_OPTIONS);
        // UA
        appendFieldCell(row, isEditable, beamKey, 'ua', ua, 'text');
        // Berat (read-only)
        appendTextCell(row, beratStr);

        // Amplas (checkbox)
        const amplasTd = document.createElement('td');
        const amplasCheckbox = document.createElement('input');
        amplasCheckbox.type = 'checkbox';
        amplasCheckbox.className = 'amplas-checkbox';
        amplasCheckbox.checked = amplasChecked;
        amplasCheckbox.disabled = !isEditable || isCompleted || !beamKey;
        amplasCheckbox.addEventListener('change', () => toggleAmplas(beamKey, amplasCheckbox.checked));
        amplasTd.appendChild(amplasCheckbox);
        row.appendChild(amplasTd);

        // Operator, Shift, Waktu Mulai, Waktu Selesai
        appendFieldCell(row, isEditable, operatorName, 'opName', operatorName, 'text');
        appendChoiceCell(row, isEditable, operatorShift, 'opShift', operatorShift, shiftOptions);
        appendTextCell(row, waktuMulai);
        appendTextCell(row, waktuSelesai);

        // Status
        const statusTd = document.createElement('td');
        statusTd.className = 'status-cell';
        let statusText = 'Kosong', statusClass = 'status-empty';
        if (isCompleted) { statusText = 'Selesai'; statusClass = 'status-completed'; }
        else if (isEditable) { statusText = 'Aktif'; statusClass = 'status-pending'; }
        else if (isLocked) { statusText = 'Terkunci'; statusClass = 'status-locked'; }
        else if (!isMOStarted && i === firstIncompleteIndex) { statusText = 'Siap'; statusClass = 'status-empty'; }
        else if (!isMOStarted) { statusText = 'Belum Mulai'; statusClass = 'status-empty'; }
        statusTd.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
        row.appendChild(statusTd);

        // Aksi
        const actionTd = document.createElement('td');
        actionTd.className = 'action-cell';
        if (isCompleted) {
          const hapusBtn = document.createElement('button');
          hapusBtn.className = 'btn-hapus';
          hapusBtn.textContent = 'Hapus';
          hapusBtn.addEventListener('click', () => requestDelete(hapusBtn, beamKey));
          actionTd.appendChild(hapusBtn);
        } else if (isEditable) {
          const doneBtn = document.createElement('button');
          doneBtn.textContent = 'Selesaikan';
          doneBtn.style.background = '#4caf50';
          doneBtn.addEventListener('click', () => completeBeam(i));
          actionTd.appendChild(doneBtn);
        } else if (isStartable) {
          const startBtn = document.createElement('button');
          startBtn.textContent = '▶ Start';
          startBtn.style.background = '#2196F3';
          startBtn.addEventListener('click', () => startRow(i));
          actionTd.appendChild(startBtn);
        } else {
          actionTd.innerHTML = `<span style="color:#999; font-size:0.85em;">-</span>`;
        }
        row.appendChild(actionTd);

        tbody.appendChild(row);
      }

      const completedCountEl = document.getElementById('completedCount');
      if (completedCountEl) completedCountEl.textContent = `${completedBeams.length} / ${targetBeam} Selesai`;

      if (isMOStarted && completedBeams.length >= targetBeam) {
        let finishBtn = document.getElementById('finishBtn');
        if (!finishBtn) {
          const estimasiBox = document.querySelector('.operator-estimasi-box') || document.querySelector('.estimasi-box');
          if (estimasiBox) {
            finishBtn = document.createElement('button');
            finishBtn.id = 'finishBtn';
            finishBtn.className = 'operator-btn-selesai';
            finishBtn.textContent = '✅ Selesai - Lanjut';
            finishBtn.onclick = finishMO;
            finishBtn.style.marginLeft = 'auto';
            estimasiBox.appendChild(finishBtn);
          }
        }
      } else {
        const finishBtn = document.getElementById('finishBtn');
        if (finishBtn) finishBtn.remove();
      }
    }

    // ---- Start row ----
    function startRow(rowIndex) {
      if (isMOStarted) { alert('Pekerjaan sudah dimulai! Selesaikan row aktif terlebih dahulu.'); return; }
      if (rowIndex >= beamOrder.length) { alert('Baris tidak valid.'); return; }
      const b = beamOrder[rowIndex];
      if (b && completedBeams.includes(b)) { alert('Beam ini sudah selesai!'); return; }
      let firstIncomplete = -1;
      for (let i = 0; i < beamOrder.length; i++) {
        const bi = beamOrder[i];
        if (!bi || !completedBeams.includes(bi)) { firstIncomplete = i; break; }
      }
      if (rowIndex !== firstIncomplete) { alert('Hanya baris pertama yang belum selesai yang dapat di-start!'); return; }
      isMOStarted = true;
      activeRowIndex = rowIndex;
      renderTable();
      updateEstimasiSisa();
    }

    // ---- Complete beam ----
    function completeBeam(rowIndex) {
      const beamKey = beamOrder[rowIndex];
      if (!beamKey) { alert('Pilih beam terlebih dahulu!'); return; }
      if (completedBeams.includes(beamKey)) { alert('Beam ini sudah selesai!'); return; }
      const data = getBeam(beamKey);
      if (data.winding === null || data.winding === undefined || data.winding === '-') { alert('Winding harus diisi!'); return; }
      if (data.ua === null || data.ua === undefined || data.ua === '-') { alert('UA harus diisi!'); return; }
      if (!data.grade) { alert('Grade harus dipilih!'); return; }

      const panjangAktual = (data.panjang !== undefined && data.panjang !== null) ? data.panjang : getPanjangTargetNumerik();
      const confirmMsg =
        `Selesaikan Beam ${beamKey}?\n\n` +
        `Data Beam:\n` +
        `UI: ${data.ui}\n` +
        `Speed: ${data.speed || '-'} RPM\n` +
        `Panjang: ${Math.round(panjangAktual)} m\n` +
        `Winding: ${data.winding}\n` +
        `Grade: ${data.grade}\n` +
        `UA: ${data.ua}\n` +
        `Amplas: ${data.amplas ? 'Sudah' : 'Belum'}\n` +
        `Cacat: ${data.cacat || '-'}\n\n` +
        `Apakah beam ini sudah selesai dikerjakan?`;
      if (!confirm(confirmMsg)) return;

      defaultWinding = data.winding;
      defaultUA = data.ua;

      completedBeams.push(beamKey);
      if (!beamData[beamKey]) beamData[beamKey] = {};
      beamData[beamKey].waktuSelesai = formatTime(new Date());
      if (!beamData[beamKey].waktuMulai) beamData[beamKey].waktuMulai = formatTime(new Date());

      activeRowIndex = -1;
      isMOStarted = false;

      updateEstimasiSisa();
      renderTable();
    }

    // ---- Hapus (password-protected) ----
    function requestDelete(btn, beamKey) {
      const td = btn.parentNode;
      td.innerHTML = '';

      const passInput = document.createElement('input');
      passInput.type = 'password';
      passInput.placeholder = 'Pass';

      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.style.cssText = 'background:#27ae60;';
      okBtn.addEventListener('click', () => confirmDelete(okBtn, beamKey, passInput.value));

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Batal';
      cancelBtn.style.cssText = 'background:#95a5a6;';
      cancelBtn.addEventListener('click', () => cancelDelete(cancelBtn, beamKey));

      td.appendChild(passInput);
      td.appendChild(okBtn);
      td.appendChild(cancelBtn);
      passInput.focus();
    }

    function renderHapusButton(td, beamKey) {
      td.innerHTML = '';
      const hapusBtn = document.createElement('button');
      hapusBtn.className = 'btn-hapus';
      hapusBtn.textContent = 'Hapus';
      hapusBtn.addEventListener('click', () => requestDelete(hapusBtn, beamKey));
      td.appendChild(hapusBtn);
    }

    function confirmDelete(btn, beamKey, pass) {
      const td = btn.parentNode;
      if (pass === ADMIN_PASS) {
        const idx = completedBeams.indexOf(beamKey);
        if (idx !== -1) {
          completedBeams.splice(idx, 1);
          if (beamData[beamKey]) delete beamData[beamKey].waktuSelesai;
          const rowIdx = beamOrder.indexOf(beamKey);
          if (rowIdx !== -1) beamOrder[rowIdx] = null;
          activeRowIndex = -1;
          isMOStarted = false;
        }
        updateEstimasiSisa();
        renderTable();
      } else {
        alert('Password salah!');
        renderHapusButton(td, beamKey);
      }
    }

    function cancelDelete(btn, beamKey) {
      renderHapusButton(btn.parentNode, beamKey);
    }

    // ---- Finish MO ----
    function finishMO() {
      if (confirm('MO akan diselesaikan. Yakin?')) location.reload();
    }

    // ---- Operator Init ----
    function init() {
      if (!document.getElementById('tableBody') && !document.getElementById('beamTable')) return; // not operator page
      const targetBeam = getHeaderValue('targetBeam');
      beamOrder = new Array(targetBeam).fill(null);
      completedBeams = [];
      beamData = {};
      beamRuntime = {};
      isMOStarted = false;
      activeRowIndex = -1;
      defaultWinding = null;
      defaultUA = null;
      renderTable();
      updateEstimasiSisa();
    }

    return { init, renderTable, startRow, completeBeam,
             requestDelete, confirmDelete, cancelDelete,
             finishMO, updateEstimasiSisa };
  })();


  // ============================================================
  // MODULE: SupervisorView  (read-only per-machine plan, for the field
  // supervisor screens — card list and mini-Gantt both read from here /
  // from Renderer.deriveBlockStatus so they can never drift out of sync
  // with how the planner itself classifies a block's status.)
  // ============================================================
  const SupervisorView = (() => {
    function _fmtZonedTime(date) {
      const z = AppTime.toZoned(date);
      return `${String(z.getUTCHours()).padStart(2, '0')}:${String(z.getUTCMinutes()).padStart(2, '0')}`;
    }

    function _fmtZonedDayTime(date) {
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const z = AppTime.toZoned(date);
      return `${dayNames[z.getUTCDay()]} ${z.getUTCDate()} ${months[z.getUTCMonth()]} ${_fmtZonedTime(date)}`;
    }

    function formatClock() {
      const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const z = AppTime.toZoned(new Date());
      return `🕒 ${dayNames[z.getUTCDay()]}, ${z.getUTCDate()} ${months[z.getUTCMonth()]} — ${_fmtZonedTime(new Date())} ${AppTime.getLabel()}`;
    }

    function _mosForMachine(machineId) {
      return DataStore.getMOs()
        .filter(mo => mo.machine_id === machineId && mo.gantt_status !== 'unscheduled')
        .sort((a, b) => new Date(a.planned_start) - new Date(b.planned_start));
    }

    function _statusBadgeHTML(statusClass) {
      const map = {
        running:   '<span class="badge badge-running">⚙️ Running</span>',
        trouble:   '<span class="badge badge-trouble">🔴 Trouble</span>',
        fixed:     '<span class="badge badge-fixed">🔒 Fixed</span>',
        scheduled: '<span class="badge badge-scheduled">✔ Scheduled</span>',
      };
      return map[statusClass] || '';
    }

    function _moRowHTML(mo, machine) {
      const info = Renderer.deriveBlockStatus(mo, machine);
      const start = mo.planned_start ? new Date(mo.planned_start) : null;
      const end = mo.planned_end ? new Date(mo.planned_end) : null;
      const timeRange = (start && end) ? `${_fmtZonedDayTime(start)}–${_fmtZonedTime(end)} ${AppTime.getLabel()}` : '-';
      return `
        <div class="supervisor-mo-row">
          <strong>${mo.mo_id}</strong> ${_statusBadgeHTML(info.statusClass)}
          <div class="supervisor-mo-sub">🧵 ${mo.yarn_label || '-'}${mo.lot ? ' | ' + mo.lot : ''}</div>
          <div class="supervisor-mo-sub">📦 ${mo.target_beam || '-'} beam &nbsp;|&nbsp; ⏱️ ${timeRange}</div>
        </div>
      `;
    }

    function _machineYarnLineHTML(machine) {
      if (!machine.active_yarn) return 'Tidak ada benang terpasang';
      const { jenis, lot, sisa_panjang_m } = machine.active_yarn;
      let line = `🧵 ${lot ? `${jenis} | ${lot}` : jenis}`;
      if (typeof sisa_panjang_m === 'number') line += ` (sisa ~${Math.round(sisa_panjang_m).toLocaleString('id-ID')}m)`;
      return line;
    }

    // ---- V1: card list ----
    function renderMachineCards() {
      const container = document.getElementById('supervisorCards');
      if (!container) return;
      const searchEl = document.getElementById('supervisorSearch');
      const searchVal = searchEl ? searchEl.value.trim().toLowerCase() : '';

      const machines = DataStore.getMachines()
        .filter(m => !searchVal || (m.name || '').toLowerCase().includes(searchVal))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      container.innerHTML = '';
      machines.forEach(machine => {
        const current = [];
        const upcoming = [];
        _mosForMachine(machine.id).forEach(mo => {
          const info = Renderer.deriveBlockStatus(mo, machine);
          (info.statusClass === 'running' || info.statusClass === 'trouble' ? current : upcoming).push(mo);
        });

        const dotClass = machine.iot_status === 'running' ? 'ico-dot-green'
          : (machine.iot_status === 'rusak' || machine.iot_status === 'benang_putus') ? 'ico-dot-red'
          : 'ico-dot-grey';

        let bodyHTML = '';
        if (current.length) {
          bodyHTML += `<div class="supervisor-section-label">▶ Sedang Berjalan</div>${current.map(mo => _moRowHTML(mo, machine)).join('')}`;
        }
        if (upcoming.length) {
          bodyHTML += `<div class="supervisor-section-label">▷ Antrean Berikutnya</div>${upcoming.map(mo => _moRowHTML(mo, machine)).join('')}`;
        }
        if (!current.length && !upcoming.length) {
          bodyHTML = `<div class="supervisor-empty">Belum ada rencana untuk mesin ini.</div>`;
        }

        const card = document.createElement('div');
        card.className = 'supervisor-card';
        if (machine.iot_status === 'running') card.classList.add('running-well');
        else if (machine.iot_status === 'rusak' || machine.iot_status === 'benang_putus') card.classList.add('machine-trouble');
        card.innerHTML = `
          <div class="supervisor-card-header">
            <span class="ico ico-dot ${dotClass}"></span>
            <span class="supervisor-machine-name">${machine.name}</span>
          </div>
          <div class="supervisor-yarn-line">${_machineYarnLineHTML(machine)}</div>
          ${bodyHTML}
        `;
        container.appendChild(card);
      });
    }

    return { renderMachineCards, formatClock };
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
  let draggedData    = null; // { moId, yarn, lot, stockReady, fromMachineId }
  let draggedElement = null;

  // machine.active_yarn only stores the short "jenis" plus count/lembar
  // separately, while an MO's yarn_label is the composed "jenis count/lembar"
  // string (e.g. "POLY DTY SD 150-48/480") — rebuild the same composed form
  // here so the two are actually comparable instead of always mismatching.
  function _machineActiveYarnLabel(machine) {
    if (!machine || !machine.active_yarn || !machine.active_yarn.jenis) return null;
    const { jenis, count, lembar } = machine.active_yarn;
    return (count && lembar) ? `${jenis} ${count}/${lembar}` : jenis;
  }

  // Same yarn type AND same lot — lot is a production/batch id, so two
  // cheeses of the "same" yarn type but different lots are still a
  // different physical cheese and should not share remaining-length state.
  function _machineYarnMatchesMO(machine, mo) {
    if (!machine || !machine.active_yarn || !mo) return false;
    const labelMatches = _machineActiveYarnLabel(machine) === mo.yarn_label;
    const lotMatches = !!(machine.active_yarn.lot && mo.lot && machine.active_yarn.lot === mo.lot);
    return labelMatches && lotMatches;
  }

  // Total yarn length this MO will consume across all its beams — this is
  // "how much must be on the cheese for the whole MO to run without a
  // change", per the denier formula (denier = grams per 9000m of ONE end;
  // a cheese feeds exactly one end, so lembar doesn't factor in here).
  function _requiredLengthForMO(mo) {
    return (mo.order_per_beam_m || 0) * (mo.target_beam || 0);
  }

  function _cheeseLengthFromKg(kg, denier) {
    return denier > 0 ? (kg * 9000000) / denier : 0;
  }

  // Bundles the "does this machine's yarn situation work for this MO" check
  // used by both the dragover preview and the drop handler, so they can't
  // drift out of sync with each other.
  function _assessCheeseFit(machine, mo) {
    const needsNewCheese = !_machineYarnMatchesMO(machine, mo);
    const requiredM = _requiredLengthForMO(mo);
    const knownRemainingM = (!needsNewCheese && machine.active_yarn && typeof machine.active_yarn.sisa_panjang_m === 'number')
      ? machine.active_yarn.sisa_panjang_m : null;
    const insufficientExisting = knownRemainingM !== null && knownRemainingM < requiredM;
    return { needsNewCheese, requiredM, knownRemainingM, insufficientExisting };
  }

  function initDragDrop() {
    const ganttContainer = document.getElementById('ganttScroll');
    const snapGhost       = document.getElementById('snapGhost');
    const tableSection    = document.getElementById('tableSection');
    const tbody           = document.getElementById('moTableBody');
    if (!ganttContainer || !snapGhost || !tbody) return;

    tbody.addEventListener('dragstart', (e) => {
      const row = e.target.closest('tr.draggable-row');
      if (!row) return;
      const mo = DataStore.getMOById(row.dataset.moId);
      if (!mo) return;
      row.classList.add('dragging-row');
      draggedElement = null;
      draggedData = {
        moId: mo.mo_id, yarn: mo.yarn_label, lot: mo.lot,
        stockReady: mo.stock_status === 'ready', fromMachineId: null,
      };
    });
    tbody.addEventListener('dragend', (e) => {
      const row = e.target.closest('tr');
      if (row) row.classList.remove('dragging-row');
      snapGhost.style.display = 'none';
    });

    ganttContainer.addEventListener('dragstart', (e) => {
      const block = e.target.closest('.planner-gantt-block');
      if (!block || block.getAttribute('draggable') === 'false') { e.preventDefault(); return; }
      block.classList.add('dragging-block');
      draggedElement = block;
      const track = block.closest('.planner-drop-track');
      const mo = DataStore.getMOById(block.dataset.id);
      if (!mo) return;
      draggedData = {
        moId: mo.mo_id, yarn: mo.yarn_label, lot: mo.lot,
        stockReady: mo.stock_status === 'ready',
        fromMachineId: track ? track.dataset.machine : null,
      };
    });
    ganttContainer.addEventListener('dragend', (e) => {
      const block = e.target.closest('.planner-gantt-block');
      if (block) block.classList.remove('dragging-block');
      snapGhost.style.display = 'none';
      snapGhost.classList.remove('warn-ghost');
    });

    ganttContainer.addEventListener('dragover', (e) => {
      const track = e.target.closest('.planner-drop-track');
      if (!track || !draggedData) return;
      e.preventDefault();

      const rect = track.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const snapUnit = Scheduler.getPxPerHour(); // snap to whole hours, matching the header ticks
      const snappedX = Math.round(mouseX / snapUnit) * snapUnit;

      const machineId = track.dataset.machine;
      const machine = DataStore.getMachineById(machineId);
      const mo = DataStore.getMOById(draggedData.moId);
      const duration = Scheduler.getDurationForMO(mo, machine);
      const widthPx = Scheduler.durationToWidth(duration);

      track.appendChild(snapGhost);
      snapGhost.style.display = 'flex';
      snapGhost.style.left = `${snappedX}px`;
      snapGhost.style.width = `${widthPx}px`;

      const fit = _assessCheeseFit(machine, mo);
      const reroute = !!(draggedData.fromMachineId && draggedData.fromMachineId !== machineId);

      if (fit.needsNewCheese || fit.insufficientExisting || reroute) {
        snapGhost.classList.add('warn-ghost');
        const tag = fit.needsNewCheese ? ' - CHEESE BARU!' : fit.insufficientExisting ? ' - YARN KURANG!' : '';
        snapGhost.innerHTML = `⚠️ ${machineId} (${duration} mnt)${tag}`;
      } else {
        snapGhost.classList.remove('warn-ghost');
        const totalMinutes = (snappedX / snapUnit) * 60;
        snapGhost.innerHTML = `📍 ${Scheduler.formatTime(totalMinutes)} ${AppTime.getLabel()} (${duration} mnt)`;
      }
    });

    ganttContainer.addEventListener('dragleave', (e) => {
      if (e.target.closest('.planner-drop-track')) snapGhost.style.display = 'none';
    });

    ganttContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const track = e.target.closest('.planner-drop-track');
      if (!track || !draggedData) return;
      snapGhost.style.display = 'none';

      const rect = track.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const snapUnit = Scheduler.getPxPerHour();
      const snappedX = Math.round(mouseX / snapUnit) * snapUnit;
      const machineId = track.dataset.machine;
      const machine = DataStore.getMachineById(machineId);
      const mo = DataStore.getMOById(draggedData.moId);
      const fit = _assessCheeseFit(machine, mo);
      const reroute = !!(draggedData.fromMachineId && draggedData.fromMachineId !== machineId);

      if (fit.needsNewCheese || fit.insufficientExisting || reroute) {
        showRerouteWarning(draggedData, machineId, snappedX, track, fit, reroute);
        return;
      }
      executeDrop(draggedData, machineId, snappedX, track, false, 0, { needsNewCheese: false });
    });

    // Dropping a scheduled block back onto the MO table cancels its schedule.
    if (tableSection) {
      tableSection.addEventListener('dragover', (e) => {
        if (!draggedElement || !draggedData) return;
        e.preventDefault();
        tbody.classList.add('drop-highlight');
      });
      tableSection.addEventListener('dragleave', () => tbody.classList.remove('drop-highlight'));
      tableSection.addEventListener('drop', (e) => {
        e.preventDefault();
        tbody.classList.remove('drop-highlight');
        if (!draggedElement || !draggedData) return;
        const mo = DataStore.getMOById(draggedData.moId);
        if (!mo) return;
        if (mo.gantt_status === 'fixed') {
          Renderer.showNotification(`${mo.mo_id} sudah Fixed — Unfix dahulu sebelum dibatalkan.`, 'warn');
          return;
        }
        Renderer.removeScheduledBlock(draggedElement, mo.mo_id);
        draggedElement = null;
        draggedData = null;
      });
    }
  }


  // ============================================================
  // PLANNER — Reroute warning modal & execute drop
  // ============================================================
  let pendingReroute = null;

  function showRerouteWarning(data, targetMachineId, snappedX, track, fit, reroute) {
    pendingReroute = { data, targetMachineId, snappedX, track, needsNewCheese: fit.needsNewCheese };
    const setupGroup = document.getElementById('setupDurationGroup');
    const cheeseGroup = document.getElementById('cheeseKgGroup');
    let warnMsg = `Tempatkan <strong>${data.moId}</strong> (Benang: ${data.yarn}) ke <strong>${targetMachineId}</strong>.<br><br>`;

    if (fit.needsNewCheese) {
      warnMsg += `<span style="color:#f97316;font-weight:bold;">⚠️ BENANG/LOT BERBEDA!</span> Mesin ini perlu cheese baru.<br>`;
      warnMsg += `Masukkan durasi pasang benang (creel) dan berat cheese baru:<br>`;
      if (setupGroup) setupGroup.style.display = 'flex';
      if (cheeseGroup) cheeseGroup.style.display = 'flex';
    } else {
      if (setupGroup) setupGroup.style.display = 'none';
      if (cheeseGroup) cheeseGroup.style.display = 'none';
    }

    if (fit.insufficientExisting) {
      warnMsg += `<br><span style="color:#f87171;">🔴 Sisa yarn di mesin ini ~${Math.round(fit.knownRemainingM).toLocaleString('id-ID')}m, MO ini butuh ~${Math.round(fit.requiredM).toLocaleString('id-ID')}m — kemungkinan perlu ganti cheese di tengah produksi.</span><br>`;
    }
    if (reroute) {
      warnMsg += `⚡ Anda memindahkan order dari <strong>${data.fromMachineId}</strong> ke <strong>${targetMachineId}</strong>.<br>`;
    }
    if (!data.stockReady) warnMsg += `<br><span style="color:#f87171;">🔴 Stok belum Ready! Pastikan tersedia.</span>`;

    const textEl = document.getElementById('modalTextContent');
    const overlay = document.getElementById('warningModal');
    if (textEl) textEl.innerHTML = warnMsg;
    if (overlay) overlay.classList.add('active');
  }

  function closeModal() {
    const overlay = document.getElementById('warningModal');
    if (overlay) overlay.classList.remove('active');
    const setupGroup = document.getElementById('setupDurationGroup');
    if (setupGroup) setupGroup.style.display = 'none';
    const cheeseGroup = document.getElementById('cheeseKgGroup');
    if (cheeseGroup) cheeseGroup.style.display = 'none';
    pendingReroute = null;
  }

  // cheeseInfo: { needsNewCheese, kg } — kg is the newly-entered cheese
  // weight, only meaningful when needsNewCheese is true.
  function executeDrop(data, targetMachineId, snappedX, track, isRerouted, extraSetupMin, cheeseInfo) {
    const mo = DataStore.getMOById(data.moId);
    if (!mo) return;
    if (draggedElement && data.fromMachineId) { draggedElement.remove(); draggedElement = null; }
    if (!data.stockReady && !isRerouted) {
      if (!confirm(`⚠️ Stok ${data.moId} belum Ready. Lanjutkan?`)) return;
    }

    const machine = DataStore.getMachineById(targetMachineId);
    const duration = Scheduler.getDurationForMO(mo, machine) + (extraSetupMin || 0);
    const startDate = Scheduler.offsetToDate(snappedX);
    const endDate = new Date(startDate.getTime() + duration * 60000);

    DataStore.updateMOStatus(mo.mo_id, {
      machine_id: targetMachineId,
      planned_start: startDate.toISOString(),
      planned_end: endDate.toISOString(),
      gantt_status: 'scheduled',
    });

    // Track the yarn this scheduling decision consumes: either a fresh
    // cheese (whatever kg was entered) or more of what's already mounted.
    const requiredM = _requiredLengthForMO(mo);
    if (cheeseInfo && cheeseInfo.needsNewCheese) {
      const yt = DataStore.getYarnTypes().find(y => y.id === mo.yarn_type_id);
      const kg = cheeseInfo.kg || 0;
      const denier = mo.denier || (yt && yt.denier) || 0;
      const panjangAwalM = _cheeseLengthFromKg(kg, denier);
      DataStore.updateMachineActiveYarn(targetMachineId, {
        jenis: yt ? yt.jenis : mo.yarn_label,
        count: yt ? yt.count : '',
        lot: mo.lot,
        lembar: mo.lembar,
        kg_per_cheese: kg,
        sisa_panjang_m: Math.max(0, panjangAwalM - requiredM),
      });
    } else if (machine && machine.active_yarn && typeof machine.active_yarn.sisa_panjang_m === 'number') {
      DataStore.updateMachineActiveYarn(targetMachineId, {
        sisa_panjang_m: Math.max(0, machine.active_yarn.sisa_panjang_m - requiredM),
      });
    }

    const updatedMachine = DataStore.getMachineById(targetMachineId);
    const updatedMo = DataStore.getMOById(mo.mo_id);
    const block = Renderer.createGanttBlock(track, updatedMo, updatedMachine, snappedX, duration, { statusClass: 'scheduled', locked: false }, extraSetupMin || 0);
    if (isRerouted || extraSetupMin > 0) {
      block.style.background = '#0369a1';
      block.style.borderLeft = '5px solid #eab308';
      const h1 = block.querySelector('.block-header span:first-child');
      if (h1) h1.innerHTML = `⚡ [REROUTE] ${updatedMo.mo_id}`;
    }

    Renderer.renderMOTable();
    Renderer.updateMachineLabels();
    Renderer.showNotification(`${updatedMo.mo_id} dijadwalkan di ${targetMachineId} (${duration} mnt).`, 'info');
  }

  function filterTable() { Renderer.renderMOTable(); }


  // ============================================================
  // EXPOSE globals + App namespace
  // ============================================================
  window.App = { AppTime, DataStore, Scheduler, Renderer, OperatorView, SupervisorView, IoTHandler };

  // ============================================================
  // ENTRY POINTS
  // ============================================================
  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body && document.body.dataset.page;

    // --- Planner entry point ---
    if (page === 'planner') {
      await DataStore.load('./dummy_data.json');
      const cfg = DataStore.getConfig();
      Scheduler.configureZoom(cfg.gantt_zoom_default_px_per_hour, cfg.gantt_zoom_min_px_per_hour, cfg.gantt_zoom_max_px_per_hour);
      Renderer.init();
      Renderer.renderTimelineHeader();
      Renderer.renderGantt();
      Renderer.renderMOTable();
      Renderer.initColumnResize();
      Renderer.initTroubleSim();
      Renderer.initHeaderZoomDrag();
      initDragDrop();

      const searchEl = document.getElementById('searchInput');
      const statusEl = document.getElementById('statusFilter');
      if (searchEl) searchEl.addEventListener('input', filterTable);
      if (statusEl) statusEl.addEventListener('change', filterTable);

      const navBtn = document.getElementById('btnScrollToday');
      if (navBtn) navBtn.addEventListener('click', Renderer.scrollToToday);

      const troubleBtn = document.getElementById('btnToggleTrouble');
      if (troubleBtn) troubleBtn.addEventListener('click', Renderer.toggleTrouble);

      const cancelModalBtn = document.getElementById('btnCancelModal');
      if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

      const confirmBtn = document.getElementById('btnConfirmReroute');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (!pendingReroute) return;
          const { data, targetMachineId, snappedX, track, needsNewCheese } = pendingReroute;
          const setupInput = document.getElementById('setupDurationInput');
          const kgInput = document.getElementById('cheeseKgInput');
          const extra = needsNewCheese ? (parseInt(setupInput && setupInput.value, 10) || 45) : 0;
          const kg = needsNewCheese ? (parseFloat(kgInput && kgInput.value) || 0) : 0;
          executeDrop(data, targetMachineId, snappedX, track, true, extra, { needsNewCheese, kg });
          closeModal();
        });
      }

      const nowLineIntervalSec = (DataStore.getConfig().now_line_update_interval_sec) || 60;
      setInterval(Renderer.updateNowLine, nowLineIntervalSec * 1000);
      setTimeout(Renderer.scrollToToday, 300);
      return;
    }

    // --- Operator entry point ---
    if (page === 'operator') {
      await DataStore.load('./dummy_data.json');
      OperatorView.init();
      return;
    }

    // --- Supervisor entry points (read-only) ---
    if (page === 'supervisor-list') {
      await DataStore.load('./dummy_data.json');
      SupervisorView.renderMachineCards();

      const searchEl = document.getElementById('supervisorSearch');
      if (searchEl) searchEl.addEventListener('input', SupervisorView.renderMachineCards);

      const clockEl = document.getElementById('supervisorClock');
      function tickClock() { if (clockEl) clockEl.textContent = SupervisorView.formatClock(); }
      tickClock();
      setInterval(tickClock, 30000);

      const refreshSec = (DataStore.getConfig().now_line_update_interval_sec) || 60;
      setInterval(SupervisorView.renderMachineCards, refreshSec * 1000);
      return;
    }

    if (page === 'supervisor-gantt') {
      await DataStore.load('./dummy_data.json');
      const cfg = DataStore.getConfig();
      Scheduler.configureZoom(cfg.gantt_zoom_default_px_per_hour, cfg.gantt_zoom_min_px_per_hour, cfg.gantt_zoom_max_px_per_hour);
      Renderer.init();
      Renderer.renderTimelineHeader();
      Renderer.renderGantt(false); // read-only: no drag, no fix/unfix/remove buttons

      const navBtn = document.getElementById('btnScrollToday');
      if (navBtn) navBtn.addEventListener('click', Renderer.scrollToToday);

      const clockEl = document.getElementById('supervisorClock');
      function tickClock() { if (clockEl) clockEl.textContent = SupervisorView.formatClock(); }
      tickClock();
      setInterval(tickClock, 30000);

      const nowLineIntervalSec = (cfg.now_line_update_interval_sec) || 60;
      setInterval(Renderer.updateNowLine, nowLineIntervalSec * 1000);
      setTimeout(Renderer.scrollToToday, 300);
    }
  });

})();
