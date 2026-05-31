/* ============================================================================
   EVENT DRAWER FORM — client-side time logic
   ============================================================================
   Behaviors:
     - On `start_time` blur, snap to nearest half-hour (preferring round-up
       for in-flight typing).
     - When `start_date` or `start_time` changes AND the user hasn't
       hand-edited `end`, auto-fill `end_date` + `end_time` to start + 60min.
     - When the all-day toggle is on, hide both time inputs and force the
       end-date to equal start-date.

   Exposed:
     window.lf.ui.eventDrawerForm.bind(formEl)

   Auto-init: the drawer template renders an inline init script that calls
   bind(form) after every HTMX swap.
   ========================================================================= */
(function () {
    'use strict';
    window.lf = window.lf || {};
    if (window.lf.eventDrawerForm) return;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    /** snapToHalfHour("10:07") → "10:30"; "10:31" → "11:00"; "10:30" → "10:30" */
    function snapToHalfHour(hhmm) {
        if (!hhmm || hhmm.length < 4) return hhmm;
        var parts = hhmm.split(':');
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return hhmm;
        if (m === 0 || m === 30) return pad(h) + ':' + pad(m);
        if (m < 30) return pad(h) + ':30';
        // m > 30 → next hour
        h = (h + 1) % 24;
        return pad(h) + ':00';
    }

    /** Add `minutes` to "YYYY-MM-DD" + "HH:MM" → {date, time}. */
    function addMinutes(dateStr, timeStr, minutes) {
        if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };
        var parts = dateStr.split('-');
        var tparts = timeStr.split(':');
        if (parts.length !== 3 || tparts.length < 2) return { date: dateStr, time: timeStr };
        var d = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
            parseInt(tparts[0], 10),
            parseInt(tparts[1], 10),
            0, 0
        );
        if (isNaN(d.getTime())) return { date: dateStr, time: timeStr };
        d.setMinutes(d.getMinutes() + minutes);
        return {
            date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
            time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
        };
    }

    function bind(form) {
        var startDate = form.querySelector('[name="start_date"]');
        var startTime = form.querySelector('[name="start_time"]');
        var endDate   = form.querySelector('[name="end_date"]');
        var endTime   = form.querySelector('[name="end_time"]');
        var allDay    = form.querySelector('[name="all_day"]');
        var startRow  = form.querySelector('[data-event-time-row="start"]');
        var endRow    = form.querySelector('[data-event-time-row="end"]');

        if (!startDate || !startTime || !endDate || !endTime) return;

        // Track whether the user has manually touched the end fields.
        var endTouched = false;
        function markEndTouched() { endTouched = true; }
        endDate.addEventListener('input', markEndTouched);
        endTime.addEventListener('input', markEndTouched);

        function recomputeEnd() {
            if (endTouched) return;
            if (!startDate.value || !startTime.value) return;
            var snapped = snapToHalfHour(startTime.value);
            if (snapped !== startTime.value) startTime.value = snapped;
            var sum = addMinutes(startDate.value, startTime.value, 60);
            endDate.value = sum.date;
            endTime.value = sum.time;
        }

        startTime.addEventListener('blur', function () {
            startTime.value = snapToHalfHour(startTime.value);
            recomputeEnd();
        });
        startDate.addEventListener('change', recomputeEnd);
        startTime.addEventListener('change', recomputeEnd);

        function applyAllDayMode() {
            if (!allDay) return;
            var on = !!allDay.checked;
            // Toggle time-input visibility — keep date inputs always visible.
            [startTime, endTime].forEach(function (el) {
                var group = el && el.closest('.form-group');
                if (group) group.style.display = on ? 'none' : '';
            });
            if (on) {
                // Mirror dates so the form posts a coherent all-day record.
                if (startDate.value) endDate.value = startDate.value;
            }
        }
        if (allDay) allDay.addEventListener('change', applyAllDayMode);

        // Initial state
        applyAllDayMode();
        // If end is empty on load (typical for "add"), seed it once based on start.
        if (!endDate.value || !endTime.value) {
            if (startDate.value && startTime.value) recomputeEnd();
        } else {
            // Pre-populated (edit mode) — treat as touched so we don't overwrite.
            endTouched = true;
        }

        // Suppress unused-variable warnings (kept for future per-row hooks).
        void startRow; void endRow;
    }

    window.lf.ui = window.lf.ui || {};
    window.lf.ui.eventDrawerForm = {
        bind: bind,
        snapToHalfHour: snapToHalfHour,
        addMinutes: addMinutes,
    };
})();
