import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { download } from './download.mjs';
import { saveLocalImage } from './upload.mjs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';
import { fileURLToPath } from 'node:url';
const appDirectory = fileURLToPath(new URL('../', import.meta.url));

try {
  const envFile = await readFile(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env is optional; process environment variables also work. */ }

const config = { token: process.env.DISCORD_BOT_TOKEN, channelId: process.env.DISCORD_CHANNEL_ID, port: Number(process.env.PORT || 8788), analyzer: process.env.ANALYZER_MODE || 'mock', codex: process.env.CODEX_COMMAND || 'codex', autoAnalyze: process.env.AUTO_ANALYZE === 'true', commonRelayUrl: (process.env.COMMON_RELAY_URL || '').replace(/\/$/, '') };
const root = resolve(process.cwd(), 'bridge-data');
const inbox = join(root, 'inbox');
const results = join(root, 'results');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const mimeFor = filename => ({ '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[extname(filename).toLowerCase()] || 'image/jpeg');
await Promise.all([mkdir(inbox, { recursive: true }), mkdir(results, { recursive: true })]);
const commonRelayFile = join(root, 'common-relay.json');
let commonRelay = { deviceToken: process.env.COMMON_RELAY_DEVICE_TOKEN || '', pendingPairs: {} };
if (!commonRelay.deviceToken) { try { commonRelay = { ...commonRelay, ...JSON.parse(await readFile(commonRelayFile, 'utf8')) }; } catch { /* not paired yet */ } }
const commonEnabled = () => Boolean(config.commonRelayUrl);
async function saveCommonRelay() { await writeFile(commonRelayFile, JSON.stringify(commonRelay), 'utf8'); }
async function commonRequest(path, options = {}) {
  if (!commonEnabled()) throw new Error('COMMON_RELAY_URL が未設定です');
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(commonRelay.deviceToken ? { Authorization: `Bearer ${commonRelay.deviceToken}` } : {}), ...options.headers };
  const response = await fetch(`${config.commonRelayUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(30_000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '共通Relayとの通信に失敗しました');
  return payload;
}

function csvEscape(value) { const text = value == null ? '' : String(value); return /[\",\n]/.test(text) ? `\"${text.replaceAll('\"', '\"\"')}\"` : text; }
function toCsv(records) { const fields = ['receiptId', 'date', 'vendor', 'amount', 'category', 'confidence']; return [fields.join(','), ...records.map(record => fields.map(field => csvEscape(record[field])).join(','))].join('\n'); }
async function listInbox() {
  const files = await readdir(inbox);
  const rows = await Promise.all(files.filter(file => imageExtensions.has(extname(file).toLowerCase())).map(async file => {
    const info = await stat(join(inbox, file)); const [id] = file.split('__');
    return { id, fileName: file.slice(file.indexOf('__') + 2), size: info.size, receivedAt: info.mtime.toISOString(), url: `/api/files/${encodeURIComponent(file)}` };
  }));
  return rows.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}
async function saveAttachment(attachment) {
  const sourceName = basename(attachment.name || 'receipt.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!imageExtensions.has(extname(sourceName).toLowerCase())) return null;
  if (attachment.size > 20 * 1024 * 1024) throw new Error(`${sourceName} は20MBを超えています`);
  const id = `D-${randomUUID().slice(0, 8).toUpperCase()}`;
  const destination = join(inbox, `${id}__${sourceName}`);
  await download(attachment.url, destination, attachment.size);
  return { id, fileName: sourceName };
}
let inboxSync;
function syncCommonRelayInbox() {
  if (!inboxSync) inboxSync = receiveCommonRelayInbox().finally(() => { inboxSync = null; });
  return inboxSync;
}
async function receiveCommonRelayInbox() {
  if (!commonEnabled() || !commonRelay.deviceToken) return [];
  const { receipts } = await commonRequest('/api/inbox');
  const existing = new Set((await listInbox()).map(item => item.id));
  const acknowledged = [], saved = [];
  for (const receipt of receipts) {
    if (existing.has(receipt.id)) { acknowledged.push(receipt.id); continue; }
    const sourceName = basename(receipt.name || 'receipt.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!/^R-[A-Z0-9-]+$/.test(receipt.id) || !imageExtensions.has(extname(sourceName).toLowerCase())) continue;
    try { await download(receipt.attachmentUrl, join(inbox, `${receipt.id}__${sourceName}`), receipt.size); }
    catch (error) { console.warn(`画像受信失敗 ${receipt.id}: ${error.message}`); continue; }
    acknowledged.push(receipt.id); saved.push(receipt.id);
  }
  if (config.autoAnalyze && saved.length) queueReceiptAnalysis(saved);
  if (acknowledged.length) await commonRequest('/api/inbox/ack', { method: 'POST', body: JSON.stringify({ ids: acknowledged }) });
  return saved;
}
async function receiptFiles(ids) { const rows = await listInbox(); const byId = new Map(rows.map(row => [row.id, row])); return ids.map(id => byId.get(id)).filter(Boolean).map(row => ({ ...row, path: join(inbox, `${row.id}__${row.fileName}`) })); }
function run(command, args) { return new Promise((resolveRun, reject) => {
  const child = spawn(command, args, { cwd: root, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  const timer = setTimeout(() => { child.kill(); reject(new Error('解析が5分以内に完了しませんでした。Codexのログインと利用枠を確認してください。')); }, 300_000);
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-8000); });
  child.on('error', error => { clearTimeout(timer); reject(error); });
  child.on('close', code => { clearTimeout(timer); code === 0 ? resolveRun() : reject(new Error(stderr || `${command} exited with ${code}`)); });
}); }
async function analyze(ids) {
  const files = await receiptFiles(ids); if (!files.length) throw new Error('解析する受信画像を選択してください');
  const jobId = `job-${Date.now()}-${randomUUID().slice(0, 8)}`; let records;
  if (config.analyzer === 'codex') {
    const outputPath = join(results, `${jobId}.json`); const imagePaths = files.map(file => file.path).join(',');
    const prompt = `画像内の各レシートを解析してください。画像の対応IDは順に ${files.map(file => file.id).join(', ')} です。日付、店名、合計金額、勘定科目候補を抽出し、読めない値は null にしてください。JSONだけを返してください。`;
    await run(config.codex, ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--image', imagePaths, '--output-schema', fileURLToPath(new URL('./schema.json', import.meta.url)), '--output-last-message', outputPath, prompt]);
    records = JSON.parse(await readFile(outputPath, 'utf8')).records;
    const expected = new Set(files.map(file => file.id));
    if (!Array.isArray(records) || records.length !== expected.size || records.some(record => !record || !expected.delete(record.receiptId) || !['date', 'vendor', 'category'].every(key => record[key] === null || typeof record[key] === 'string') || !['amount', 'confidence'].every(key => record[key] === null || Number.isFinite(record[key])))) throw new Error('解析結果の形式またはレシートIDが一致しません。再解析してください。');
  } else records = files.map(file => ({ receiptId: file.id, date: null, vendor: null, amount: null, category: null, confidence: null }));
  const csv = toCsv(records); const csvPath = join(results, `${jobId}.csv`); await writeFile(csvPath, `\uFEFF${csv}`, 'utf8');
  return { jobId, records, csv, csvPath, mode: config.analyzer };
}
let discordChannel = null;
let analysisQueue = Promise.resolve();
const jobs = new Map();
const mobileSessions = new Map();
function expireSession(sessionId) {
  const session = mobileSessions.get(sessionId);
  if (!session) return;
  mobileSessions.delete(sessionId);
  session.webhook?.delete('OISO mobile relay session expired').catch(() => {});
}
async function createMobileSession() {
  if (commonEnabled()) {
    if (!commonRelay.deviceToken) throw new Error('先に共通Relayをペアリングしてください');
    const payload = await commonRequest('/api/mobile-sessions', { method: 'POST' });
    return { ...payload, qrDataUrl: await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1, width: 280 }) };
  }
  if (!discordChannel?.createWebhook) throw new Error('Discord Bridgeを接続してから一時QRを作成してください');
  const sessionId = `S-${randomUUID().slice(0, 8).toUpperCase()}`;
  const webhook = await discordChannel.createWebhook({ name: `OISO-${sessionId}` });
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = { format: 'oiso-relay', version: 1, sessionId, uploadUrl: webhook.url, expiresAt };
  mobileSessions.set(sessionId, { webhook, expiresAt });
  setTimeout(() => expireSession(sessionId), 10 * 60 * 1000 + 1000).unref();
  return { ...payload, qrDataUrl: await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1, width: 280 }) };
}
async function sendResultToDiscord(result) {
  if (commonEnabled() && commonRelay.deviceToken) return commonRequest('/api/results', { method: 'POST', body: JSON.stringify({ jobId: result.jobId, fileName: `oiso2_${result.jobId}.csv`, csv: result.csv }) });
  if (discordChannel) await discordChannel.send({ content: `OISO2解析結果 ${result.jobId}（${result.records.length}件）`, files: [result.csvPath] });
}
function queueReceiptAnalysis(ids) {
  const jobId = `queue-${Date.now()}-${randomUUID().slice(0, 4)}`;
  jobs.set(jobId, { id: jobId, ids, status: 'queued', createdAt: new Date().toISOString() });
  analysisQueue = analysisQueue.catch(() => {}).then(async () => {
    const job = jobs.get(jobId); job.status = 'running'; job.startedAt = new Date().toISOString();
    try { const result = await analyze(ids); await sendResultToDiscord(result); Object.assign(job, { status: 'completed', completedAt: new Date().toISOString(), resultId: result.jobId }); }
    catch (error) { Object.assign(job, { status: 'failed', completedAt: new Date().toISOString(), error: error.message }); if (discordChannel) await discordChannel.send(`OISO2解析失敗（${jobId}）: ${error.message}`); }
  });
  return jobId;
}
async function bootDiscord() {
  if (commonEnabled()) { console.log('OISO Common Relay経由で接続します。'); return; }
  if (!config.token || !config.channelId) { console.log('Discord未設定: ローカルAPIのみを起動します。'); return; }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel] });
  client.once('ready', async () => { discordChannel = await client.channels.fetch(config.channelId); console.log(`Discord Relay接続済み: ${client.user.tag}`); });
  client.on('messageCreate', async message => {
    const isOisoWebhook = message.webhookId && [...mobileSessions.values()].some(session => session.webhook.id === message.webhookId);
    if ((!isOisoWebhook && message.author.bot) || message.channelId !== config.channelId || !message.attachments.size) return;
    try {
      const saved = (await Promise.all([...message.attachments.values()].map(saveAttachment))).filter(Boolean);
      if (!saved.length) return;
      if (config.autoAnalyze) {
        const jobId = queueReceiptAnalysis(saved.map(file => file.id));
        if (!isOisoWebhook) await message.reply(`OISO2が${saved.length}枚を受信し、固定のレシート解析ジョブ ${jobId} をキューへ追加しました。`);
      } else if (!isOisoWebhook) await message.reply(`OISO2が${saved.length}枚をPCの受信箱へ保存しました。OISO2で確認・解析できます。`);
    } catch (error) { if (!isOisoWebhook) await message.reply(`受信に失敗しました: ${error.message}`); }
  });
  await client.login(config.token);
}
function allowedOrigin(request) { const origin = request.headers.origin || ''; return /^https?:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) ? origin : 'http://127.0.0.1:4174'; }
function json(response, status, body, request) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': allowedOrigin(request) }); response.end(JSON.stringify(body)); }
function parseBody(request) { return new Promise((resolveBody, reject) => { let text = ''; request.on('data', chunk => { text += chunk; if (text.length > 100000) request.destroy(); }); request.on('end', () => { try { resolveBody(text ? JSON.parse(text) : {}); } catch { reject(new Error('JSON形式が不正です')); } }); request.on('error', reject); }); }
const server = createServer(async (request, response) => {
  if (request.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(request.headers.origin)) return json(response, 403, { error: 'PC上のOISO2から操作してください' }, request);
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': allowedOrigin(request), 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' }); return response.end(); }
  try { const url = new URL(request.url, `http://${request.headers.host}`);
    const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    if (request.method === 'GET' && assets[url.pathname]) {
      const [name, type] = assets[url.pathname];
      response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      return response.end(await readFile(join(appDirectory, name)));
    }
    if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, discord: Boolean(discordChannel) || Boolean(commonRelay.deviceToken), commonRelay: commonEnabled(), paired: Boolean(commonRelay.deviceToken), analyzer: config.analyzer, autoAnalyze: config.autoAnalyze }, request);
    if (request.method === 'GET' && url.pathname === '/api/jobs') return json(response, 200, { jobs: [...jobs.values()].slice(-20).reverse() }, request);
    if (request.method === 'POST' && url.pathname === '/api/mobile-sessions') return json(response, 200, await createMobileSession(), request);
    if (request.method === 'POST' && url.pathname === '/api/common-relay/pairings') { const pairing = await commonRequest('/api/pairings', { method: 'POST' }); commonRelay.pendingPairs = { ...commonRelay.pendingPairs, [pairing.code]: pairing.claimToken }; await saveCommonRelay(); return json(response, 201, { code: pairing.code, expiresAt: pairing.expiresAt }, request); }
    if (request.method === 'GET' && url.pathname === '/api/common-relay/pairings') { const code = (url.searchParams.get('code') || '').toUpperCase(), claimToken = commonRelay.pendingPairs?.[code]; if (!claimToken) throw new Error('このPCで開始したペアリングコードではありません'); const pairing = await commonRequest(`/api/pairings/claim?code=${encodeURIComponent(code)}&claimToken=${encodeURIComponent(claimToken)}`); if (pairing.paired) { commonRelay.deviceToken = pairing.deviceToken; delete commonRelay.pendingPairs[code]; await saveCommonRelay(); } return json(response, 200, { paired: pairing.paired, channelId: pairing.channelId }, request); }
    if (request.method === 'GET' && url.pathname === '/api/inbox') { await syncCommonRelayInbox(); return json(response, 200, { receipts: await listInbox() }, request); }
    if (request.method === 'POST' && url.pathname === '/api/inbox') return json(response, 201, await saveLocalImage(request, inbox), request);
    if (request.method === 'GET' && url.pathname.startsWith('/api/files/')) { const file = basename(decodeURIComponent(url.pathname.slice('/api/files/'.length))); const data = await readFile(join(inbox, file)); response.writeHead(200, { 'Content-Type': mimeFor(file), 'Access-Control-Allow-Origin': allowedOrigin(request) }); return response.end(data); }
    if (request.method === 'POST' && url.pathname === '/api/analyze') { const body = await parseBody(request); const result = await analyze(Array.isArray(body.ids) ? body.ids : []); let sentToDiscord = false, deliveryError; try { await sendResultToDiscord(result); sentToDiscord = Boolean(discordChannel) || Boolean(commonEnabled() && commonRelay.deviceToken); } catch (error) { deliveryError = error.message; } return json(response, 200, { jobId: result.jobId, records: result.records, csv: result.csv, mode: result.mode, sentToDiscord, deliveryError }, request); }
    return json(response, 404, { error: 'not found' }, request);
  } catch (error) { return json(response, 400, { error: error.message }, request); }
});
server.listen(config.port, '127.0.0.1', () => console.log(`OISO2 Bridge: http://127.0.0.1:${config.port}`));
await bootDiscord();
if (commonEnabled()) setInterval(() => syncCommonRelayInbox().catch(error => console.warn(`Common Relay同期失敗: ${error.message}`)), 15_000).unref();
