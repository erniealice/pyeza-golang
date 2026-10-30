// test/bulk-download.test.mjs — unit tests for web/js/components/bulk-download.js
// (window.lf.ui.BulkDownload): CRC-32 vectors, a STORE ZIP that `unzip -t`
// accepts, response classification + validation, retry/backoff/breaker/stop
// behaviour of the bounded-concurrency runner, and the ok + not_ready + failed
// == expected invariant enforced before an archive can be assembled.
//
// The module is a browser IIFE, so it is evaluated in a node:vm context with
// only the globals it touches (same approach as test/cell-grid.test.mjs).
//
// Run: node --test 'test/**/*.test.mjs'

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, '../web/js/components/bulk-download.js'), 'utf8');

function load() {
    const listeners = [];
    const window = {
        addEventListener(type) { listeners.push(type); },
        AbortController,
        setTimeout,
        clearTimeout,
    };
    const document = { addEventListener(type) { listeners.push(type); } };
    const context = vm.createContext({
        window, document, TextEncoder, AbortController, URL, setTimeout, clearTimeout, console,
    });
    vm.runInContext(SRC, context, { filename: 'bulk-download.js' });
    return { api: window.lf.ui.BulkDownload, listeners, context };
}

const { api: BD, listeners } = load();

function ascii(text) { return new Uint8Array(Buffer.from(text, 'latin1')); }

function pdfBytes(size = 900) {
    const head = '%PDF-1.7\n';
    const tail = '\n%%EOF\n';
    return ascii(head + 'x'.repeat(Math.max(0, size - head.length - tail.length)) + tail);
}

function docxBytes(size = 900) {
    const bytes = new Uint8Array(size);
    bytes.set([0x50, 0x4B, 0x03, 0x04]);
    return bytes;
}

function response(status, { body = new Uint8Array(0), type = 'application/pdf', disposition = '', retryAfter = null, redirected = false, omitted = null } = {}) {
    const headers = { 'content-type': type, 'content-disposition': disposition, 'retry-after': retryAfter, 'x-omitted-items': omitted };
    return {
        status,
        redirected,
        body: null,
        headers: { get(name) { const v = headers[name.toLowerCase()]; return v == null || v === '' ? null : v; } },
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
}

function clients(n) {
    return Array.from({ length: n }, (_, i) => ({
        client_id: 'client-' + (i + 1),
        name: 'Learner ' + (i + 1),
        document_url: '/doc/' + (i + 1),
    }));
}

// scriptedFetch answers each URL from a per-URL queue of responses (or Error
// instances to throw); the last item repeats. It records peak concurrency.
function scriptedFetch(script) {
    const calls = [];
    let inFlight = 0;
    let peak = 0;
    const fetch = async (url, init) => {
        calls.push(url);
        inFlight++;
        peak = Math.max(peak, inFlight);
        try {
            await new Promise((resolve) => setImmediate(resolve));
            const queue = script[url] || script['*'];
            const next = queue.length > 1 ? queue.shift() : queue[0];
            const value = typeof next === 'function' ? await next(init) : next;
            if (value instanceof Error) throw value;
            return value;
        } finally {
            inFlight--;
        }
    };
    return { fetch, calls, peak: () => peak };
}

function runner(opts) {
    const delays = [];
    const entries = opts.clients.map(BD.newEntry);
    const handle = BD.runBatch({
        entries,
        format: opts.format || 'pdf',
        concurrency: opts.concurrency,
        fetch: opts.fetch,
        sleep: async (ms) => { delays.push(ms); },
        setTimer: opts.setTimer || (() => 0),
        clearTimer: () => {},
        random: () => 0.5,
        now: () => Date.parse('2026-10-29T00:00:00Z'),
        indexes: opts.indexes,
        onUpdate: opts.onUpdate,
    });
    return { entries, handle, delays };
}

test('enables a pending start button on load and on each re-include', () => {
    const button = (pending) => ({
        disabled: true,
        attrs: { 'data-lf-bulk-download-pending': '' },
        removeAttribute(name) { delete this.attrs[name]; },
    });
    const first = button();
    const second = button();
    let current = [first];
    const listeners = [];
    const window = { addEventListener() {}, AbortController, setTimeout, clearTimeout };
    const document = {
        addEventListener(type) { listeners.push(type); },
        querySelectorAll(selector) {
            assert.equal(selector, 'form[data-lf-bulk-download] [data-lf-bulk-download-pending]');
            return current.filter((b) => 'data-lf-bulk-download-pending' in b.attrs);
        },
    };
    const context = vm.createContext({ window, document, TextEncoder, AbortController, URL, setTimeout, clearTimeout, console });
    vm.runInContext(SRC, context);
    assert.equal(first.disabled, false, 'first include enables the rendered button');
    assert.ok(!('data-lf-bulk-download-pending' in first.attrs));
    current = [first, second];
    vm.runInContext(SRC, context);
    assert.equal(second.disabled, false, 'a re-include (drawer reopened) enables the new button');
    assert.equal(listeners.filter((type) => type === 'submit').length, 1, 'listeners bind once');
});

test('registers delegated listeners and is idempotent on re-evaluation', () => {
    assert.ok(listeners.includes('submit') && listeners.includes('click'));
    const { context } = load();
    const first = context.window.lf.ui.BulkDownload;
    vm.runInContext(SRC, context);
    assert.equal(context.window.lf.ui.BulkDownload, first, 'second include must not rebind');
});

test('crc32 matches the standard check vectors', () => {
    assert.equal(BD.crc32(new Uint8Array(0)), 0);
    assert.equal(BD.crc32(ascii('123456789')), 0xCBF43926);
    assert.equal(BD.crc32(ascii('The quick brown fox jumps over the lazy dog')), 0x414FA339);
});

test('buildZip produces a STORE archive that unzip -t verifies, with UTF-8 names', (t) => {
    const files = [
        { name: '_manifest.csv', data: BD.utf8('client_id\r\nc-1\r\n') },
        { name: 'Ñiño, Ana.pdf', data: pdfBytes(2048) },
        { name: 'empty.docx', data: new Uint8Array(0) },
    ];
    const zip = BD.buildZip(files, new Date(2026, 9, 29, 8, 30, 10));
    const bytes = Buffer.concat(zip.parts.map((p) => Buffer.from(p)));
    assert.equal(bytes.length, zip.size);
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    assert.equal(bytes.readUInt16LE(6) & 0x0800, 0x0800, 'UTF-8 flag');
    assert.equal(bytes.readUInt16LE(8), 0, 'STORE');
    const eocd = bytes.length - 22;
    assert.equal(bytes.readUInt32LE(eocd), 0x06054b50);
    assert.equal(bytes.readUInt16LE(eocd + 10), files.length);

    let hasUnzip = true;
    try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { hasUnzip = false; }
    if (!hasUnzip) { t.skip('unzip not installed'); return; }
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bulk-download-zip-'));
    try {
        const file = path.join(dir, 'batch.zip');
        writeFileSync(file, bytes);
        const verdict = execFileSync('unzip', ['-t', file], { encoding: 'utf8' });
        assert.match(verdict, /No errors detected/);
        const manifest = execFileSync('unzip', ['-p', file, '_manifest.csv']);
        assert.equal(Buffer.compare(manifest, Buffer.from(files[0].data)), 0);
        // Info-ZIP builds without UNICODE_SUPPORT (macOS) print UTF-8 names as
        // CP437, so names are checked with Python's zipfile, which honours the
        // UTF-8 flag (bit 11) and re-verifies every CRC.
        let python = true;
        try { execFileSync('python3', ['-I', '-c', 'import zipfile'], { stdio: 'ignore' }); } catch { python = false; }
        if (python) {
            const script = 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\n' +
                'print(json.dumps([[i.filename,i.compress_type,i.flag_bits&0x800,len(z.read(i))] for i in z.infolist()]))';
            const infos = JSON.parse(execFileSync('python3', ['-I', '-c', script, file], { encoding: 'utf8' }));
            assert.deepEqual(infos, files.map((f) => [f.name, 0, 0x800, f.data.length]));
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('buildZip refuses an archive that would need ZIP64 entry counts', () => {
    const many = { length: 0xFFFF };
    assert.throws(() => BD.buildZip(many), (error) => error.code === 'too_large');
});

test('classifyStatus separates retryable, terminal, not-ready and fatal', () => {
    const kind = (status) => BD.classifyStatus(status).kind;
    assert.equal(kind(200), 'ok');
    for (const s of [429, 500, 502, 503, 504]) assert.equal(kind(s), 'retry', String(s));
    for (const s of [400, 403, 404, 422]) assert.equal(kind(s), 'terminal', String(s));
    assert.equal(kind(409), 'not_ready');
    assert.equal(kind(401), 'fatal');
    assert.equal(BD.classifyStatus(503).reason, 'http_503');
});

test('validateDocument checks type, magic, %%EOF window and size floor', () => {
    assert.equal(BD.validateDocument('pdf', 'application/pdf', pdfBytes()).ok, true);
    assert.equal(BD.validateDocument('pdf', 'application/pdf; charset=binary', pdfBytes()).ok, true);
    assert.equal(BD.validateDocument('pdf', 'text/html', pdfBytes()).ok, false, 'login page');
    assert.equal(BD.validateDocument('pdf', 'application/octet-stream', pdfBytes()).ok, false);
    assert.equal(BD.validateDocument('pdf', 'application/pdf', pdfBytes(100)).ok, false, 'size floor');
    const truncated = pdfBytes(4000).slice(0, 3000);
    assert.equal(BD.validateDocument('pdf', 'application/pdf', truncated).ok, false, 'truncated: no %%EOF');
    const eofEarly = new Uint8Array(4000);
    eofEarly.set(ascii('%PDF-1.7\n%%EOF\n'));
    assert.equal(BD.validateDocument('pdf', 'application/pdf', eofEarly).ok, false, '%%EOF outside last 1 KiB');
    assert.equal(BD.validateDocument('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBytes()).ok, true);
    assert.equal(BD.validateDocument('docx', 'application/octet-stream', pdfBytes()).ok, false);
});

test('Retry-After and backoff are bounded', () => {
    const now = Date.parse('2026-10-29T00:00:00Z');
    assert.equal(BD.parseRetryAfter('2', now), 2000);
    assert.equal(BD.parseRetryAfter('9999', now), 60000);
    assert.equal(BD.parseRetryAfter(new Date(now + 5000).toUTCString(), now), 5000);
    assert.equal(BD.parseRetryAfter('soon', now), null);
    assert.equal(BD.parseRetryAfter(null, now), null);
    for (let attempt = 1; attempt <= 6; attempt++) {
        const low = BD.backoffDelay(attempt, () => 0);
        const high = BD.backoffDelay(attempt, () => 0.999);
        assert.ok(low > 0 && low <= high && high <= 20000, `attempt ${attempt}: ${low}..${high}`);
    }
    assert.ok(BD.backoffDelay(2, () => 0) > BD.backoffDelay(1, () => 0));
});

test('filenames come from Content-Disposition, are sanitised and de-duplicated', () => {
    assert.equal(BD.downloadFilename(`attachment; filename="a.pdf"; filename*=UTF-8''%C3%91i%C3%B1o.pdf`), 'Ñiño.pdf');
    assert.equal(BD.downloadFilename('attachment; filename="say \\"hi\\".pdf"'), 'say "hi".pdf');
    assert.equal(BD.downloadFilename(''), '');
    assert.equal(BD.sanitizeFilename('../../etc/passwd', 'x', 'pdf'), '-..-etc-passwd.pdf');
    assert.equal(BD.sanitizeFilename('', 'learner-1', 'pdf'), 'learner-1.pdf');
    assert.equal(BD.sanitizeFilename('card.PDF', 'x', 'pdf'), 'card.PDF');
    const used = new Set(['_manifest.csv']);
    assert.equal(BD.uniqueName('card.pdf', used), 'card.pdf');
    assert.equal(BD.uniqueName('Card.pdf', used), 'Card (2).pdf');
    assert.equal(BD.uniqueName('card.pdf', used), 'card (3).pdf');
    assert.equal(BD.uniqueName('_MANIFEST.csv', used), '_MANIFEST (2).csv');
});

test('manifest CSV neutralises formula injection and quotes', () => {
    assert.equal(BD.csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
    assert.equal(BD.csvCell('+1'), "'+1");
    assert.equal(BD.csvCell('@cmd'), "'@cmd");
    assert.equal(BD.csvCell('Cruz, Ana'), '"Cruz, Ana"');
    assert.equal(BD.csvCell(3), '3');
    const csv = BD.manifestCsv([{ client_id: 'c-1', client_name: '-x', filename: '', status: 'failed', bytes: 0, attempts: 3, reason: 'http_503' }]);
    assert.equal(csv, "﻿client_id,client_name,filename,status,bytes,attempts,reason,omitted_items\r\nc-1,'-x,,failed,0,3,http_503,\r\n");
});

test('runner honours the configured concurrency, retries transient faults and settles every item', async () => {
    const script = scriptedFetch({
        '/doc/1': [response(503, { retryAfter: '2' }), response(200, { body: pdfBytes(), disposition: 'attachment; filename="one.pdf"' })],
        '/doc/2': [response(404)],
        '/doc/3': [response(409)],
        '/doc/4': [new TypeError('network'), response(200, { body: pdfBytes() })],
        '/doc/5': [response(200, { body: pdfBytes(4000).slice(0, 3000) }), response(200, { body: pdfBytes() })],
        '*': [response(200, { body: pdfBytes() })],
    });
    const { entries, handle, delays } = runner({ clients: clients(9), fetch: script.fetch, concurrency: 6 });
    const result = await handle.promise;
    assert.equal(script.peak(), 6, 'never more than the configured 6 in flight');
    assert.equal(result.outcome, 'complete');
    assert.deepEqual(entries.map((e) => e.status), ['ok', 'failed', 'not_ready', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    assert.equal(entries[0].attempts, 2);
    assert.equal(entries[1].attempts, 1, '404 is terminal');
    assert.equal(entries[1].reason, 'http_404');
    assert.equal(entries[2].attempts, 1, '409 is not retried');
    assert.equal(entries[4].attempts, 2, 'invalid 200 body is retried');
    assert.equal(delays[0], 2000, 'Retry-After honoured');
    assert.equal(result.counts.ok + result.counts.not_ready + result.counts.failed, result.counts.expected);
    assert.equal(result.counts.invariant, true);
});

test('runner clamps an oversized setting to the safety ceiling and defaults a missing one', async () => {
    const big = scriptedFetch({ '*': [response(200, { body: pdfBytes() })] });
    await runner({ clients: clients(14), fetch: big.fetch, concurrency: 50 }).handle.promise;
    assert.equal(big.peak(), 10, 'safety ceiling is 10');
    const unset = scriptedFetch({ '*': [response(200, { body: pdfBytes() })] });
    await runner({ clients: clients(14), fetch: unset.fetch }).handle.promise;
    assert.equal(unset.peak(), 6, 'missing setting falls back to 6');
});

test('retries stop after 3 attempts with the last reason', async () => {
    const script = scriptedFetch({ '*': [response(200, { body: pdfBytes(100) })] });
    const { entries, handle } = runner({ clients: clients(1), fetch: script.fetch });
    await handle.promise;
    assert.equal(entries[0].status, 'failed');
    assert.equal(entries[0].attempts, 3);
    assert.equal(entries[0].reason, 'invalid_document');
});

test('breaker aborts after 3 consecutive server-class failures and settles the rest', async () => {
    const script = scriptedFetch({ '*': [response(500)] });
    const { entries, handle } = runner({ clients: clients(12), fetch: script.fetch, concurrency: 1 });
    const result = await handle.promise;
    assert.equal(result.outcome, 'aborted');
    assert.equal(script.calls.length, 9, '3 items x 3 attempts, then stop');
    assert.deepEqual(entries.slice(0, 3).map((e) => e.reason), ['http_500', 'http_500', 'http_500']);
    assert.ok(entries.slice(3).every((e) => e.status === 'failed' && e.reason === 'aborted'));
    assert.equal(result.counts.invariant, true);
});

test('a success between server failures resets the breaker', async () => {
    const script = scriptedFetch({
        '/doc/3': [response(200, { body: pdfBytes() })],
        '*': [response(502)],
    });
    const { entries, handle } = runner({ clients: clients(5), fetch: script.fetch, concurrency: 1 });
    const result = await handle.promise;
    assert.equal(result.outcome, 'complete');
    assert.deepEqual(entries.map((e) => e.status), ['failed', 'failed', 'ok', 'failed', 'failed']);
});

test('timeouts are retried but never trip the breaker', async () => {
    const timeoutMs = 180000;
    const fetch = (url, init) => new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const setTimer = (fn, ms) => { if (ms === timeoutMs) queueMicrotask(fn); return 0; };
    const { entries, handle } = runner({ clients: clients(5), fetch, concurrency: 1, setTimer });
    const result = await handle.promise;
    assert.equal(result.outcome, 'complete', 'slow files must not abort the batch');
    assert.ok(entries.every((e) => e.status === 'failed' && e.reason === 'timeout' && e.attempts === 3));
});

test('401 or a redirect to an HTML page aborts the batch', async () => {
    for (const first of [response(401), response(200, { type: 'text/html; charset=utf-8', redirected: true, body: ascii('<html>'.repeat(200)) })]) {
        const script = scriptedFetch({ '/doc/1': [first], '*': [response(200, { body: pdfBytes() })] });
        const { entries, handle } = runner({ clients: clients(4), fetch: script.fetch, concurrency: 1 });
        const result = await handle.promise;
        assert.equal(result.outcome, 'aborted');
        assert.equal(entries[0].reason, 'unauthenticated');
        assert.equal(script.calls.length, 1);
        assert.equal(result.counts.invariant, true);
    }
});

test('stop() aborts in-flight requests and settles everything as stopped', async () => {
    let handleRef;
    let started = 0;
    const fetch = (url, init) => new Promise((resolve, reject) => {
        started++;
        if (started === 6) setImmediate(() => handleRef.stop());
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const { entries, handle } = runner({ clients: clients(6), fetch });
    handleRef = handle;
    const result = await handle.promise;
    assert.equal(result.outcome, 'stopped');
    assert.equal(started, 6);
    assert.ok(entries.every((e) => e.status === 'failed' && e.reason === 'stopped'));
    assert.equal(result.counts.invariant, true);
});

test('retrying only the failed indexes keeps settled items untouched', async () => {
    const first = scriptedFetch({ '/doc/2': [response(503)], '*': [response(200, { body: pdfBytes() })] });
    const run1 = runner({ clients: clients(3), fetch: first.fetch });
    await run1.handle.promise;
    assert.deepEqual(run1.entries.map((e) => e.status), ['ok', 'failed', 'ok']);

    const second = scriptedFetch({ '*': [response(200, { body: pdfBytes() })] });
    const entries = run1.entries;
    const handle = BD.runBatch({
        entries, indexes: [1], format: 'pdf', fetch: second.fetch,
        sleep: async () => {}, setTimer: () => 0, clearTimer: () => {},
    });
    const result = await handle.promise;
    assert.deepEqual(second.calls, ['/doc/2']);
    assert.deepEqual(entries.map((e) => e.status), ['ok', 'ok', 'ok']);
    assert.equal(result.counts.ok, 3);
});

test('assembleArchive writes _manifest.csv, names partial archives explicitly and refuses unsettled batches', async () => {
    const manifest = { expected: 3, format: 'pdf', zip_filename: 'grade-7-term-1-pdf.zip' };
    const entries = clients(3).map(BD.newEntry);
    assert.throws(() => BD.assembleArchive(manifest, entries), (error) => error.code === 'invariant');

    const script = scriptedFetch({
        '/doc/1': [response(200, { body: pdfBytes(), disposition: 'attachment; filename="card.pdf"' })],
        '/doc/2': [response(200, { body: pdfBytes(), disposition: 'attachment; filename="card.pdf"' })],
        '/doc/3': [response(422)],
    });
    const handle = BD.runBatch({ entries, format: 'pdf', fetch: script.fetch, sleep: async () => {}, setTimer: () => 0, clearTimer: () => {} });
    await handle.promise;
    const archive = BD.assembleArchive(manifest, entries, new Date(2026, 9, 29));
    assert.equal(archive.complete, false);
    assert.equal(archive.filename, 'grade-7-term-1-pdf-incomplete-2-of-3.zip');
    const bytes = Buffer.concat(archive.parts.map((p) => Buffer.from(p)));
    const text = bytes.toString('latin1');
    assert.ok(text.includes('_manifest.csv') && text.includes('card.pdf') && text.includes('card (2).pdf'));
    assert.ok(text.includes('client-3,Learner 3,,failed,0,1,http_422'));

    const all = clients(1).map(BD.newEntry);
    const ok = scriptedFetch({ '*': [response(200, { body: pdfBytes() })] });
    await BD.runBatch({ entries: all, format: 'pdf', fetch: ok.fetch, sleep: async () => {}, setTimer: () => 0, clearTimer: () => {} }).promise;
    const complete = BD.assembleArchive({ expected: 1, format: 'pdf', zip_filename: 'g-s1-pdf.zip' }, all);
    assert.equal(complete.complete, true);
    assert.equal(complete.filename, 'g-s1-pdf.zip');
    assert.equal(complete.counts.ok, 1);
});

test('manifest lists the items each document omitted without changing the counts', async () => {
    assert.equal(BD.omittedItems('Item%20A; Item%20B%3B%20%28Pair%29'), 'Item A; Item B; (Pair)');
    assert.equal(BD.omittedItems('bad%E0; ok'), 'bad%E0; ok');
    assert.equal(BD.omittedItems(null), '');
    const entries = clients(3).map(BD.newEntry);
    const script = scriptedFetch({
        '/doc/1': [response(200, { body: pdfBytes(), omitted: 'Item%20A; Item%20A%20%28Pair%29' })],
        '/doc/2': [response(200, { body: pdfBytes() })],
        '/doc/3': [response(422, { omitted: 'Item%20C' })],
    });
    await BD.runBatch({ entries, format: 'pdf', fetch: script.fetch, sleep: async () => {}, setTimer: () => 0, clearTimer: () => {} }).promise;
    const archive = BD.assembleArchive({ expected: 3, format: 'pdf', zip_filename: 'g.zip' }, entries, new Date(2026, 9, 30));
    assert.equal(archive.counts.ok + archive.counts.not_ready + archive.counts.failed, archive.counts.expected);
    const text = Buffer.concat(archive.parts.map((p) => Buffer.from(p))).toString('latin1');
    assert.ok(text.includes('reason,omitted_items'));
    assert.ok(text.includes(',ok,') && text.includes('Item A; Item A (Pair)'));
    assert.ok(text.includes('client-3,Learner 3,,failed,0,1,http_422,\r\n'), 'a failed item lists nothing');
    assert.ok(!text.includes('Item C'));
});

test('validManifest requires expected == clients.length and usable entries', () => {
    const good = { expected: 1, format: 'pdf', clients: [{ client_id: 'c', name: 'n', document_url: '/d' }] };
    assert.equal(BD.validManifest(good), true);
    assert.equal(BD.validManifest({ ...good, expected: 2 }), false);
    assert.equal(BD.validManifest({ ...good, clients: [], expected: 0 }), false);
    assert.equal(BD.validManifest({ ...good, format: 'xlsx' }), false);
    assert.equal(BD.validManifest({ ...good, clients: [{ client_id: '', document_url: '/d' }] }), false);
});
