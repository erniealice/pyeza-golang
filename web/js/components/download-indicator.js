/**
 * Download Indicator — feedback for server-generated downloads.
 *
 * Server-rendered downloads (report-card PDF, grade-sheet CSV/PDF, invoice PDF)
 * give zero feedback between the click and the browser's download event; slow
 * conversions (LibreOffice) complete before the first byte streams, so operators
 * click again or assume the app hung. This module shows a persistent progress
 * toast on every download trigger and dismisses it the moment the download
 * actually starts.
 *
 * Mechanism (token + cookie handshake):
 *   1. On a download trigger, mint a random alnum token and attach it to the
 *      request as `dltoken=<token>` (anchor href rewrite / form hidden field /
 *      window.open URL). Show a persistent spinner toast. Only same-origin
 *      http(s) anchors are tokenized; blob:/data:/cross-origin links are skipped.
 *   2. A generic server decorator sets `Set-Cookie: lf_dl_<token>=1` at
 *      header-commit time, ONLY when the response is a successful (2xx)
 *      attachment — browsers apply Set-Cookie even for a download navigation, so
 *      the cookie lands the moment the attachment response headers arrive. The
 *      per-token name lets concurrent downloads acknowledge independently.
 *   3. This module polls document.cookie (500ms); each active token checks for
 *      its own `lf_dl_<token>` cookie, dismisses that download's toast, and
 *      expires the cookie. A 60s timeout instead dismisses the spinner and shows
 *      an auto-dismissing warning toast.
 *
 * It also owns the DOWNLOAD FRAME (20260726): download FORMS are retargeted at
 * a persistent hidden iframe, because a top-level submit whose response carries
 * no Content-Disposition RENDERS — replacing the operator's page with a bare
 * error body and changing the URL. See ensureFrame() for the measured case. A
 * load event in that frame is therefore a failure signal, and the server's own
 * message is surfaced as an error toast instead of the spinner running to its
 * 60s timeout.
 *
 * Progressive enhancement: the delegated listeners AUGMENT the native trigger
 * (they never preventDefault) — with JS disabled every download still works,
 * just without the indicator (and without the frame, i.e. the old page-replacing
 * error behaviour). Labels come from <body data-lf-download-*> (set by the app
 * shell from CommonLabels.Download); no English is hardcoded here — a failure
 * toast shows the SERVER's text, so it needs no label of its own.
 *
 * Public API (window.lf.ui.DownloadIndicator):
 *   begin()            — mint a token, show the spinner, start polling/timeout;
 *                        returns the token (callers append it themselves).
 *   withToken(url,tok) — return url with dltoken=tok set (replacing any existing).
 *   track(url)         — begin() + withToken(url, token); returns the tokenized
 *                        url (used by the table row-action window.open path).
 */

(function () {
    'use strict';

    var COOKIE_PREFIX = 'lf_dl_';
    var PARAM = 'dltoken';
    var TESTID = 'download-indicator';
    var FRAME_NAME = 'lf-download-frame';
    var FRAME_ID = 'lfDownloadFrame';
    var TOKEN_LEN = 24;
    var POLL_INTERVAL_MS = 500;
    var TIMEOUT_MS = 60000;
    var WARNING_DURATION_MS = 8000;
    var ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    // token -> { toastEl, timeoutId }
    var active = Object.create(null);
    var pollTimer = null;
    // Token of the download currently aimed at the shared frame. Only ONE form
    // download can occupy the frame at a time, so a frame error is attributable
    // to exactly this token — never to a concurrently tracked anchor download.
    var frameToken = null;

    // ========================================
    // I18N — read defaults from <body data-lf-download-*>
    // ========================================

    function bodyDataset() {
        return (document.body && document.body.dataset) || {};
    }
    function preparingLabel() {
        return bodyDataset().lfDownloadPreparing || '';
    }
    function timeoutLabel() {
        return bodyDataset().lfDownloadTimeout || '';
    }

    // ========================================
    // TOKEN + COOKIE
    // ========================================

    function genToken() {
        var out = '';
        var i;
        if (window.crypto && window.crypto.getRandomValues) {
            var buf = new Uint8Array(TOKEN_LEN);
            window.crypto.getRandomValues(buf);
            for (i = 0; i < TOKEN_LEN; i++) {
                out += ALNUM.charAt(buf[i] % ALNUM.length);
            }
        } else {
            for (i = 0; i < TOKEN_LEN; i++) {
                out += ALNUM.charAt(Math.floor(Math.random() * ALNUM.length));
            }
        }
        return out;
    }

    // Per-token cookie: the server sets `lf_dl_<token>=1` on the successful
    // attachment response, so each concurrent download acknowledges under its own
    // name and one response can never overwrite another's completion signal.
    function cookieName(token) {
        return COOKIE_PREFIX + token;
    }

    function hasCookie(name) {
        var raw = document.cookie || '';
        var parts = raw.split(';');
        for (var i = 0; i < parts.length; i++) {
            if (parts[i].split('=')[0].trim() === name) {
                return true;
            }
        }
        return false;
    }

    function expireCookie(name) {
        document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax';
    }

    // Only same-origin http(s) anchors are tokenized. blob:/data: object URLs
    // (client-side CSV/XLS exports), cross-origin links, and signed download URLs
    // are left untouched — rewriting their href would corrupt the target.
    function isTrackableAnchorURL(href) {
        var u;
        try {
            u = new URL(href, window.location.href);
        } catch (e) {
            return false;
        }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        return u.origin === window.location.origin;
    }

    // Attach/replace dltoken on a URL string. Relative URLs resolve against the
    // current location; searchParams.set makes it idempotent (a re-click swaps
    // the token rather than appending a second one).
    function withToken(url, token) {
        try {
            var u = new URL(url, window.location.href);
            u.searchParams.set(PARAM, token);
            return u.toString();
        } catch (e) {
            var sep = String(url).indexOf('?') === -1 ? '?' : '&';
            return url + sep + PARAM + '=' + encodeURIComponent(token);
        }
    }

    // ========================================
    // TOAST
    // ========================================

    function toastApi() {
        return (window.lf && window.lf.ui && window.lf.ui.Toast) || null;
    }

    function showProgressToast() {
        var api = toastApi();
        if (!api || !api.show) return null;
        // Empty label suppresses the toast entirely (matches the Go contract:
        // an empty Preparing string means "no indicator") — never announce a
        // blank live-region message.
        var message = preparingLabel();
        if (!message) return null;
        return api.show({
            message: message,
            state: 'progress',
            duration: '0',
            dismissible: false,
            testid: TESTID
        });
    }

    function showTimeoutToast() {
        var api = toastApi();
        if (!api || !api.show) return;
        // Empty label suppresses the warning toast (same contract as above).
        var message = timeoutLabel();
        if (!message) return;
        // state "warning" renders role="alert" aria-live="assertive" in toast.js.
        api.show({
            message: message,
            state: 'warning',
            duration: String(WARNING_DURATION_MS)
        });
    }

    function dismissToast(el) {
        var api = toastApi();
        if (api && api.dismiss && el) {
            api.dismiss(el);
        }
    }

    // The download FAILED and the server said why. Surface its own text, the same
    // rule the HX-Error-Message path uses (server message preferred; the local
    // label is only a fallback for a silent server). state "error" renders
    // role="alert" aria-live="assertive" in toast.js.
    function showErrorToast(message) {
        var api = toastApi();
        if (!api || !api.show) return;
        api.show({
            message: message,
            state: 'error',
            duration: String(WARNING_DURATION_MS)
        });
    }

    // ========================================
    // DOWNLOAD FRAME
    // ========================================
    //
    // WHY. A native download form (method=get) submits at TOP LEVEL. For a 2xx
    // attachment the browser converts that navigation into a download and the
    // address bar stays put — but ANY response WITHOUT Content-Disposition
    // RENDERS instead, so the page the operator was working on is replaced by a
    // bare error body and the URL becomes the export URL.
    //
    // Measured on the grade-sheet export drawer, 2026-07-26: submitting a
    // rejected period navigated a 29-student section sheet to a plain-text
    // "not found" page (title emptied, grid gone). The reachable production
    // cases are the PDF 503 (not wired / no document_template / soffice absent),
    // the zero-row-roster 404 — which is the ORDINARY MINE-scoped teacher — and
    // 403. On the grade sheet that navigation also discards unsaved cells,
    // because the grid is one batch-save <form>.
    //
    // Submitting into a persistent same-origin iframe leaves the attachment path
    // byte-identical (the browser still hands it to the download manager, and
    // Set-Cookie still lands, so the token handshake below is unaffected) while
    // an error response renders INTO THE FRAME and the page never moves.
    //
    // The frame is created lazily on <body> and never removed. It must NOT live
    // inside a drawer: lf.Sheet.close() clears #sheetContent ~300ms after submit,
    // which would destroy the frame and abort an in-flight download.
    //
    // CSP: the policy already carries frame-src 'self', so a same-origin frame
    // survives the report-only policy going enforcing.
    //
    // Progressive enhancement: if this module never runs, no target is stamped
    // and the form submits top-level exactly as before — the download still
    // works, it just keeps the old page-replacing error behaviour.
    function ensureFrame() {
        var frame = document.getElementById(FRAME_ID);
        if (frame) return frame;
        if (!document.body) return null;
        frame = document.createElement('iframe');
        frame.id = FRAME_ID;
        frame.name = FRAME_NAME;
        // hidden removes it from the accessibility tree entirely, so it needs no
        // title; aria-hidden + tabindex=-1 keep it out of AT and tab order even
        // if a stylesheet ever overrides [hidden].
        frame.hidden = true;
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('tabindex', '-1');
        frame.addEventListener('load', onFrameLoad);
        document.body.appendChild(frame);
        return frame;
    }

    // A successful attachment never loads a document into the frame — the
    // browser hands it to the download manager — so a load event carrying a
    // non-empty body is an ERROR page. Surface it immediately instead of letting
    // the spinner run the full 60s timeout.
    function onFrameLoad(e) {
        var frame = e.target;
        var doc = null;
        try {
            doc = frame.contentDocument;
        } catch (err) {
            return; // opaque/cross-origin document — nothing readable to report
        }
        if (!doc || !doc.location || doc.location.href === 'about:blank') return;
        var text = (doc.body && doc.body.innerText) ? doc.body.innerText.trim() : '';
        if (!text) return; // nothing to say — leave the timeout path to handle it

        var token = frameToken;
        frameToken = null;
        // No token, or the cookie already acknowledged success: the frame content
        // is not a failure signal for a download we are still tracking.
        if (!token || !active[token]) return;

        var entry = active[token];
        delete active[token];
        window.clearTimeout(entry.timeoutId);
        dismissToast(entry.toastEl);
        reapPoller();
        showErrorToast(text);

        // Blank the frame so a later download can never re-surface this message.
        // The about:blank load re-enters here and returns at the guard above.
        try {
            doc.location.replace('about:blank');
        } catch (err) { /* nothing to reset */ }
    }

    // ========================================
    // TRACKING LIFECYCLE
    // ========================================

    function hasActive() {
        for (var k in active) {
            if (Object.prototype.hasOwnProperty.call(active, k)) return true;
        }
        return false;
    }

    function reapPoller() {
        if (pollTimer !== null && !hasActive()) {
            window.clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function ensurePolling() {
        if (pollTimer !== null) return;
        pollTimer = window.setInterval(function () {
            for (var token in active) {
                if (!Object.prototype.hasOwnProperty.call(active, token)) continue;
                var name = cookieName(token);
                if (!hasCookie(name)) continue;
                var entry = active[token];
                delete active[token];
                window.clearTimeout(entry.timeoutId);
                dismissToast(entry.toastEl);
                expireCookie(name);
            }
            reapPoller();
        }, POLL_INTERVAL_MS);
    }

    function begin() {
        var token = genToken();
        var entry = { toastEl: showProgressToast() };
        entry.timeoutId = window.setTimeout(function () {
            if (!active[token]) return;
            delete active[token];
            dismissToast(entry.toastEl);
            showTimeoutToast();
            reapPoller();
        }, TIMEOUT_MS);
        active[token] = entry;
        ensurePolling();
        return token;
    }

    function track(url) {
        return withToken(url, begin());
    }

    // ========================================
    // DELEGATED TRIGGERS (survive HTMX swaps)
    // ========================================

    function isDisabled(el) {
        return el.getAttribute('aria-disabled') === 'true' ||
            (el.classList && el.classList.contains('disabled')) ||
            el.hasAttribute('disabled');
    }

    function initDelegation() {
        // 1. Native download anchors (report-card row PDF, client-card toolbar PDF).
        //    Rewrite href in-place before the browser follows it — never
        //    preventDefault, so a JS failure leaves the native download intact.
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[download]');
            if (!a) return;
            if (isDisabled(a)) return;
            var href = a.getAttribute('href');
            if (!href || href === '#') return;
            // Leave blob:/data:/cross-origin/signed download links untouched —
            // only tokenize a same-origin http(s) target the server can echo back.
            if (!isTrackableAnchorURL(href)) return;
            a.setAttribute('href', track(href));
        });

        // 2. Native download forms (grade-sheet export drawer — method=get).
        //    Add a hidden dltoken field so it rides the GET query string, and
        //    retarget the submit into the shared frame so a non-attachment
        //    response cannot replace the page (see ensureFrame).
        document.addEventListener('submit', function (e) {
            var form = e.target;
            if (!form || !form.matches || !form.matches('form[data-download-form]')) return;
            var token = begin();
            var input = form.querySelector('input[name="' + PARAM + '"]');
            if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = PARAM;
                form.appendChild(input);
            }
            input.value = token;

            // Both mutations are applied DURING the submit event on purpose: the
            // form-submission algorithm resolves the entry list AND the target
            // only after this event returns, so each applies to THIS submission.
            // Target only when the frame really exists — a target naming no frame
            // would open a new tab, which is worse than the navigation we are
            // trying to avoid.
            if (ensureFrame()) {
                form.target = FRAME_NAME;
                frameToken = token;
            }
        });
        // The table row-action window.open path (`.action-btn[data-action="download"]`)
        // is owned by table-actions.js, which calls DownloadIndicator.track() so
        // there is exactly one owner per trigger and no double toast.
    }

    // ========================================
    // INIT + PUBLIC API
    // ========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDelegation);
    } else {
        initDelegation();
    }

    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    window.lf.ui.DownloadIndicator = {
        begin: begin,
        withToken: withToken,
        track: track
    };
})();
