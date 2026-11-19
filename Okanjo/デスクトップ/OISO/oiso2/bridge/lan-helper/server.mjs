import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,timingSafeEqual,X509Certificate} from 'node:crypto';
import selfsigned from 'selfsigned';
import QRCode from 'qrcode';

const here=path.dirname(fileURLToPath(import.meta.url));
const idPattern=/^[a-f0-9]{32}$/;
const token=()=>randomBytes(32).toString('hex');
const digest=x=>createHash('sha256').update(x).digest('hex');
function equals(a,b) { const aa=Buffer.from(String(a)),bb=Buffer.from(String(b)); return aa.length===bb.length && timingSafeEqual(aa,bb); }
async function readJson(req,limit=30*1024*1024) {
  const chunks=[]; let size=0;
  for await(const chunk of req) { size+=chunk.length; if(size>limit) throw new Error('送信サイズが大きすぎます'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function validateResults(results,ids) {
  if(!Array.isArray(results) || results.length!==ids.length) throw new Error('結果はレシートごとに1件必要です');
  const seen=new Set();
  for(const r of results) {
    if(!r || !ids.includes(r.receiptId) || seen.has(r.receiptId)) throw new Error('レシートIDが不一致・重複しています');
    seen.add(r.receiptId);
    if(r.error) { if(typeof r.error!=='string') throw new Error('errorは文字列です'); continue; }
    if(r.date!==null && (typeof r.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10)!==r.date)) throw new Error('日付の形式が不正です');
    if(r.amount!==null && (!Number.isSafeInteger(r.amount) || r.amount<=0 || r.amount>999999999999)) throw new Error('金額は正の整数かnullです');
    for(const k of ['vendor','category']) if(r[k]!==null && typeof r[k]!=='string') throw new Error(`${k}は文字列かnullです`);
  }
  return results;
}
export async function start({directory=path.join(here,'data'),port=8790,adminPort=8791,discoveryPort=8792,quiet=false}={}) {
  await fs.mkdir(directory,{recursive:true});
  for(const name of ['images','backups']) await fs.mkdir(path.join(directory,name),{recursive:true});
  let cert;
  try {cert=JSON.parse(await fs.readFile(path.join(directory,'tls.json'),'utf8'));} catch(e) {
    if(e.code!=='ENOENT') throw e;
    cert=await selfsigned.generate([{name:'commonName',value:'Oaiso LAN'}],{days:3650,keySize:2048,algorithm:'sha256'});
    await fs.writeFile(path.join(directory,'tls.json'),JSON.stringify({private:cert.private,cert:cert.cert}),{mode:0o600});
  }
  let state;
  try {state=JSON.parse(await fs.readFile(path.join(directory,'state.json'),'utf8'));} catch(e) {
    if(e.code!=='ENOENT') throw e;
    state={id:randomBytes(16).toString('hex'),devices:[],receipts:[],jobs:[],backups:[]};
  }
  const fingerprint=digest(new X509Certificate(cert.cert).raw);
  let saveQueue=Promise.resolve();
  const save=()=> { const snapshot=JSON.stringify(state); saveQueue=saveQueue.then(async()=>{ await fs.writeFile(path.join(directory,'state.tmp'),snapshot,{mode:0o600}); await fs.rename(path.join(directory,'state.tmp'),path.join(directory,'state.json')); }); return saveQueue; };
  await save();
  let pairing=null;
  const ipAddresses=()=>Object.values(os.networkInterfaces()).flat().filter(a=>a && a.family==='IPv4'&&!a.internal).map(a=>a.address);
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const wrap=fn=>async(req,res)=>{try { await fn(req,res); }catch(e){ if(!res.headersSent) send(res,400,{error:e.message}); else res.destroy(); }};
  const publicServer=https.createServer({key:cert.private,cert:cert.cert},wrap(async(req,res)=>{
    const url=new URL(req.url,'https://localhost');
    if(req.method==='POST'&&url.pathname==='/pair') {
      const b=await readJson(req,4096);
      if(!pairing || Date.now()>pairing.expires || !equals(b.secret,pairing.secret)) return send(res,403,{error:'QRコードの有効期限が切れたか、認証できません'});
      pairing=null;
      const auth=token(),device={id:randomBytes(16).toString('hex'),name:String(b.name||'Android').slice(0,80),hash:digest(auth)};
      state.devices.push(device);await save();return send(res,200,{token:auth,deviceId:device.id,serverId:state.id});
    }
    const auth=(req.headers.authorization||'').replace(/^Bearer /,'');
    const device=state.devices.find(d=>equals(d.hash,digest(auth)));
    if(!device) return send(res,401,{error:'ペアリングが必要です'});
    if(req.method==='GET'&&url.pathname==='/health') return send(res,200,{serverId:state.id});
    if(req.method==='POST'&&url.pathname==='/receipts') {
      const b=await readJson(req);
      if(!idPattern.test(b.id)||typeof b.image!=='string') throw new Error('画像IDが不正です');
      const bytes=Buffer.from(b.image,'base64');
      const imageType=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))?'jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
      if(!imageType||!bytes.length||bytes.length>20*1024*1024) throw new Error('JPEG/PNG/WebP、20MB以内の画像を送信してください');
      const existing=state.receipts.find(r=>r.id===b.id);
      if(existing) {if(existing.deviceId!==device.id||existing.hash!==digest(bytes)) throw new Error('既存画像と一致しません');return send(res,200,{id:b.id});}
      const imagePath=path.join(directory,'images',b.id);
      try {await fs.writeFile(imagePath,bytes,{flag:'wx'});} catch(e) {
        // Recover an interrupted upload whose file was committed before state.json.
        if(e.code!=='EEXIST'||digest(await fs.readFile(imagePath))!==digest(bytes)) throw e;
      }
      state.receipts.push({id:b.id,deviceId:device.id,hash:digest(bytes),type:imageType,created:new Date().toISOString()});await save();return send(res,201,{id:b.id});
    }
    if(req.method==='POST'&&url.pathname==='/jobs') {
      const b=await readJson(req,65536);
      if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>100||new Set(b.ids).size!==b.ids.length||b.ids.some(id=>!state.receipts.some(r=>r.id===id&&r.deviceId===device.id))) throw new Error('レシートの指定が不正です（最大100枚）');
      const active=state.jobs.filter(j=>j.deviceId===device.id&&j.status==='pending');
      const pendingIds=b.ids.filter(id=>!active.some(j=>j.ids.includes(id)));
      if(!pendingIds.length)return send(res,200,{id:active.find(j=>j.ids.includes(b.ids[0])).id});
      const job={id:randomBytes(16).toString('hex'),deviceId:device.id,ids:pendingIds,status:'pending',created:new Date().toISOString(),results:[]};state.jobs.push(job);await save();return send(res,201,{id:job.id});
    }
    if(req.method==='GET'&&url.pathname==='/results') return send(res,200,{jobs:state.jobs.filter(j=>j.deviceId===device.id&&j.status==='done').map(j=>({id:j.id,results:j.results}))});
    if(req.method==='POST'&&url.pathname==='/backups') {
      const b=await readJson(req,200*1024*1024);
      if(b.format!=='oaiso-lan'||b.version!==1||!Array.isArray(b.entries)||!Array.isArray(b.receipts)) throw new Error('バックアップ形式が不正です');
      const id=randomBytes(16).toString('hex');
      await fs.writeFile(path.join(directory,'backups',id),JSON.stringify(b),{flag:'wx'});
      state.backups.push({id,deviceId:device.id,created:new Date().toISOString()});await save();return send(res,201,{id});
    }
    if(req.method==='GET'&&url.pathname==='/backups') return send(res,200,{backups:state.backups.filter(b=>b.deviceId===device.id)});
    if(req.method==='GET'&&/^\/backups\/[a-f0-9]{32}$/.test(url.pathname)) {
      const id=url.pathname.split('/').pop();if(!state.backups.some(b=>b.id===id&&b.deviceId===device.id)) return send(res,404,{error:'見つかりません'});
      return send(res,200,JSON.parse(await fs.readFile(path.join(directory,'backups',id),'utf8')));
    }
    send(res,404,{error:'見つかりません'});
  }));
  const adminServer=http.createServer(wrap(async(req,res)=>{
    const allowedHosts=[`127.0.0.1:${adminServer.address().port}`,`localhost:${adminServer.address().port}`];
    if(!allowedHosts.includes(req.headers.host)) return send(res,403,{error:'localhostを使用してください'});
    if(req.method!=='GET' && (req.headers['x-oaiso-admin']!=='1'||(req.headers.origin&&!allowedHosts.map(h=>'http://'+h).includes(req.headers.origin)))) return send(res,403,{error:'別サイトからの操作は許可されていません'});
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/state') return send(res,200,{devices:state.devices.map(({hash,...d})=>d),jobs:state.jobs,backups:state.backups,addresses:ipAddresses(),port:publicServer.address().port,localModel:process.env.OISO_OLLAMA_MODEL||null});
    if(req.method==='POST'&&url.pathname==='/api/pair') {
      const b=await readJson(req,4096);const host=b.host||ipAddresses()[0];if(!ipAddresses().includes(host)) throw new Error('このPCのLANアドレスを選んでください');
      pairing={secret:token(),expires:Date.now()+5*60000};
      const value={format:'oiso2-lan-pair',version:1,serverId:state.id,fingerprint,host,port:publicServer.address().port,secret:pairing.secret,expires:pairing.expires};
      return send(res,200,{qr:await QRCode.toDataURL(JSON.stringify(value)),expires:pairing.expires});
    }
    if(req.method==='POST'&&url.pathname==='/api/revoke') {const b=await readJson(req,4096);state.devices=state.devices.filter(d=>d.id!==b.id);await save();return send(res,200,{ok:true});}
    if(req.method==='GET'&&/^\/api\/images\/[a-f0-9]{32}$/.test(url.pathname)) {
      const id=url.pathname.split('/').pop();const r=state.receipts.find(r=>r.id===id);if(!r)return send(res,404,{});res.writeHead(200,{'Content-Type':`image/${r.type}`,'Cache-Control':'no-store'});return res.end(await fs.readFile(path.join(directory,'images',id)));
    }
    if(req.method==='POST'&&url.pathname==='/api/results') {
      const b=await readJson(req,2*1024*1024),job=state.jobs.find(j=>j.id===b.jobId);
      if(!job)throw new Error('ジョブが見つかりません');
      if(job.status==='done')throw new Error('このジョブは取込済みです。スマホで再解析を指定してください');
      job.results=validateResults(b.results,job.ids);job.status='done';await save();return send(res,200,{ok:true});
    }
    if(req.method==='POST'&&url.pathname==='/api/local') {
      if(!process.env.OISO_OLLAMA_MODEL)throw new Error('PCに用意したOllamaモデル名をOISO_OLLAMA_MODELで指定してください');
      const b=await readJson(req,4096),job=state.jobs.find(j=>j.id===b.jobId&&j.status==='pending');if(!job)throw new Error('未処理ジョブがありません');
      const results=[];
      for(const id of job.ids) {
        try {
          const response=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(180000),body:JSON.stringify({model:process.env.OISO_OLLAMA_MODEL,stream:false,format:'json',prompt:`Read this Japanese receipt. Return JSON only with receiptId="${id}", date (YYYY-MM-DD), vendor, amount (positive integer JPY), category. Use null for unknown.`,images:[(await fs.readFile(path.join(directory,'images',id))).toString('base64')]})});
          if(!response.ok)throw new Error(`ローカルAI HTTP ${response.status}`);
          const r=JSON.parse((await response.json()).response);r.receiptId=id;validateResults([r],[id]);results.push(r);
        }catch(e){results.push({receiptId:id,error:e.message});}
      }
      job.results=results;job.status='done';await save();return send(res,200,{ok:true});
    }
    const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
    if(req.method==='GET'&&files[url.pathname]) {res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store'});return res.end(await fs.readFile(path.join(here,'public',files[url.pathname])));}
    send(res,404,{});
  }));
  const discovery=dgram.createSocket('udp4');
  discovery.on('message',(data,remote)=>{if(data.toString()==='OAISO_DISCOVER_V1')discovery.send(JSON.stringify({format:'oaiso-lan',serverId:state.id,port:publicServer.address().port}),remote.port,remote.address);});
  discovery.on('error',e=>{if(!quiet)console.error('LAN自動検出:',e.message);});
  await new Promise((resolve,reject)=>{publicServer.once('error',reject);publicServer.listen(port,'0.0.0.0',resolve);});
  await new Promise((resolve,reject)=>{adminServer.once('error',reject);adminServer.listen(adminPort,'127.0.0.1',resolve);});
  await new Promise((resolve,reject)=>{discovery.once('error',reject);discovery.bind(discoveryPort,'0.0.0.0',resolve);});
  if(!quiet)console.log(`Oaiso PC補助画面: http://127.0.0.1:${adminServer.address().port}\nスマホ接続: HTTPS ${publicServer.address().port} / 検出 UDP ${discovery.address().port}`);
  return {publicServer,adminServer,discovery,state,fingerprint,createPairing:()=>{pairing={secret:token(),expires:Date.now()+300000};return pairing;},close:async()=>{discovery.close();publicServer.closeAllConnections();adminServer.closeAllConnections();await Promise.all([new Promise(r=>publicServer.close(r)),new Promise(r=>adminServer.close(r))]);}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) start().catch(e=>{console.error(e);process.exitCode=1;});
