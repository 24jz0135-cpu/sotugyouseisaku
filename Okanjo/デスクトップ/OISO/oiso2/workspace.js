// Image blobs stay in IndexedDB; generated batch canvases are rebuilt on demand.
let workspaceReady=false,workspaceWrites=Promise.resolve();
function workspaceDb(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('oiso-desktop-workspace',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('state');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
async function workspaceTransaction(mode,value,key='images'){
 const db=await workspaceDb();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction('state',mode),store=transaction.objectStore('state');
  const request=mode==='readonly'?store.get(key):store.put(value,key);
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||Error('保存が中断されました'));
 });}finally{db.close();}
}

async function refreshWorkHistory(){
 const rows=await workspaceTransaction('readonly',null,'history')||[];
 $('work-history').replaceChildren(...rows.map(r=>new Option(`${new Date(r.created).toLocaleString('ja-JP')} / ${r.images.length}枚`,r.id)));
 $('work-restore').disabled=!rows.length;
}
async function nextReceipts(ask=true){
 if(!workspaceReady||analyzing)throw Error('準備または解析が終わってから切り替えてください');
 if(ask&&!confirm('現在の作業を保存して、次のレシートを始めますか？過去の結果と元画像は残ります。'))return false;
 await workspaceWrites;
 if(S.r.length||currentResultRows().length){
  const rows=await workspaceTransaction('readonly',null,'history')||[];
  rows.push({id:crypto.randomUUID(),created:new Date().toISOString(),images:S.r.map(r=>({file:r.file,name:r.name,id:r.id,relayId:r.relayId})),resultIds:currentResultRows().map(r=>r.receiptId)});
  await workspaceTransaction('readwrite',rows,'history');
 }
 await workspaceTransaction('readwrite',[]);
 S.r.forEach(r=>URL.revokeObjectURL(r.url));S.r=[];invalidateCurrentWork();render();await refreshWorkHistory();
 $('work-switch-status').textContent='次のレシートを選んでください。以前の作業は「以前の作業を開く」に保存しました。';return true;
}
function saveWorkspace(){
 if(!workspaceReady)return;
 const snapshot=S.r.map(item=>({file:item.file,name:item.name,id:item.id,relayId:item.relayId}));
 $('workspace-status').textContent='画像を保存中…';
 workspaceWrites=workspaceWrites.catch(()=>{}).then(()=>workspaceTransaction('readwrite',snapshot)).then(()=>{
  $('workspace-status').textContent='画像一覧はこのブラウザーに保存済みです。';
 }).catch(error=>{$('workspace-status').textContent=`画像を保存できません。元画像を保管してください: ${error.message}`;});
}
async function initWorkspace(){
 input.disabled=true;drop.style.pointerEvents='none';
 $('bridge-import').disabled=true;$('bridge-analyze').disabled=true;
 try{
  const rows=await workspaceTransaction('readonly');
  const restored=[];
  for(const row of rows||[]){const item=await load(row.file);Object.assign(item,{id:row.id,name:row.name,relayId:row.relayId});restored.push(item);}
  S.r=restored;render();workspaceReady=true;
  $('workspace-status').textContent=restored.length?`${restored.length}枚の画像を復元しました。`:'画像一覧はこのブラウザーに自動保存されます。';
 }catch(error){$('workspace-status').textContent=`画像の保存・復元を停止しています。元の保存内容は変更しません: ${error.message}`;}
 finally{await refreshWorkHistory().catch(()=>{});input.disabled=false;drop.style.pointerEvents='';await checkBridge();}
}

document.getElementById('next-receipts').onclick=async()=>{try{await nextReceipts();}catch(e){$('work-switch-status').textContent='切り替えられませんでした。'+e.message;}};
document.getElementById('work-restore').onclick=async()=>{try{
 const history=await workspaceTransaction('readonly',null,'history')||[];const entry=history.find(r=>r.id===$('work-history').value);if(!entry)return;
 if(!await nextReceipts(true))return;
 const images=[];for(const saved of entry.images){images.push(Object.assign(await load(saved.file),saved));}S.r=images;setCurrentResults(entry.resultIds);render();document.dispatchEvent(new Event('oiso-work-changed'));$('work-switch-status').textContent='保存した作業を開きました。';
}catch(e){$('work-switch-status').textContent='以前の作業を開けませんでした。'+e.message;}};
