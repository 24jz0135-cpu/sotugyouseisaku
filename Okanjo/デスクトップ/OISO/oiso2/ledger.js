globalThis.OisoLedger=(()=>{
 const KEY='oiso-desktop-ledger-v1';
 function normalize(rows){
  if(!Array.isArray(rows)||rows.length>5000)throw Error('明細は5000件以内の配列で指定してください');
  const ids=new Set();
  return rows.map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw Error('明細の形式が不正です');
   const receiptId=row.receiptId||row.id;
   if(typeof receiptId!=='string'||!receiptId.trim()||ids.has(receiptId))throw Error('レシートIDが空欄または重複しています');
   ids.add(receiptId);
   for(const key of ['date','vendor','category','bookedDate','taxCategory','taxNote'])if(row[key]!=null&&typeof row[key]!=='string')throw Error(`${key}の形式が不正です`);
   const result={...row,receiptId};
   for(const key of ['amount','confidence','businessPercent']){
    const value=row[key];
    if(value==null||value==='')result[key]=null;
    else if((typeof value==='number'||typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value))&&Number.isFinite(Number(value)))result[key]=Number(value);
    else throw Error(`${key}は数値または空欄で指定してください`);
   }
   result.taxConfirmed=row.taxConfirmed===true;result.taxExcluded=row.taxExcluded===true;
   return result;
  });
 }
 function merge(current,incoming,replace=false){
  const next=normalize(current),added=normalize(incoming),byId=new Map(next.map((row,index)=>[row.receiptId,index]));
  let inserted=0,updated=0,skipped=0;
  for(const row of added){
   const index=byId.get(row.receiptId);
   if(index===undefined){byId.set(row.receiptId,next.length);next.push(row);inserted++;}
   else if(!replace)skipped++;
   else{
    const previous=next[index];
    next[index]={...previous,...row,businessPercent:previous.businessPercent,taxNote:previous.taxNote,taxExcluded:previous.taxExcluded,taxConfirmed:false};
    if(previous.date!==row.date)delete next[index].bookedDate;
    if(previous.category!==row.category)delete next[index].taxCategory;
    updated++;
   }
  }
  if(next.length>5000)throw Error('保存できる明細は5000件までです');
  return {records:next,inserted,updated,skipped};
 }
 function save(storage,state){storage.setItem(KEY,JSON.stringify({version:1,records:normalize(state.records||[]),year:state.year,form:state.form}));}
 function load(storage){const text=storage.getItem(KEY);if(!text)return null;const state=JSON.parse(text);if(state.version!==1)throw Error('保存データのバージョンが不正です');return {...state,records:normalize(state.records)};}
 return {normalize,merge,save,load};
})();
let ledgerReady=false,ledgerBlocked=false;
function saveLedger(){
 if(!ledgerReady||ledgerBlocked)return;
 try{OisoLedger.save(localStorage,{records:S.records||[],year:$('tax-year').value,form:$('tax-form').value});$('ledger-status').textContent=`${(S.records||[]).length}件の編集内容をこのブラウザーに保存済み`;}
 catch(error){$('ledger-status').textContent=`自動保存できません。画面の編集内容は残っています。「編集内容をJSONで保存」で退避してください: ${error.message}`;}
}
function importLedger(rows,replace=false){
 if(ledgerBlocked)throw Error('保存データを読み込めないため、上書きを停止しています');
 const result=OisoLedger.merge(S.records||[],rows,replace);
 renderResults(result.records);saveLedger();
 $('ledger-import-status').textContent=`追加${result.inserted}件・更新${result.updated}件・既存を保護${result.skipped}件。更新した明細は申告用の確認をやり直してください。`;
}
function initLedger(){
 try{
  const saved=OisoLedger.load(localStorage);
  if(saved){$('tax-year').value=saved.year;$('tax-form').value=saved.form;renderResults(saved.records);$('ledger-status').textContent=`保存済みの${saved.records.length}件を復元しました`;}
 }catch(error){ledgerBlocked=true;$('ledger-status').textContent=`保存データを読み込めません。元の保存内容を保護して自動保存を停止しています: ${error.message}`;}
 ledgerReady=true;
 $('ledger-csv').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>2*1024*1024)throw Error('CSVは2MB以内にしてください');importLedger(OisoReview.parseCsv(await file.text()),$('ledger-duplicates').value==='update');}
  catch(error){$('ledger-import-status').textContent=`取り込めませんでした: ${error.message}`;}
  finally{event.target.value='';}
 };
}
