import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(HERE, '../web/js/table/table-server.js'), 'utf8');

function boot(location = 'https://school.example/w/demo/courses') {
    const requests = [];
    const historyCalls = [];
    const window = {
        location: { href: location, origin: new URL(location).origin },
        lf: { ui: {} },
    };
    const history = {
        replaceState(_state, _title, url) { historyCalls.push(url); },
    };
    const htmx = {
        ajax(method, url, options) { requests.push({ method, url, options }); },
    };
    const sandbox = {
        window,
        history,
        htmx,
        document: {},
        console: { log() {}, warn() {}, error() {} },
        URL,
        URLSearchParams,
        parseInt,
        Object,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox);
    return { api: window.lf.ui.table.TableServer, requests, historyCalls };
}

function card(dataset) {
    return { id: 'courses-card', dataset };
}

test('buildServerPaginationURL retains unrelated state while replacing table query state', () => {
    const { api } = boot();
    const url = new URL(api.buildServerPaginationURL(card({
        serverPagination: 'true',
        paginationMode: 'offset',
        paginationUrl: '/action/course/table?jc=IB%20MYP%2FYear%201&page=9&size=50&search=stale&sort=old&dir=desc&filters=stale&tz=UTC',
        currentPage: '1', pageSize: '25', search: '', sortColumn: '', sortDirection: 'asc',
    }), {
        page: 2,
        search: 'math & science',
        sort: 'course/name',
        dir: 'desc',
        filters: 'eyJzdGF0dXMiOiJhY3RpdmUifQ==',
        tz: 'Asia/Manila',
    }));

    assert.equal(url.searchParams.get('jc'), 'IB MYP/Year 1');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('size'), '25');
    assert.equal(url.searchParams.get('search'), 'math & science');
    assert.equal(url.searchParams.get('sort'), 'course/name');
    assert.equal(url.searchParams.get('dir'), 'desc');
    assert.equal(url.searchParams.get('filters'), 'eyJzdGF0dXMiOiJhY3RpdmUifQ==');
    assert.equal(url.searchParams.get('tz'), 'Asia/Manila');
    assert.match(url.toString(), /search=math\+%26\+science/);
    assert.match(url.toString(), /sort=course%2Fname/);
});

test('executeServerRequest keeps unrelated query state in HTMX and browser history', () => {
    const { api, requests, historyCalls } = boot(
        'https://school.example/w/demo/courses?jc=IB%20MYP%2FYear%201&page=9&search=stale&sort=old&dir=desc&filters=stale&tz=UTC',
    );
    const table = card({
        serverPagination: 'true',
        paginationMode: 'offset',
        paginationUrl: '/action/course/table?jc=IB%20MYP%2FYear%201&page=8&search=old&sort=old&dir=asc',
        currentPage: '1', pageSize: '25', search: '', sortColumn: '', sortDirection: 'asc',
    });

    api.executeServerRequest(table, { page: 3, search: 'math & science', sort: 'course/name', dir: 'desc' });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].options.target, '#courses-card');
    const requestURL = new URL(requests[0].url);
    assert.equal(requestURL.searchParams.get('jc'), 'IB MYP/Year 1');
    assert.equal(requestURL.searchParams.get('page'), '3');
    assert.equal(requestURL.searchParams.get('search'), 'math & science');
    assert.equal(requestURL.searchParams.get('sort'), 'course/name');
    assert.equal(requestURL.searchParams.get('dir'), 'desc');

    assert.equal(historyCalls.length, 1);
    const historyURL = new URL(historyCalls[0]);
    assert.equal(historyURL.searchParams.get('jc'), 'IB MYP/Year 1');
    assert.equal(historyURL.searchParams.get('page'), '3');
    assert.equal(historyURL.searchParams.get('search'), 'math & science');
    assert.equal(historyURL.searchParams.get('sort'), 'course/name');
    assert.equal(historyURL.searchParams.get('dir'), 'desc');
    assert.equal(historyURL.searchParams.has('filters'), false);
    assert.equal(historyURL.searchParams.has('tz'), false);
});
