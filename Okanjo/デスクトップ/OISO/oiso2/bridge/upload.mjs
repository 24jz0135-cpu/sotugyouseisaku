import { writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const maxBytes = 20 * 1024 * 1024;
function imageExtension(data) {
  if (data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return '.png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return '.jpg';
  if (/^GIF8[79]a$/.test(data.subarray(0, 6).toString('ascii'))) return '.gif';
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return '.webp';
  throw new Error('JPEG / PNG / WebP / GIF の画像を選んでください');
}

export async function saveLocalImage(request, inbox) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('画像は20MB以内にしてください');
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  const extension = imageExtension(data);
  const id = `L-${randomUUID().toUpperCase()}`, fileName = `receipt${extension}`;
  const destination = join(inbox, `${id}__${fileName}`), temporary = `${destination}.part`;
  try {
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
  return { id, fileName, size, url: `/api/files/${id}__${fileName}` };
}
