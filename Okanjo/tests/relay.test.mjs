import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acknowledgeReceipts, expireSessions } from '../共通/OISO/common-relay/lifecycle.mjs';
import { download } from '../デスクトップ/OISO/oiso2/bridge/download.mjs';
import { saveLocalImage } from '../デスクトップ/OISO/oiso2/bridge/upload.mjs';

test('oversized and interrupted local uploads leave no images or temporary files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'oiso-upload-'));
  try {
    async function* oversized() { yield Buffer.alloc(20 * 1024 * 1024); yield Buffer.alloc(1); }
    await assert.rejects(saveLocalImage(oversized(), dir), /20MB/);
    async function* interrupted() { yield Buffer.from('89504e470d0a1a0a', 'hex'); throw Error('connection closed'); }
    await assert.rejects(saveLocalImage(interrupted(), dir), /connection closed/);
    assert.deepEqual(await readdir(dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('partial acknowledgement preserves unsaved images and failed deletion retries', async () => {
  const state = { receipts: {
    a: { id: 'a', deviceId: 'pc', messageId: 'm', channelId: 'c' },
    b: { id: 'b', deviceId: 'pc', messageId: 'm', channelId: 'c' }
  } };
  let deleted = 0;
  const remove = async () => { deleted++; }, save = async () => {};
  await acknowledgeReceipts(state, 'other', ['a', 'b'], remove, save);
  assert.equal(deleted, 0);
  await acknowledgeReceipts(state, 'pc', ['a'], remove, save);
  assert.equal(deleted, 0);
  await acknowledgeReceipts(state, 'pc', ['b'], async () => { throw Error('offline'); }, save);
  assert.equal(Object.keys(state.receipts).length, 2);
  await acknowledgeReceipts(state, null, [], remove, save);
  assert.equal(deleted, 1); assert.deepEqual(state.receipts, {});
});

test('expired webhook cleanup survives restart and retries failures', async () => {
  const state = { sessions: { old: { expiresAt: 1, webhookId: 'old' }, active: { expiresAt: 100, webhookId: 'active' } }, pairings: { unused: { expiresAt: 1, deviceId: 'unused' } }, devices: { unused: {} } };
  await expireSessions(state, 50, async () => { throw Error('offline'); });
  assert.ok(state.sessions.old); assert.equal(state.devices.unused, undefined);
  await expireSessions(state, 50, async id => assert.equal(id, 'old'));
  assert.equal(state.sessions.old, undefined); assert.ok(state.sessions.active);
});

test('incomplete download is never exposed as a received image', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'oiso-download-'));
  const server = createServer((req, res) => res.end('image'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}/image`, target = join(dir, 'receipt.jpg');
  await assert.rejects(download(url, target, 100), /受信が完了/);
  assert.deepEqual(await readdir(dir), []);
  await download(url, target, 5);
  assert.equal(await readFile(target, 'utf8'), 'image');
});

test('Bridge UI, JSON preflight, origin protection, inbox and mock CSV work end to end', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'oiso-bridge-'));
  await mkdir(join(dir, 'bridge-data', 'inbox'), { recursive: true });
  await writeFile(join(dir, 'bridge-data', 'inbox', 'R-TEST__receipt.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../デスクトップ/OISO/oiso2/bridge/index.mjs', import.meta.url))], {
    cwd: dir, windowsHide: true, env: { ...process.env, PORT: String(port), COMMON_RELAY_URL: '', COMMON_RELAY_DEVICE_TOKEN: '', DISCORD_BOT_TOKEN: '', DISCORD_CHANNEL_ID: '', ANALYZER_MODE: 'mock', AUTO_ANALYZE: 'false' }
  });
  t.after(async () => { if (child.exitCode === null) { const closed = once(child, 'exit'); child.kill(); await closed; } await rm(dir, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Bridge startup timeout')), 60_000);
    child.stdout.on('data', data => { if (String(data).includes('OISO2 Bridge:')) { clearTimeout(timer); resolve(); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Bridge exited: ${code}`)); });
    child.stderr.on('data', data => process.stderr.write(data));
  });
  const base = `http://127.0.0.1:${port}`;
  assert.match(await (await fetch(base)).text(), /OISO2/);
  for (const asset of ['tax.js', 'tax-ui.js']) {
    const response = await fetch(`${base}/${asset}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  const preflight = await fetch(`${base}/api/analyze`, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:4174', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type');
  assert.equal((await fetch(`${base}/api/mobile-sessions`, { method: 'POST', headers: { Origin: 'https://example.com' } })).status, 403);
  const inbox = await (await fetch(`${base}/api/inbox`)).json(); assert.equal(inbox.receipts.length, 1);
  const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4174' }, body: JSON.stringify({ ids: ['R-TEST'] }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, 'mock'); assert.equal(result.sentToDiscord, false); assert.equal(result.records[0].receiptId, 'R-TEST');
  assert.match(result.csv, /R-TEST/);
  assert.match(await readFile(join(dir, 'bridge-data', 'results', `${result.jobId}.csv`), 'utf8'), /R-TEST/);
  const image = await readFile(join(dir, 'bridge-data', 'inbox', 'R-TEST__receipt.png'));
  const uploaded = await fetch(`${base}/api/inbox`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image });
  assert.equal(uploaded.status, 201);
  const local = await uploaded.json();
  assert.match(local.id, /^L-/);
  assert.deepEqual(Buffer.from(await (await fetch(`${base}${local.url}`)).arrayBuffer()), image);
  const localResult = await (await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [local.id, 'R-TEST'] }) })).json();
  assert.deepEqual(localResult.records.map(row => row.receiptId), [local.id, 'R-TEST']);
  assert.equal((await fetch(`${base}/api/inbox`, { method: 'POST', body: '<svg>not a receipt</svg>' })).status, 400);
  assert.equal((await fetch(`${base}/api/inbox`, { method: 'POST', body: '' })).status, 400);
  assert.equal((await fetch(`${base}/api/inbox`, { method: 'POST', headers: { Origin: 'https://example.com' }, body: image })).status, 403);
  assert.equal((await (await fetch(`${base}/api/inbox`)).json()).receipts.length, 2);
});
