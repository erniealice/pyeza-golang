/**
 * Bulk Download — browser-orchestrated batch of server documents saved as ONE
 * ZIP file (window.lf.ui.BulkDownload).
 *
 * The server stays request/response: a drawer form (`form[data-lf-bulk-download]`)
 * names a read-only JSON manifest URL; the manifest lists each document's
 * EXISTING per-item download URL. This module then:
 *
 *   1. fetches the manifest for the chosen period/format;
 *   2. fetches every document with bounded concurrency (the server's
 *      data-concurrency, default 6, safety ceiling 10),
 *      a per-attempt timeout, and up to 3 attempts with exponential backoff +
 *      jitter (honouring Retry-After) for network / timeout / 429 / 5xx / an
 *      invalid 200 body; 400/403/404/422 are terminal, 409 is "not ready",
 *      401 (or a redirect to an HTML page) aborts the batch;
 *   3. trips a circuit breaker after 3 consecutive items whose FINAL outcome is
 *      a server-class failure (timeouts never count — a slow file is not a
 *      failing server);
 *   4. validates every body (PDF: application/pdf, %PDF- header, %%EOF in the
 *      last 1 KiB, size floor; DOCX: PK\x03\x04 header, size floor);
 *   5. builds a STORE-only ZIP in memory (CRC-32, UTF-8 names, no ZIP64 — a
 *      batch that would need it is refused) with a `_manifest.csv` row per item,
 *      so ok + not_ready + failed always equals the expected count;
 *   6. offers Save only after the invariant holds, labelled as complete only
 *      when every item is ok (otherwise an explicit shortfall and an
 *      "-incomplete-N-of-M" archive name).
 *
 * No inline script (CSP): the drawer template includes this file with a
 * <script src>, and this IIFE is idempotent so re-opening the drawer does not
 * double-bind. All DOM text is written with textContent.
 *
 * downloadFilename() and saveBlob() follow download-indicator.js
 * (downloadFilename / saveDownloadBlob), which keeps those private.
 */
(function () {
    'use strict';

    window.lf = window.lf || {};
    window.lf.ui = window.lf.ui || {};
    // The drawer renders its start button disabled until this module runs, so
    // a click that beats the script cannot submit the form natively. The drawer
    // re-includes this script on every open; a repeat include only enables.
    function enablePending(root) {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('form[data-lf-bulk-download] [data-lf-bulk-download-pending]').forEach(function (button) {
            button.removeAttribute('data-lf-bulk-download-pending');
            button.disabled = false;
        });
    }

    if (window.lf.ui.BulkDownload) {
        window.lf.ui.BulkDownload.enablePending(typeof document !== 'undefined' ? document : null);
        return;
    }

    // The server owns the policy (form data-concurrency); these only cover a
    // missing value and stop a bad setting from flooding the converter.
    var DEFAULT_CONCURRENCY = 6;
    var MAX_CONCURRENCY = 10;
    var DEFAULT_TIMEOUT_MS = 180000;
    var MAX_ATTEMPTS = 3;
    var BREAKER_THRESHOLD = 3;
    var BACKOFF_BASE_MS = 1500;
    var BACKOFF_CAP_MS = 20000;
    var RETRY_AFTER_CAP_MS = 60000;
    var MIN_DOCUMENT_BYTES = 512;
    var PDF_EOF_WINDOW = 1024;
    // 0xFFFF entries / 0xFFFFFFFF sizes or offsets would require ZIP64.
    var ZIP_MAX_ENTRIES = 0xFFFE;
    var ZIP_MAX_BYTES = 0xFFFFFFFE;
    var MANIFEST_NAME = '_manifest.csv';

    var STATUS_OK = 'ok';
    var STATUS_NOT_READY = 'not_ready';
    var STATUS_FAILED = 'failed';
    var STATUS_PENDING = 'pending';

    // ========================================
    // BYTES: UTF-8 + CRC-32
    // ========================================

    function utf8(text) {
        text = String(text);
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
        var out = [];
        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i);
            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
                var low = text.charCodeAt(i + 1);
                if (low >= 0xDC00 && low <= 0xDFFF) {
                    code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
                    i++;
                }
            }
            if (code < 0x80) out.push(code);
            else if (code < 0x800) out.push(0xC0 | (code >> 6), 0x80 | (code & 63));
            else if (code < 0x10000) out.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
            else out.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
        }
        return new Uint8Array(out);
    }

    var CRC_TABLE = (function () {
        var table = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    // ========================================
    // ZIP (STORE only, no ZIP64)
    // ========================================

    function tooLarge() {
        var error = new Error('zip too large');
        error.code = 'too_large';
        return error;
    }

    function dosDateTime(date) {
        var year = date.getFullYear();
        if (year < 1980) return { time: 0, date: (1 << 5) | 1 };
        if (year > 2107) year = 2107;
        return {
            time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
            date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
        };
    }

    // buildZip returns { parts: Uint8Array[], size } for files [{ name, data }].
    // Names must already be unique and safe (see uniqueName / sanitizeFilename).
    function buildZip(files, date) {
        if (files.length > ZIP_MAX_ENTRIES) throw tooLarge();
        var stamp = dosDateTime(date || new Date());
        var parts = [];
        var central = [];
        var offset = 0;
        var centralSize = 0;

        files.forEach(function (file) {
            var name = utf8(file.name);
            var data = file.data;
            var crc = crc32(data);
            if (data.length > ZIP_MAX_BYTES || offset > ZIP_MAX_BYTES) throw tooLarge();

            var local = new Uint8Array(30 + name.length);
            var lv = new DataView(local.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);       // version needed
            lv.setUint16(6, 0x0800, true);   // general purpose: UTF-8 names
            lv.setUint16(8, 0, true);        // method: STORE
            lv.setUint16(10, stamp.time, true);
            lv.setUint16(12, stamp.date, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, data.length, true);
            lv.setUint32(22, data.length, true);
            lv.setUint16(26, name.length, true);
            lv.setUint16(28, 0, true);
            local.set(name, 30);

            var header = new Uint8Array(46 + name.length);
            var cv = new DataView(header.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);       // version made by
            cv.setUint16(6, 20, true);       // version needed
            cv.setUint16(8, 0x0800, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, stamp.time, true);
            cv.setUint16(14, stamp.date, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, data.length, true);
            cv.setUint32(24, data.length, true);
            cv.setUint16(28, name.length, true);
            cv.setUint16(30, 0, true);       // extra
            cv.setUint16(32, 0, true);       // comment
            cv.setUint16(34, 0, true);       // disk
            cv.setUint16(36, 0, true);       // internal attrs
            cv.setUint32(38, 0, true);       // external attrs
            cv.setUint32(42, offset, true);
            header.set(name, 46);

            parts.push(local, data);
            central.push(header);
            offset += local.length + data.length;
            centralSize += header.length;
        });

        if (offset + centralSize + 22 > ZIP_MAX_BYTES) throw tooLarge();
        var end = new Uint8Array(22);
        var ev = new DataView(end.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, centralSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);
        return { parts: parts.concat(central, [end]), size: offset + centralSize + 22 };
    }

    // ========================================
    // RESPONSE CLASSIFICATION + VALIDATION
    // ========================================

    // classifyStatus maps a per-item HTTP status to one of:
    //   ok (validate body) | retry | terminal | not_ready | fatal (abort batch).
    function classifyStatus(status) {
        if (status >= 200 && status < 300) return { kind: 'ok' };
        if (status === 409) return { kind: 'not_ready', reason: 'not_ready' };
        if (status === 401) return { kind: 'fatal', reason: 'unauthenticated' };
        if (status === 429 || status >= 500) return { kind: 'retry', reason: 'http_' + status };
        return { kind: 'terminal', reason: 'http_' + status };
    }

    function bytesStartWith(bytes, signature) {
        if (bytes.length < signature.length) return false;
        for (var i = 0; i < signature.length; i++) {
            if (bytes[i] !== signature[i]) return false;
        }
        return true;
    }

    function containsAscii(bytes, text, from) {
        outer:
        for (var i = Math.max(0, from); i <= bytes.length - text.length; i++) {
            for (var j = 0; j < text.length; j++) {
                if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
            }
            return true;
        }
        return false;
    }

    var PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2D];   // %PDF-
    var ZIP_MAGIC = [0x50, 0x4B, 0x03, 0x04];         // PK\x03\x04 (DOCX container)

    function validateDocument(format, contentType, bytes) {
        contentType = String(contentType || '').toLowerCase();
        if (!bytes || bytes.length < MIN_DOCUMENT_BYTES) return { ok: false, reason: 'invalid_document' };
        if (contentType.indexOf('text/html') !== -1) return { ok: false, reason: 'invalid_document' };
        if (format === 'pdf') {
            if (contentType.indexOf('application/pdf') === -1) return { ok: false, reason: 'invalid_document' };
            if (!bytesStartWith(bytes, PDF_MAGIC)) return { ok: false, reason: 'invalid_document' };
            if (!containsAscii(bytes, '%%EOF', bytes.length - PDF_EOF_WINDOW)) return { ok: false, reason: 'invalid_document' };
            return { ok: true };
        }
        if (format === 'docx') {
            if (!bytesStartWith(bytes, ZIP_MAGIC)) return { ok: false, reason: 'invalid_document' };
            return { ok: true };
        }
        return { ok: false, reason: 'invalid_document' };
    }

    function parseRetryAfter(value, nowMs) {
        if (value == null || String(value).trim() === '') return null;
        value = String(value).trim();
        var ms;
        if (/^\d+$/.test(value)) {
            ms = parseInt(value, 10) * 1000;
        } else {
            var at = Date.parse(value);
            if (isNaN(at)) return null;
            ms = at - nowMs;
        }
        return Math.max(0, Math.min(RETRY_AFTER_CAP_MS, ms));
    }

    function backoffDelay(attempt, random) {
        var ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempt - 1)));
        return Math.round(ceiling / 2 + random() * (ceiling / 2));
    }

    // ========================================
    // FILENAMES + CSV
    // ========================================

    // omittedItems decodes the server's X-Omitted-Items list (URL-encoded names
    // joined by "; ") into a readable "; "-joined manifest cell.
    function omittedItems(header) {
        if (!header) return '';
        return String(header).split(';').map(function (part) {
            part = part.trim();
            try { return decodeURIComponent(part); } catch (e) { return part; }
        }).filter(Boolean).join('; ');
    }

    function downloadFilename(contentDisposition) {
        if (!contentDisposition) return '';
        var extended = /filename\*\s*=\s*([^;]+)/i.exec(contentDisposition);
        if (extended) {
            var encoded = extended[1].trim().replace(/^"(.*)"$/, '$1');
            encoded = encoded.replace(/^[^']*'[^']*'/, '');
            try {
                return decodeURIComponent(encoded);
            } catch (e) {
                return encoded;
            }
        }
        var standard = /filename\s*=\s*("(?:\\.|[^"])*"|[^;]*)/i.exec(contentDisposition);
        if (!standard) return '';
        var filename = standard[1].trim();
        if (filename.charAt(0) === '"' && filename.charAt(filename.length - 1) === '"') {
            filename = filename.slice(1, -1).replace(/\\(["\\])/g, '$1');
        }
        return filename;
    }

    function slugify(text) {
        return String(text || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function sanitizeFilename(name, fallbackBase, extension) {
        var clean = String(name || '')
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .replace(/[\\/:*?"<>|]/g, '-')
            .trim()
            .replace(/^[.\s]+/, '');
        if (!clean || clean.toLowerCase() === 'download') clean = fallbackBase || 'document';
        var suffix = '.' + extension;
        if (clean.toLowerCase().slice(-suffix.length) !== suffix) clean += suffix;
        if (clean.length > 180) clean = clean.slice(0, 180 - suffix.length) + suffix;
        return clean;
    }

    function uniqueName(name, used) {
        var dot = name.lastIndexOf('.');
        var stem = dot > 0 ? name.slice(0, dot) : name;
        var extension = dot > 0 ? name.slice(dot) : '';
        var candidate = name;
        for (var n = 2; used.has(candidate.toLowerCase()); n++) candidate = stem + ' (' + n + ')' + extension;
        used.add(candidate.toLowerCase());
        return candidate;
    }

    // csvCell neutralises spreadsheet formula injection and quotes as RFC 4180.
    function csvCell(value) {
        var text = value == null ? '' : String(value);
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
        if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
        return text;
    }

    var CSV_COLUMNS = ['client_id', 'client_name', 'filename', 'status', 'bytes', 'attempts', 'reason', 'omitted_items'];

    function manifestCsv(rows) {
        var lines = [CSV_COLUMNS.join(',')];
        rows.forEach(function (row) {
            lines.push(CSV_COLUMNS.map(function (column) { return csvCell(row[column]); }).join(','));
        });
        return '\uFEFF' + lines.join('\r\n') + '\r\n';
    }

    // ========================================
    // BATCH RUNNER
    // ========================================

    function newEntry(client) {
        return { client: client, status: STATUS_PENDING, reason: '', attempts: 0, bytes: 0, data: null, contentDisposition: '', omittedItems: '' };
    }

    function summarize(entries) {
        var counts = { expected: entries.length, ok: 0, not_ready: 0, failed: 0, pending: 0 };
        entries.forEach(function (entry) {
            if (entry.status === STATUS_OK) counts.ok++;
            else if (entry.status === STATUS_NOT_READY) counts.not_ready++;
            else if (entry.status === STATUS_FAILED) counts.failed++;
            else counts.pending++;
        });
        counts.done = counts.ok + counts.not_ready + counts.failed;
        counts.invariant = counts.pending === 0 && counts.done === counts.expected;
        return counts;
    }

    function clampConcurrency(value) {
        var n = parseInt(value, 10);
        if (!(n >= 1)) n = DEFAULT_CONCURRENCY;
        return Math.min(MAX_CONCURRENCY, n);
    }

    function acceptFor(format) {
        return format === 'pdf' ? 'application/pdf' :
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // runBatch fetches entries[indexes] (default: all) and settles every one of
    // them to ok / not_ready / failed. Returns { promise, stop }. The promise
    // resolves { outcome: 'complete'|'stopped'|'aborted', counts }.
    function runBatch(opts) {
        var env = {
            fetch: opts.fetch || window.fetch.bind(window),
            AbortController: opts.AbortController || window.AbortController,
            setTimer: opts.setTimer || function (fn, ms) { return window.setTimeout(fn, ms); },
            clearTimer: opts.clearTimer || function (handle) { window.clearTimeout(handle); },
            random: opts.random || Math.random,
            now: opts.now || Date.now,
            timeoutMs: opts.timeoutMs || DEFAULT_TIMEOUT_MS,
            maxAttempts: opts.maxAttempts || MAX_ATTEMPTS,
            breakerThreshold: opts.breakerThreshold || BREAKER_THRESHOLD,
            concurrency: clampConcurrency(opts.concurrency),
            onUpdate: opts.onUpdate || function () {}
        };
        var format = opts.format;
        var entries = opts.entries;
        var queue = (opts.indexes || entries.map(function (_, i) { return i; })).slice();
        var run = { stopped: false, reason: '', controllers: [], wakers: [] };
        var consecutiveServerFailures = 0;

        function stop(reason) {
            if (run.stopped) return;
            run.stopped = true;
            run.reason = reason || 'stopped';
            run.controllers.slice().forEach(function (controller) {
                try { controller.abort(); } catch (e) { /* already settled */ }
            });
            run.wakers.slice().forEach(function (wake) { wake(); });
        }

        function remove(list, item) {
            var index = list.indexOf(item);
            if (index !== -1) list.splice(index, 1);
        }

        var sleep = opts.sleep || function (ms) {
            return new Promise(function (resolve) {
                if (run.stopped) return resolve();
                var done = false;
                var handle = env.setTimer(wake, ms);
                function wake() {
                    if (done) return;
                    done = true;
                    env.clearTimer(handle);
                    remove(run.wakers, wake);
                    resolve();
                }
                run.wakers.push(wake);
            });
        };

        function settle(entry, status, reason, breaker) {
            entry.status = status;
            entry.reason = reason || '';
            if (status !== STATUS_OK) {
                entry.data = null;
                entry.bytes = 0;
            }
            if (breaker === 'reset') consecutiveServerFailures = 0;
            if (breaker === 'count') {
                consecutiveServerFailures++;
                if (consecutiveServerFailures >= env.breakerThreshold) stop('aborted');
            }
            env.onUpdate(entry, summarize(entries));
        }

        async function attempt(entry) {
            var controller = new env.AbortController();
            run.controllers.push(controller);
            var timedOut = false;
            var timer = env.setTimer(function () {
                timedOut = true;
                controller.abort();
            }, env.timeoutMs);
            try {
                var response = await env.fetch(entry.client.document_url, {
                    credentials: 'same-origin',
                    signal: controller.signal,
                    headers: { Accept: acceptFor(format) }
                });
                var contentType = response.headers.get('Content-Type') || '';
                var verdict = classifyStatus(response.status);
                if (verdict.kind === 'ok') {
                    if (response.redirected && contentType.toLowerCase().indexOf('text/html') !== -1) {
                        return { kind: 'fatal', reason: 'unauthenticated' };
                    }
                    var bytes = new Uint8Array(await response.arrayBuffer());
                    var check = validateDocument(format, contentType, bytes);
                    if (!check.ok) return { kind: 'retry', reason: check.reason };
                    return { kind: 'ok', data: bytes, contentDisposition: response.headers.get('Content-Disposition') || '', omittedItems: omittedItems(response.headers.get('X-Omitted-Items')) };
                }
                if (verdict.kind === 'retry') verdict.retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'), env.now());
                try { if (response.body && response.body.cancel) response.body.cancel(); } catch (e) { /* ignore */ }
                return verdict;
            } catch (error) {
                if (timedOut) return { kind: 'retry', reason: 'timeout', timeout: true };
                if (run.stopped) return { kind: 'stopped' };
                return { kind: 'retry', reason: 'network' };
            } finally {
                env.clearTimer(timer);
                remove(run.controllers, controller);
            }
        }

        async function processEntry(entry) {
            entry.status = STATUS_PENDING;
            entry.reason = '';
            entry.attempts = 0;
            entry.data = null;
            entry.bytes = 0;
            var last = null;
            while (entry.attempts < env.maxAttempts) {
                if (run.stopped) return settle(entry, STATUS_FAILED, run.reason);
                entry.attempts++;
                var result = await attempt(entry);
                if (result.kind === 'ok') {
                    entry.data = result.data;
                    entry.bytes = result.data.length;
                    entry.contentDisposition = result.contentDisposition;
                    entry.omittedItems = result.omittedItems;
                    return settle(entry, STATUS_OK, '', 'reset');
                }
                if (result.kind === 'stopped' || run.stopped) return settle(entry, STATUS_FAILED, run.reason);
                if (result.kind === 'not_ready') return settle(entry, STATUS_NOT_READY, result.reason, 'reset');
                if (result.kind === 'terminal') return settle(entry, STATUS_FAILED, result.reason, 'reset');
                if (result.kind === 'fatal') {
                    settle(entry, STATUS_FAILED, result.reason);
                    return stop('aborted');
                }
                last = result;
                if (entry.attempts < env.maxAttempts) {
                    await sleep(result.retryAfterMs != null ? result.retryAfterMs : backoffDelay(entry.attempts, env.random));
                }
            }
            // Retries spent. A timeout is a slow file, not a failing server.
            return settle(entry, STATUS_FAILED, last ? last.reason : 'failed', last && last.timeout ? '' : 'count');
        }

        async function worker() {
            while (queue.length && !run.stopped) {
                await processEntry(entries[queue.shift()]);
            }
        }

        var promise = (async function () {
            var workers = [];
            var n = Math.min(env.concurrency, queue.length);
            for (var i = 0; i < n; i++) workers.push(worker());
            await Promise.all(workers);
            while (queue.length) settle(entries[queue.shift()], STATUS_FAILED, run.reason || 'stopped');
            return {
                outcome: !run.stopped ? 'complete' : (run.reason === 'aborted' ? 'aborted' : 'stopped'),
                counts: summarize(entries)
            };
        })();

        return { promise: promise, stop: function () { stop('stopped'); } };
    }

    // assembleArchive builds the ZIP (documents + _manifest.csv) and refuses to
    // produce anything when an item is still unsettled.
    function assembleArchive(manifest, entries, date) {
        var counts = summarize(entries);
        if (!counts.invariant || counts.expected !== manifest.expected) {
            var error = new Error('batch is not settled');
            error.code = 'invariant';
            throw error;
        }
        var used = new Set([MANIFEST_NAME]);
        var documents = [];
        var rows = [];
        entries.forEach(function (entry) {
            var filename = '';
            if (entry.status === STATUS_OK) {
                var fallback = slugify(entry.client.name) || slugify(entry.client.client_id) || 'document';
                filename = uniqueName(sanitizeFilename(downloadFilename(entry.contentDisposition), fallback, manifest.format), used);
                documents.push({ name: filename, data: entry.data });
            }
            rows.push({
                client_id: entry.client.client_id,
                client_name: entry.client.name,
                filename: filename,
                status: entry.status,
                bytes: entry.status === STATUS_OK ? entry.bytes : 0,
                attempts: entry.attempts,
                reason: entry.reason,
                omitted_items: entry.status === STATUS_OK ? entry.omittedItems : ''
            });
        });
        var files = [{ name: MANIFEST_NAME, data: utf8(manifestCsv(rows)) }].concat(documents);
        var zip = buildZip(files, date);
        var base = String(manifest.zip_filename || 'documents.zip').replace(/\.zip$/i, '');
        var complete = counts.ok === counts.expected;
        return {
            parts: zip.parts,
            size: zip.size,
            complete: complete,
            counts: counts,
            filename: complete ? base + '.zip' : base + '-incomplete-' + counts.ok + '-of-' + counts.expected + '.zip'
        };
    }

    function validManifest(body) {
        return !!body && Array.isArray(body.clients) && body.expected === body.clients.length &&
            body.clients.length > 0 && (body.format === 'pdf' || body.format === 'docx') &&
            body.clients.every(function (client) {
                return client && typeof client.client_id === 'string' && client.client_id !== '' &&
                    typeof client.document_url === 'string' && client.document_url !== '';
            });
    }

    // ========================================
    // DRAWER CONTROLLER (delegated; survives HTMX swaps)
    // ========================================

    var states = new WeakMap();
    var activeRuns = 0;

    function stateFor(form) {
        var state = states.get(form);
        if (!state) {
            state = { running: false, handle: null, manifest: null, entries: [], outcome: '' };
            states.set(form, state);
        }
        return state;
    }

    function format(template, values) {
        return String(template || '').replace(/\{(\w+)\}/g, function (match, key) {
            return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match;
        });
    }

    function msg(form, key) {
        return form.getAttribute('data-msg-' + key) || '';
    }

    function part(form, name) {
        return form.querySelector('[data-lf-bulk-download-' + name + ']');
    }

    function actionButton(form, action) {
        return form.querySelector('[data-lf-bulk-download-action="' + action + '"]');
    }

    function show(el, visible) {
        if (el) el.hidden = !visible;
    }

    function showError(form, message) {
        var region = part(form, 'error');
        if (!region) return;
        region.textContent = message || msg(form, 'error');
        region.hidden = false;
    }

    function clearError(form) {
        var region = part(form, 'error');
        if (!region) return;
        region.textContent = '';
        region.hidden = true;
    }

    function setBusy(form, busy) {
        var start = form.querySelector('button[type="submit"]');
        form.querySelectorAll('select').forEach(function (select) { select.disabled = busy; });
        if (start) {
            if (!start.hasAttribute('data-lf-original-label')) start.setAttribute('data-lf-original-label', start.textContent);
            start.disabled = busy;
            var busyLabel = start.getAttribute('data-lf-busy-label');
            start.textContent = busy && busyLabel ? busyLabel : start.getAttribute('data-lf-original-label');
        }
        show(part(form, 'notice'), busy);
    }

    function render(form, state) {
        var counts = summarize(state.entries);
        var progress = part(form, 'progress');
        if (progress) progress.textContent = format(msg(form, 'progress'), { done: counts.done, total: counts.expected });
        var bar = part(form, 'bar');
        if (bar) {
            bar.max = Math.max(1, counts.expected);
            bar.value = counts.done;
        }
        var list = part(form, 'failure-list');
        if (list) {
            while (list.firstChild) list.removeChild(list.firstChild);
            state.entries.forEach(function (entry) {
                if (entry.status !== STATUS_NOT_READY && entry.status !== STATUS_FAILED) return;
                var item = document.createElement('li');
                var label = entry.status === STATUS_NOT_READY ? msg(form, 'status-not-ready') : msg(form, 'status-failed');
                item.textContent = (entry.client.name || entry.client.client_id) + ' — ' + label +
                    (entry.reason && entry.reason !== entry.status ? ' (' + entry.reason + ')' : '');
                item.setAttribute('data-client-id', entry.client.client_id);
                item.setAttribute('data-status', entry.status);
                list.appendChild(item);
            });
            show(part(form, 'failures'), list.children.length > 0);
        }
        return counts;
    }

    function finish(form, state, outcome) {
        state.running = false;
        state.handle = null;
        state.outcome = outcome;
        activeRuns = Math.max(0, activeRuns - 1);
        setBusy(form, false);
        show(actionButton(form, 'stop'), false);
        var counts = render(form, state);
        var progress = part(form, 'progress');
        if (!counts.invariant || counts.expected !== state.manifest.expected) {
            showError(form, msg(form, 'error'));
            show(actionButton(form, 'save'), false);
            show(actionButton(form, 'retry'), false);
            return;
        }
        var values = { ok: counts.ok, total: counts.expected, not_ready: counts.not_ready, failed: counts.failed };
        var message;
        if (outcome === 'aborted') message = msg(form, 'aborted');
        else if (outcome === 'stopped') message = msg(form, 'stopped');
        else if (counts.ok === counts.expected) message = msg(form, 'complete');
        else message = msg(form, 'shortfall');
        if (progress) progress.textContent = format(message, values);
        var save = actionButton(form, 'save');
        if (save) {
            save.textContent = counts.ok === counts.expected ? msg(form, 'save') : msg(form, 'save-partial');
            save.setAttribute('data-complete', counts.ok === counts.expected ? 'true' : 'false');
        }
        show(save, counts.ok > 0);
        show(actionButton(form, 'retry'), counts.failed > 0);
        // Once there is a ZIP to save, starting again would refetch every
        // document; the start button returns when the period or format changes.
        show(form.querySelector('button[type="submit"]'), counts.ok === 0);
    }

    // A new period/format makes the finished batch stale: drop its save/retry
    // and offer the start button again.
    function onChange(event) {
        var target = event.target;
        if (!target || !target.closest || target.tagName !== 'SELECT') return;
        var form = target.closest('form[data-lf-bulk-download]');
        if (!form) return;
        var state = stateFor(form);
        if (state.running) return;
        show(actionButton(form, 'save'), false);
        show(actionButton(form, 'retry'), false);
        show(form.querySelector('button[type="submit"]'), true);
    }

    function launch(form, state, indexes) {
        state.running = true;
        activeRuns++;
        clearError(form);
        setBusy(form, true);
        show(part(form, 'status'), true);
        show(actionButton(form, 'stop'), true);
        show(actionButton(form, 'retry'), false);
        show(actionButton(form, 'save'), false);
        indexes.forEach(function (index) { state.entries[index].status = STATUS_PENDING; });
        render(form, state);
        state.handle = runBatch({
            entries: state.entries,
            indexes: indexes,
            format: state.manifest.format,
            concurrency: form.getAttribute('data-concurrency'),
            onUpdate: function () {
                if (!form.isConnected && state.handle) state.handle.stop();
                render(form, state);
            }
        });
        state.handle.promise.then(function (result) {
            finish(form, state, result.outcome);
        }, function () {
            finish(form, state, 'aborted');
        });
    }

    function start(form, state) {
        var period = form.querySelector('[name="period"]');
        var formatField = form.querySelector('[name="format"]');
        var url = new URL(form.getAttribute('data-manifest-url'), window.location.href);
        url.searchParams.set('period', period ? period.value : '');
        url.searchParams.set('format', formatField ? formatField.value : '');
        clearError(form);
        setBusy(form, true);
        state.running = true;
        fetch(url.toString(), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then(function (response) {
                return response.json().catch(function () { return null; }).then(function (body) {
                    return { response: response, body: body };
                });
            })
            .then(function (result) {
                state.running = false;
                if (!result.response.ok) {
                    setBusy(form, false);
                    showError(form, result.body && result.body.message);
                    return;
                }
                if (!validManifest(result.body)) {
                    setBusy(form, false);
                    showError(form, msg(form, 'error'));
                    return;
                }
                if (result.body.expected > ZIP_MAX_ENTRIES - 1) {
                    setBusy(form, false);
                    showError(form, msg(form, 'too-large'));
                    return;
                }
                state.manifest = result.body;
                state.entries = result.body.clients.map(newEntry);
                launch(form, state, state.entries.map(function (_, i) { return i; }));
            })
            .catch(function () {
                state.running = false;
                setBusy(form, false);
                showError(form, msg(form, 'error'));
            });
    }

    function retryFailed(form, state) {
        if (state.running || !state.manifest) return;
        var indexes = [];
        state.entries.forEach(function (entry, index) {
            if (entry.status === STATUS_FAILED) indexes.push(index);
        });
        if (indexes.length) launch(form, state, indexes);
    }

    function saveBlob(blob, filename) {
        var objectURL = window.URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = objectURL;
        link.download = filename;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
            window.URL.revokeObjectURL(objectURL);
        }, 1000);
    }

    function save(form, state) {
        if (state.running || !state.manifest) return;
        var archive;
        try {
            archive = assembleArchive(state.manifest, state.entries, new Date());
        } catch (error) {
            showError(form, error && error.code === 'too_large' ? msg(form, 'too-large') : msg(form, 'error'));
            return;
        }
        saveBlob(new Blob(archive.parts, { type: 'application/zip' }), archive.filename);
    }

    function onSubmit(event) {
        var form = event.target;
        if (!form || !form.matches || !form.matches('form[data-lf-bulk-download]')) return;
        event.preventDefault();
        var state = stateFor(form);
        if (state.running) return;
        start(form, state);
    }

    function onClick(event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var form = target.closest('form[data-lf-bulk-download]');
        if (!form) return;
        var state = stateFor(form);
        if (target.closest('[data-lf-action="sheet-close"]')) {
            if (state.handle) state.handle.stop();
            return;
        }
        var button = target.closest('[data-lf-bulk-download-action]');
        if (!button) return;
        event.preventDefault();
        var action = button.getAttribute('data-lf-bulk-download-action');
        if (action === 'stop' && state.handle) state.handle.stop();
        else if (action === 'retry') retryFailed(form, state);
        else if (action === 'save') save(form, state);
    }

    function onBeforeUnload(event) {
        if (activeRuns > 0) {
            event.preventDefault();
            event.returnValue = '';
        }
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('submit', onSubmit);
        document.addEventListener('click', onClick);
        document.addEventListener('change', onChange);
        window.addEventListener && window.addEventListener('beforeunload', onBeforeUnload);
        enablePending(document);
    }

    window.lf.ui.BulkDownload = {
        DEFAULT_CONCURRENCY: DEFAULT_CONCURRENCY,
        enablePending: enablePending,
        MAX_CONCURRENCY: MAX_CONCURRENCY,
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
        MAX_ATTEMPTS: MAX_ATTEMPTS,
        BREAKER_THRESHOLD: BREAKER_THRESHOLD,
        crc32: crc32,
        utf8: utf8,
        buildZip: buildZip,
        classifyStatus: classifyStatus,
        validateDocument: validateDocument,
        parseRetryAfter: parseRetryAfter,
        backoffDelay: backoffDelay,
        downloadFilename: downloadFilename,
        omittedItems: omittedItems,
        sanitizeFilename: sanitizeFilename,
        uniqueName: uniqueName,
        csvCell: csvCell,
        manifestCsv: manifestCsv,
        newEntry: newEntry,
        summarize: summarize,
        runBatch: runBatch,
        assembleArchive: assembleArchive,
        validManifest: validManifest
    };
})();
