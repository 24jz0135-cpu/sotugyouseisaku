// Image blobs stay in IndexedDB; generated batch canvases are rebuilt on demand.
let workspaceReady=false,workspaceWrites=Promise.resolve();
function workspaceDb(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('oiso-desktop-workspace',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('state');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
async function workspaceTransaction(mode,value){
 const db=await workspaceDb();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction('state',mode),store=transaction.objectStore('state');
  const request=mode==='readonly'?store.get('images'):store.put(value,'images');
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||Error('保存が中断されました'));
 });}finally{db.close();}
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
 finally{input.disabled=false;drop.style.pointerEvents='';await checkBridge();}
}
