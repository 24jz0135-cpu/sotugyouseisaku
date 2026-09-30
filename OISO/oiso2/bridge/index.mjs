import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

try {
  const envFile = await readFile(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env is optional; process environment variables also work. */ }

const config = { token: process.env.DISCORD_BOT_TOKEN, channelId: process.env.DISCORD_CHANNEL_ID, port: Number(process.env.PORT || 8788), analyzer: process.env.ANALYZER_MODE || 'mock', codex: process.env.CODEX_COMMAND || 'codex' };
const root = resolve(process.cwd(), 'bridge-data');
const inbox = join(root, 'inbox');
const results = join(root, 'results');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const mimeFor = filename => ({ '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[extname(filename).toLowerCase()] || 'image/jpeg');
await Promise.all([mkdir(inbox, { recursive: true }), mkdir(results, { recursive: true })]);

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
  const response = await fetch(attachment.url);
  if (!response.ok || !response.body) throw new Error(`${sourceName} をダウンロードできませんでした`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  return { id, fileName: sourceName };
}
async function receiptFiles(ids) { const rows = await listInbox(); const byId = new Map(rows.map(row => [row.id, row])); return ids.map(id => byId.get(id)).filter(Boolean).map(row => ({ ...row, path: join(inbox, `${row.id}__${row.fileName}`) })); }
function run(command, args) { return new Promise((resolveRun, reject) => { const child = spawn(command, args, { cwd: root, shell: false, windowsHide: true }); let stderr = ''; child.stderr.on('data', data => { stderr += data; }); child.on('error', reject); child.on('close', code => code === 0 ? resolveRun() : reject(new Error(stderr || `${command} exited with ${code}`))); }); }
async function analyze(ids) {
  const files = await receiptFiles(ids); if (!files.length) throw new Error('解析する受信画像を選択してください');
  const jobId = `job-${Date.now()}`; let records;
  if (config.analyzer === 'codex') {
    const outputPath = join(results, `${jobId}.json`); const imagePaths = files.map(file => file.path).join(',');
    const prompt = `画像内の各レシートを解析してください。画像の対応IDは順に ${files.map(file => file.id).join(', ')} です。日付、店名、合計金額、勘定科目候補を抽出し、読めない値は null にしてください。JSONだけを返してください。`;
    await run(config.codex, ['exec', '--sandbox', 'read-only', '--image', imagePaths, '--output-schema', resolve(process.cwd(), 'schema.json'), '--output-last-message', outputPath, prompt]);
    records = JSON.parse(await readFile(outputPath, 'utf8')).records;
  } else records = files.map(file => ({ receiptId: file.id, date: null, vendor: null, amount: null, category: null, confidence: null }));
  const csv = toCsv(records); const csvPath = join(results, `${jobId}.csv`); await writeFile(csvPath, `\uFEFF${csv}`, 'utf8');
  return { jobId, records, csv, csvPath, mode: config.analyzer };
}
let discordChannel = null;
async function sendResultToDiscord(result) { if (discordChannel) await discordChannel.send({ content: `OISO2解析結果 ${result.jobId}（${result.records.length}件）`, files: [result.csvPath] }); }
async function bootDiscord() {
  if (!config.token || !config.channelId) { console.log('Discord未設定: ローカルAPIのみを起動します。'); return; }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel] });
  client.once('ready', async () => { discordChannel = await client.channels.fetch(config.channelId); console.log(`Discord Relay接続済み: ${client.user.tag}`); });
  client.on('messageCreate', async message => { if (message.author.bot || message.channelId !== config.channelId || !message.attachments.size) return; try { const saved = (await Promise.all([...message.attachments.values()].map(saveAttachment))).filter(Boolean); if (saved.length) await message.reply(`OISO2が${saved.length}枚をPCの受信箱へ保存しました。OISO2で確認・解析できます。`); } catch (error) { await message.reply(`受信に失敗しました: ${error.message}`); } });
  await client.login(config.token);
}
function json(response, status, body) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'http://127.0.0.1:4174' }); response.end(JSON.stringify(body)); }
function parseBody(request) { return new Promise((resolveBody, reject) => { let text = ''; request.on('data', chunk => { text += chunk; if (text.length > 100000) request.destroy(); }); request.on('end', () => { try { resolveBody(text ? JSON.parse(text) : {}); } catch { reject(new Error('JSON形式が不正です')); } }); request.on('error', reject); }); }
const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4174', 'Access-Control-Allow-Methods': 'GET,POST' }); return response.end(); }
  try { const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, discord: Boolean(discordChannel), analyzer: config.analyzer });
    if (request.method === 'GET' && url.pathname === '/api/inbox') return json(response, 200, { receipts: await listInbox() });
    if (request.method === 'GET' && url.pathname.startsWith('/api/files/')) { const file = basename(decodeURIComponent(url.pathname.slice('/api/files/'.length))); const data = await readFile(join(inbox, file)); response.writeHead(200, { 'Content-Type': mimeFor(file), 'Access-Control-Allow-Origin': 'http://127.0.0.1:4174' }); return response.end(data); }
    if (request.method === 'POST' && url.pathname === '/api/analyze') { const body = await parseBody(request); const result = await analyze(Array.isArray(body.ids) ? body.ids : []); await sendResultToDiscord(result); return json(response, 200, { jobId: result.jobId, records: result.records, csv: result.csv, mode: result.mode, sentToDiscord: Boolean(discordChannel) }); }
    return json(response, 404, { error: 'not found' });
  } catch (error) { return json(response, 400, { error: error.message }); }
});
server.listen(config.port, '127.0.0.1', () => console.log(`OISO2 Bridge: http://127.0.0.1:${config.port}`));
await bootDiscord();
