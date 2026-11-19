import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import '../mobile-review-data.js';

export function lanAddresses() {
  return [...new Set(Object.values(networkInterfaces()).flat().filter(item =>
    item.family === 'IPv4' && !item.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)
  ).map(item => item.address))];
}

// A separate, read-only LAN server exposes only explicitly shared results.
// The PC administration API remains bound to loopback.
export function createResultShares({ port = 8789, host = '0.0.0.0', ttl = 30 * 60_000, now = Date.now } = {}) {
  const shares = new Map();
  let server, starting;
  const assets = {
    '': ['../phone-review/index.html', 'text/html; charset=utf-8'],
    'receive.js': ['../phone-review/receive.js', 'text/javascript; charset=utf-8'],
    'review-data.js': ['../mobile-review-data.js', 'text/javascript; charset=utf-8'],
    'review.js': ['../../../../スマートフォン/OISO/instant-ledger/frontend-app/review.js', 'text/javascript; charset=utf-8'],
    'style.css': ['../phone-review/style.css', 'text/css; charset=utf-8'],
  };
  function prune() { for (const [token, value] of shares) if (value.expiresAt <= now()) shares.delete(token); }
  async function start() {
    if (starting) return starting;
    starting = (async () => {
      server = createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        try {
          prune();
          const url = new URL(req.url, 'http://localhost');
          const match = url.pathname.match(/^\/s\/([A-Za-z0-9_-]{32})\/(.*)$/);
          const share = match && shares.get(match[1]);
          if (!share) { res.writeHead(404); res.end('共有が終了したか、URLが無効です。PCでQRを作り直してください。'); return; }
          if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
          if (match[2] === 'data') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ format: 'oiso-result', csv: share.csv, expiresAt: share.expiresAt })); return;
          }
          const asset = assets[match[2]];
          if (!asset) { res.writeHead(404); res.end(); return; }
          const bytes = await readFile(new URL(asset[0], import.meta.url));
          res.setHeader('Content-Type', asset[1]); res.end(bytes);
        } catch { if (!res.headersSent) res.writeHead(500); res.end('結果を読み込めませんでした。'); }
      });
      server.listen(port, host);
      try { await once(server, 'listening'); }
      catch (error) { server.close(); starting = undefined; throw error; }
    })();
    return starting;
  }
  return {
    async create(csv) {
      if (typeof csv !== 'string' || Buffer.byteLength(csv) > 2 * 1024 * 1024) throw Error('共有CSVは2MB以内にしてください');
      // Allow incomplete AI fields for correction, but reject broken structure/IDs.
      const records = globalThis.OisoReview.parseCsv(csv);
      await start(); prune();
      if (shares.size >= 10) throw Error('共有は同時に10件までです。不要な共有を終了してください');
      const token = randomBytes(24).toString('base64url'), expiresAt = now() + ttl;
      shares.set(token, { csv, expiresAt });
      return { token, expiresAt, count: records.length, port: server.address().port };
    },
    revoke(token) { return shares.delete(token); },
    async close() { shares.clear(); if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } },
  };
}
