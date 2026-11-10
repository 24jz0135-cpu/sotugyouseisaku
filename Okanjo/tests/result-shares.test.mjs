import test from 'node:test';
import assert from 'node:assert/strict';
import { createResultShares } from '../デスクトップ/OISO/oiso2/bridge/result-shares.mjs';
const csv = 'receiptId,date,vendor,amount,category,confidence\nR-1,2026-11-10,店舗,1250,消耗品費,0.8\nR-2,,,,,';

test('phone receives only explicitly shared results; assets, revocation and expiry work', async t => {
  let time = 100;
  const shares = createResultShares({port:0, host:'127.0.0.1', ttl:100, now:()=>time});
  t.after(()=>shares.close());
  const first = await shares.create(csv);
  const base = `http://127.0.0.1:${first.port}`, url = `${base}/s/${first.token}/`;
  assert.equal(first.count,2);
  assert.equal((await (await fetch(url+'data')).json()).csv,csv);
  const page=await fetch(url);
  assert.match(await page.text(),/解析結果を確認する/);
  assert.equal(page.headers.get('cache-control'),'no-store');
  for(const asset of ['review.js','review-data.js','receive.js','style.css']) assert.equal((await fetch(url+asset)).status,200,asset);
  for(const path of ['/','/api/inbox','/api/analyze',`/s/${'x'.repeat(32)}/data`]) assert.equal((await fetch(base+path)).status,404,path);
  assert.equal((await fetch(url+'data',{method:'POST',body:'{}'})).status,405);
  assert.equal(shares.revoke(first.token),true);
  assert.equal((await fetch(url+'data')).status,404);
  const second=await shares.create(csv);
  time=201;
  assert.equal((await fetch(`${base}/s/${second.token}/data`)).status,404);
});

test('malformed, duplicate and oversized shares are rejected without publishing', async t=>{
  const shares=createResultShares({port:0,host:'127.0.0.1'});t.after(()=>shares.close());
  for(const value of ['', {}, 'x'.repeat(2*1024*1024+1), csv+'\nR-1,,,,,']) await assert.rejects(shares.create(value));
});
