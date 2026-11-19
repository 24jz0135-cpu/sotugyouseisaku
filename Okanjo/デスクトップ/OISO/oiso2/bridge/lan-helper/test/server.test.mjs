import {test} from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import dgram from 'node:dgram';
import {start,validateResults} from '../server.mjs';

test('strict per-receipt result validation',()=>{
  const r={receiptId:'a',date:'2026-11-18',vendor:'お店',amount:100,category:'雑費'};
  assert.deepEqual(validateResults([r],['a']),[r]);
  assert.throws(()=>validateResults([r,r],['a','b']));
  assert.throws(()=>validateResults([{...r,date:'2026-02-30'}],['a']));
  assert.throws(()=>validateResults([{...r,amount:1.5}],['a']));
});
test('pairing, upload dedupe, result roundtrip, backup isolation, revoke and restart',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'oaiso-server-'));let app;
  try{
    app=await start({directory:dir,port:0,adminPort:0,discoveryPort:0,quiet:true});
    const request=(method,route,body,token)=>new Promise((resolve,reject)=>{
      const req=https.request({host:'127.0.0.1',port:app.publicServer.address().port,path:route,method,rejectUnauthorized:false,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
    });
    assert.equal((await request('GET','/health')).status,401);
    const secret=app.createPairing().secret;
    const pair=await request('POST','/pair',{secret});assert.equal(pair.status,200);const token=pair.body.token;
    assert.equal((await request('POST','/pair',{secret})).status,403);
    const second=await request('POST','/pair',{secret:app.createPairing().secret});
    const id='a'.repeat(32),image=Buffer.from([255,216,255,224,1,2,3]).toString('base64');
    assert.equal((await request('POST','/receipts',{id,image},token)).status,201);
    assert.equal((await request('POST','/receipts',{id,image},token)).status,200);
    assert.equal((await request('POST','/receipts',{id,image},second.body.token)).status,400);
    const job=await request('POST','/jobs',{ids:[id]},token);
    assert.equal((await request('POST','/jobs',{ids:[id]},token)).body.id,job.body.id);
    const extraId='c'.repeat(32);
    // Simulate a crash after image write but before metadata commit.
    await fs.writeFile(path.join(dir,'images',extraId),Buffer.from(image,'base64'));
    assert.equal((await request('POST','/receipts',{id:extraId,image},token)).status,201);
    const extraJob=await request('POST','/jobs',{ids:[id,extraId]},token);
    assert.deepEqual(app.state.jobs.find(j=>j.id===extraJob.body.id).ids,[extraId]);
    const admin=`http://127.0.0.1:${app.adminServer.address().port}`;
    const result={receiptId:id,date:'2026-11-18',vendor:'お店',amount:1000,category:'雑費'};
    assert.equal((await fetch(admin+'/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(admin+'/api/results',{method:'POST',headers:{'Content-Type':'application/json','X-Oaiso-Admin':'1'},body:JSON.stringify({jobId:job.body.id,results:[result]})})).status,200);
    assert.deepEqual((await request('GET','/results',null,token)).body.jobs[0].results,[result]);
    assert.equal((await request('GET','/results',null,second.body.token)).body.jobs.length,0);
    const backup=await request('POST','/backups',{format:'oaiso-lan',version:1,entries:[],receipts:[]},token);
    assert.equal((await request('GET','/backups/'+backup.body.id,null,token)).status,200);
    assert.equal((await request('GET','/backups/'+backup.body.id,null,second.body.token)).status,404);
    const socket=dgram.createSocket('udp4');
    const discovered=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.close();reject(new Error('Discovery timed out'));},3000);socket.on('message',m=>{clearTimeout(timer);socket.close();resolve(JSON.parse(m));});socket.send('OAISO_DISCOVER_V1',app.discovery.address().port,'127.0.0.1');});
    assert.equal(discovered.serverId,app.state.id);
    const fingerprint=app.fingerprint;await app.close();app=await start({directory:dir,port:0,adminPort:0,discoveryPort:0,quiet:true});assert.equal(app.fingerprint,fingerprint);assert.equal((await request('GET','/health',null,token)).status,200);
    await fetch(`http://127.0.0.1:${app.adminServer.address().port}/api/revoke`,{method:'POST',headers:{'Content-Type':'application/json','X-Oaiso-Admin':'1'},body:JSON.stringify({id:pair.body.deviceId})});
    assert.equal((await request('GET','/health',null,token)).status,401);
  }finally{if(app)await app.close();await fs.rm(dir,{recursive:true,force:true});}
});
