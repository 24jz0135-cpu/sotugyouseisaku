import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

// Only completed downloads are visible in the inbox and eligible for acknowledgement.
export async function download(url, destination, expectedSize) {
  const temporary = `${destination}.${randomUUID()}.part`;
  let size = 0;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) throw new Error(`画像取得に失敗しました (${response.status})`);
    const limit = new Transform({ transform(chunk, encoding, callback) {
      size += chunk.length;
      callback(size > 20 * 1024 * 1024 ? new Error('画像は20MB以内にしてください') : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(temporary, { flags: 'wx' }));
    if (!size || (Number.isFinite(expectedSize) && size !== expectedSize)) throw new Error('画像の受信が完了していません');
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
