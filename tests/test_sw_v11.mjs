import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../sw-v11.js', import.meta.url), 'utf8');
assert.match(source, /banger-studio-v11/);
assert.doesNotMatch(source, /event\.request\.mode\s*===\s*['"]navigate['"]/);

const handlers = {};
const cached = new Map();
let nextStatus = 200;
const cache = {
  async put(key, value) { cached.set(typeof key === 'string' ? key : key.url, value); },
  async match(key) { return cached.get(typeof key === 'string' ? key : key.url); }
};
const caches = {
  async open() { return cache; },
  async keys() { return ['banger-studio-v10', 'unrelated-cache']; },
  async delete() { return true; },
  async match(key) { return cache.match(key); }
};
const self = {
  location: { origin: 'https://studio.test' },
  clients: { async claim() {} },
  async skipWaiting() {},
  addEventListener(type, handler) { handlers[type] = handler; }
};
async function fetchStub() {
  return new Response(nextStatus === 200 ? 'studio' : 'error', { status: nextStatus });
}

vm.runInNewContext(source, {
  self, caches, fetch: fetchStub, URL, Response, Promise, Error, console, setTimeout, clearTimeout
}, { filename: 'sw-v11.js' });

function dispatch(path, mode = 'navigate') {
  let responsePromise = null;
  handlers.fetch({
    request: { method: 'GET', url: 'https://studio.test' + path, mode },
    respondWith(value) { responsePromise = Promise.resolve(value); }
  });
  return responsePromise;
}

assert.ok(dispatch('/app'), '/app must be handled by the Studio worker');
assert.ok(dispatch('/legacy'), '/legacy must be handled by the Studio worker');
assert.equal(dispatch('/'), null, 'root navigation must reach the server');
assert.equal(dispatch('/index.html'), null, 'index navigation must reach the server');
assert.equal(dispatch('/another-page'), null, 'unrelated navigation must reach the server');
assert.equal(dispatch('/health'), null, 'health must never be intercepted');
assert.ok(dispatch('/manifest.webmanifest', 'no-cors'), 'small shell assets remain cacheable');

await cache.put('/legacy', new Response('cached studio', { status: 200 }));
nextStatus = 503;
const fallback = await dispatch('/app');
assert.equal(fallback.status, 200);
assert.equal(await fallback.text(), 'cached studio');

process.stdout.write(JSON.stringify({
  cache: 'banger-studio-v11',
  studioRoutes: 2,
  passthroughNavigations: 3,
  healthPassthrough: true,
  fiveHundredFallback: true
}) + '\n');
