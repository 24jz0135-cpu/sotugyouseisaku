import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../スマートフォン/OISO/instant-ledger/frontend-app/relay.js', import.meta.url), 'utf8');
function mobile(receipts, fetch) {
  const nodes = new Map();
  const element = () => ({ append() {}, after() {}, disabled: false, textContent: '' });
  const query = key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); };
  const storage = new Map([['oiso-relay-session', JSON.stringify({ format: 'oiso-relay', deviceId: 'test-pc', uploadUrl: 'https://discord.com/api/webhooks/123/test', expiresAt: Date.now() + 60_000, sessionId: 'S-test' })]]);
  const context = { document: { head: element(), createElement: element, querySelector: query, addEventListener: (event, callback) => callback() },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    receiptVault: { getAll: async () => receipts }, fetch, FormData, File, Uint8Array, atob, AbortSignal,
    setTimeout: callback => { callback(); }, window: {} };
  vm.runInNewContext(source, context);
  return { send: () => query('#relay-send').onclick(), storage, status: () => query('#relay-status').textContent, button: query('#relay-send') };
}
const receipts = count => Array.from({ length: count }, (_, i) => ({ id: `r${i}`, dataUrl: 'data:image/png;base64,aW1hZ2U=', mimeType: 'image/png' }));

test('11 images are sent separately with actual MIME extension', async () => {
  let sent = 0;
  const app = mobile(receipts(11), async (url, options) => {
    assert.equal([...options.body.keys()].filter(key => key.startsWith('files')).length, 1);
    assert.match(options.body.get('files[0]').name, /\.png$/);
    sent++; return { ok: true, status: 200 };
  });
  await app.send(); assert.equal(sent, 11); assert.equal(app.button.disabled, false);
  assert.equal(JSON.parse(app.storage.get('oiso-relay-session-sent-test-pc')).length, 11);
  await app.send(); assert.equal(sent, 11);
});

test('failure preserves confirmed receipts and resumes remaining images', async () => {
  let calls = 0;
  const app = mobile(receipts(3), async () => { calls++; return { ok: calls !== 2, status: calls === 2 ? 500 : 200 }; });
  await app.send(); assert.equal(calls, 2); assert.match(app.status(), /1枚送信済み/);
  await app.send(); assert.equal(calls, 4);
  assert.equal(JSON.parse(app.storage.get('oiso-relay-session')).sentReceiptIds.length, 3);
});

test('rate limit is retried and simultaneous button clicks cannot duplicate a send', async () => {
  let calls = 0;
  const app = mobile(receipts(1), async () => { calls++; return calls === 1 ? { ok: false, status: 429, json: async () => ({ retry_after: 1 }) } : { ok: true, status: 200 }; });
  await Promise.all([app.send(), app.send()]); assert.equal(calls, 2);
  assert.equal(JSON.parse(app.storage.get('oiso-relay-session')).sentReceiptIds.length, 1);
});
