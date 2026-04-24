/**
 * Calendar Component
 * Handles view toggling, current-time indicator, and HTMX integration.
 *
 * No framework dependencies. Works with HTMX for server-driven navigation.
 *
 * Public API:
 *   Calendar.init()               — called once on DOMContentLoaded
 *   Calendar.updateCurrentTime()  — reposition time indicator
 *   Calendar.setView(view)        — programmatic view switch
 */

(function () {
    'use strict';

    // ========================================
    // CONSTANTS
    // ========================================

    var SLOT_HEIGHT_CSS_VAR = '--cal-slot-h';
    var HOUR_START_DEFAULT  = 7;   // 7 AM — first visible hour
    var REFRESH_INTERVAL    = 60 * 1000; // 1 minute

    // ========================================
    // HELPERS
    // ========================================

    /**
     * Returns the computed px value of a CSS custom property on :root.
     * Falls back to defaultPx if the variable is absent.
     */
    function getCSSVar(varName, defaultPx) {
        var raw = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();
        if (!raw) return defaultPx;
        // Handle rem values relative to root font-size
        if (raw.endsWith('rem')) {
            var rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
            return parseFloat(raw) * rootFontSize;
        }
        return parseFloat(raw) || defaultPx;
    }

    /**
     * Calculates the top offset (px) for the current time indicator.
     * @param {number} hourStart — first visible hour (integer, e.g. 7 for 7 AM)
     * @param {number} slotHeightPx — height of one hour slot in pixels
     */
    function calcCurrentTimeOffset(hourStart, slotHeightPx) {
        var now    = new Date();
        var hours  = now.getHours() + now.getMinutes() / 60;
        var offset = (hours - hourStart) * slotHeightPx;
        return Math.max(0, offset);
    }

    // ========================================
    // CURRENT TIME INDICATOR
    // ========================================

    var _timeRefreshTimer = null;

    /**
     * Reads data-hour-start from the calendar container and positions all
     * .calendar-current-time elements within .calendar-column containers.
     */
    function updateCurrentTime() {
        var calendars = document.querySelectorAll('.calendar--week, .calendar--day');
        calendars.forEach(function (cal) {
            var hourStart   = parseInt(cal.dataset.hourStart || HOUR_START_DEFAULT, 10);
            var slotPx      = getCSSVar(SLOT_HEIGHT_CSS_VAR, 48); // 3rem default
            var topPx       = calcCurrentTimeOffset(hourStart, slotPx);

            var indicators  = cal.querySelectorAll('.calendar-current-time');
            indicators.forEach(function (el) {
                el.style.top = topPx + 'px';
            });

            // Hide indicator when current time is before the visible range
            var now  = new Date();
            var isVisible = now.getHours() >= hourStart;
            indicators.forEach(function (el) {
                el.style.display = isVisible ? '' : 'none';
            });
        });
    }

    /** Scroll the time body so the current time is visible on load. */
    function scrollToCurrentTime() {
        var calendars = document.querySelectorAll('.calendar--week, .calendar--day');
        calendars.forEach(function (cal) {
            var body      = cal.querySelector('.calendar-time-body');
            if (!body) return;
            var hourStart = parseInt(cal.dataset.hourStart || HOUR_START_DEFAULT, 10);
            var slotPx    = getCSSVar(SLOT_HEIGHT_CSS_VAR, 48);
            var topPx     = calcCurrentTimeOffset(hourStart, slotPx);

            // Scroll so the indicator is ~2 slots from the top of the viewport
            var scrollTarget = Math.max(0, topPx - slotPx * 2);
            body.scrollTop = scrollTarget;
        });
    }

    // ========================================
    // VIEW TOGGLE
    // ========================================

    /**
     * Activates the correct view toggle button and updates aria-pressed states.
     * @param {HTMLElement} cal — the .calendar root element
     * @param {string}      view — "month" | "week" | "day"
     */
    function activateViewBtn(cal, view) {
        var btns = cal.querySelectorAll('.calendar-view-btn');
        btns.forEach(function (btn) {
            var isActive = btn.dataset.view === view;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    /**
     * Programmatic API: switch to a given view.
     * If the button has an hx-get, triggers the HTMX request.
     * Otherwise, dispatches a CustomEvent for the app to handle.
     *
     * @param {string} view — "month" | "week" | "day"
     * @param {HTMLElement|null} calRoot — specific calendar or null to target all
     */
    function setView(view, calRoot) {
        var calendars = calRoot
            ? [calRoot]
            : Array.from(document.querySelectorAll('.calendar'));

        calendars.forEach(function (cal) {
            activateViewBtn(cal, view);

            var btn = cal.querySelector('.calendar-view-btn[data-view="' + view + '"]');
            if (btn) {
                // If HTMX is available and the button has hx-get, trigger it
                if (window.htmx && btn.getAttribute('hx-get')) {
                    window.htmx.trigger(btn, 'click');
                } else {
                    btn.click();
                }
            }

            // Dispatch event for app-level listeners
            cal.dispatchEvent(new CustomEvent('calendar:view-change', {
                bubbles: true,
                detail: { view: view }
            }));
        });
    }

    // ========================================
    // EVENT DELEGATION
    // ========================================

    function onCalendarClick(e) {
        // View toggle button
        var viewBtn = e.target.closest('.calendar-view-btn');
        if (viewBtn) {
            var cal  = viewBtn.closest('.calendar');
            var view = viewBtn.dataset.view;
            if (cal && view) {
                activateViewBtn(cal, view);
                // Let HTMX handle the actual navigation if hx-get is present
            }
            return;
        }

        // Keyboard-accessible calendar cell (month view)
        var cell = e.target.closest('.calendar-cell');
        if (cell && !e.target.closest('.calendar-event-chip, .calendar-more-link')) {
            cell.dispatchEvent(new CustomEvent('calendar:day-click', {
                bubbles: true,
                detail: {
                    date: cell.dataset.date,
                    url:  cell.dataset.url
                }
            }));
            return;
        }
    }

    function onCalendarKeydown(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var cell = e.target.closest('.calendar-cell');
        if (cell) {
            e.preventDefault();
            cell.click();
        }
    }

    // ========================================
    // HTMX HOOKS
    // ========================================

    /**
     * Re-initialise time indicator and scroll after HTMX swaps calendar content.
     */
    function onHtmxSwap(e) {
        // Only care about swaps inside a calendar
        var target = e.detail && e.detail.elt;
        if (!target) return;
        if (!target.closest('.calendar') && !target.classList.contains('calendar')) return;

        updateCurrentTime();
        scrollToCurrentTime();
    }

    // ========================================
    // INIT
    // ========================================

    function init() {
        // Delegate events from document (works across HTMX swaps)
        document.addEventListener('click',   onCalendarClick);
        document.addEventListener('keydown', onCalendarKeydown);

        // HTMX integration
        document.addEventListener('htmx:afterSwap',   onHtmxSwap);
        document.addEventListener('htmx:afterSettle', onHtmxSwap);

        // Initial render
        updateCurrentTime();
        scrollToCurrentTime();

        // Refresh indicator every minute
        if (_timeRefreshTimer) clearInterval(_timeRefreshTimer);
        _timeRefreshTimer = setInterval(updateCurrentTime, REFRESH_INTERVAL);
    }

    // ========================================
    // PUBLIC API
    // ========================================

    window.lf = window.lf || {};
    window.lf.Calendar = {
        init:              init,
        updateCurrentTime: updateCurrentTime,
        setView:           setView
    };

    // ========================================
    // SUGGESTED-TIME HELPER
    // ========================================

    var BUSINESS_HOUR_START = 9;    // 09:00
    var BUSINESS_HOUR_END   = 18;   // 18:00 (cap — past this, suggest 09:00)

    /**
     * Pads a number to two digits (string).
     */
    function pad2(n) {
        n = Math.floor(n);
        return (n < 10 ? '0' : '') + n;
    }

    /**
     * Suggest a start time ("HH:MM") for a new event on `dateStr` (YYYY-MM-DD).
     *
     * - If `dateStr` is today:  round `new Date()` UP to the next half-hour.
     *                           If the rounded time is past BUSINESS_HOUR_END,
     *                           return "09:00" (caller may re-interpret for tomorrow).
     * - If `dateStr` is past:   return "09:00".
     * - If `dateStr` is future: return "09:00".
     */
    function suggestStartTime(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return pad2(BUSINESS_HOUR_START) + ':00';
        }

        // Parse YYYY-MM-DD as a local-day (not UTC midnight).
        var parts = dateStr.split('-');
        if (parts.length !== 3) {
            return pad2(BUSINESS_HOUR_START) + ':00';
        }
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        var d = parseInt(parts[2], 10);
        if (isNaN(y) || isNaN(m) || isNaN(d)) {
            return pad2(BUSINESS_HOUR_START) + ':00';
        }

        var target = new Date(y, m - 1, d);
        var today  = new Date();
        var todayY = today.getFullYear();
        var todayM = today.getMonth();
        var todayD = today.getDate();

        var isToday = (target.getFullYear() === todayY &&
                       target.getMonth()    === todayM &&
                       target.getDate()     === todayD);

        if (!isToday) {
            // Past or future dates: business-hour start.
            return pad2(BUSINESS_HOUR_START) + ':00';
        }

        // Today: round UP to the next half-hour boundary.
        var h = today.getHours();
        var mm = today.getMinutes();
        if (mm === 0) {
            // Already on an hour — do nothing.
        } else if (mm <= 30) {
            mm = 30;
        } else {
            mm = 0;
            h += 1;
        }
        if (h >= 24) {
            h = 0;
            mm = 0;
        }

        // If we've rounded past business hours, fall back to 09:00.
        if (h >= BUSINESS_HOUR_END) {
            return pad2(BUSINESS_HOUR_START) + ':00';
        }
        // If current time is before business hours, prefer 09:00 too.
        if (h < BUSINESS_HOUR_START) {
            return pad2(BUSINESS_HOUR_START) + ':00';
        }
        return pad2(h) + ':' + pad2(mm);
    }

    window.lf.calendar = window.lf.calendar || {};
    window.lf.calendar.suggestStartTime = suggestStartTime;

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
