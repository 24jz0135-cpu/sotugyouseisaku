import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('reviewed CSV contains edited fields, quotes commas and neutralizes spreadsheet formulas', async () => {
  const source = await readFile(new URL('../デスクトップ/OISO/oiso2/app.js', import.meta.url), 'utf8');
  const nodes = new Map(); let downloaded;
  const element = () => ({ children: [], append(child) { this.children.push(child); }, setAttribute() {}, style: {}, click() {} });
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const context = vm.createContext({ renderTax() {}, document: { getElementById: get, createElement: element }, location: { port: '8788', origin: 'http://127.0.0.1:8788' }, Blob,
    URL: { createObjectURL: blob => { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {} }, setTimeout: callback => callback() });
  vm.runInContext(source.slice(0, source.indexOf('input.onchange=')), context);
  vm.runInContext('renderResults([{receiptId:"R-1",vendor:"=1+1",date:"2026-10-07",amount:1250,category:"food,drink",confidence:0.9}])', context);
  const out = get('results');
  const amount = out.children[0].children[3].children[0];
  amount.value = '1500'; amount.oninput();
  out.children[1].onclick();
  const csv = await downloaded.text();
  assert.match(csv, /"1500"/);
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"food,drink"/);
  assert.match(csv, /receiptId,date,vendor,amount,category,confidence/);
});

test('local analysis resumes after partial upload and prevents concurrent submissions', async () => {
  const source = await readFile(new URL('../デスクトップ/OISO/oiso2/app.js', import.meta.url), 'utf8');
  const nodes = new Map(), calls = [], alerts = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); };
  const context = vm.createContext({ document: { getElementById: get }, location: { port: '8788', origin: 'http://127.0.0.1:8788' }, alert: text => alerts.push(text) });
  vm.runInContext(source.slice(0, source.indexOf('input.onchange=')), context);
  let fail = true;
  context.request = async (path, options) => {
    calls.push({path, options});
    if(path === '/api/inbox') {
      if(options.body.name === 'second.png' && fail) { fail = false; throw Error('offline'); }
      return {id: options.body.name === 'first.png' ? 'L-1' : 'L-2'};
    }
    return {records: [], mode: 'mock'};
  };
  vm.runInContext(`bridgeRequest=request;render=()=>{};renderResults=()=>{};bridge.online=true;
    S.r=[{name:'first.png',file:{name:'first.png',size:100}},{name:'second.png',file:{name:'second.png',size:100}},{relayId:'R-EXISTING'}]`, context);
  await vm.runInContext('Promise.all([analyzeWithBridge(),analyzeWithBridge()])', context);
  assert.equal(calls.length, 2);
  assert.match(alerts[0], /offline/);
  await vm.runInContext('analyzeWithBridge()', context);
  assert.equal(calls.filter(call => call.path === '/api/inbox' && call.options.body.name === 'first.png').length, 1);
  assert.deepEqual(JSON.parse(calls.at(-1).options.body).ids, ['L-1', 'L-2', 'R-EXISTING']);
  assert.match(alerts.at(-1), /空欄/);
});
