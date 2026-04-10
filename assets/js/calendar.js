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

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
