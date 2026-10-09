import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const base=new URL('../スマートフォン/OISO/instant-ledger/frontend-app/',import.meta.url);
const data=await readFile(new URL('review-data.js',base),'utf8'),ui=await readFile(new URL('review.js',base),'utf8');
const context=vm.createContext({});vm.runInContext(data,context);const review=context.OisoReview;
const header='receiptId,date,vendor,amount,category,confidence';
const sample=header+'\r\nR-1,2026-10-09,"店, 本店",1250,消耗品費,0.9\r\nR-2,,薬局,,雑費,';
test('analysis CSV handles BOM, CRLF, quotes and multiline fields, preserving missing values',()=>{
 const rows=review.parseCsv('\uFEFF'+header+'\r\nR-1,2026-10-09,"店, ""本店""\n支店",1250,消耗品費,0.9\r\n');
 assert.equal(rows[0].vendor,'店, "本店"\n支店');assert.equal(rows[0].confirmed,false);
 assert.equal(review.parseCsv(sample)[1].amount,'');assert.equal(review.issues(review.parseCsv(sample)[1]).length,2);
 for(const text of [header+'\nR-1,2026-10-09,"unclosed',header+'\nR-1,a,b,c,d,e\nR-1,a,b,c,d,e','a,b\n1,2',header+'\nR-1,a,b,c,d,e,extra'])assert.throws(()=>review.parseCsv(text));
});
test('reimport does not replace edited or confirmed records and CSV exports safe text',()=>{
 const old=review.parseCsv(sample);old[0].amount='1500';old[0].confirmed=true;
 const merged=review.merge(old,review.parseCsv(sample));assert.equal(merged.skipped,2);assert.equal(merged.records[0].amount,'1500');assert.equal(merged.records[0].confirmed,true);
 old[0].vendor='=SUM(1,2)';old[0].amount='-100';const csv=review.csv([old[0]]);
 assert.match(csv,/"'=SUM\(1,2\)"/);assert.equal(review.parseCsv(csv)[0].amount,'-100');
 assert.equal(review.issues({...old[0],date:'2026-02-30',amount:'NaN'}).length,2);
});
function app(storage=new Map(),fail=false){
 const nodes=new Map();let downloaded;
 const element=()=>({children:[],value:'',append(child){this.children.push(child);},replaceChildren(){this.children=[];},setAttribute(){},click(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};get('review-filter').value='all';
 const context=vm.createContext({document:{getElementById:get,createElement:element,addEventListener:(name,fn)=>fn()},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(fail)throw Error('quota');storage.set(key,value);}},Blob,URL:{createObjectURL:blob=>{downloaded=blob;return 'blob:test';},revokeObjectURL(){}},setTimeout:fn=>fn()});
 vm.runInContext(data,context);vm.runInContext(ui,context);
 return {get,storage,download:()=>downloaded,import:async text=>get('review-import').onchange({target:{files:[{size:text.length,text:async()=>text}],value:'',disabled:false}})};
}
test('phone review persists edits and confirmations, restores after reload and exports only checked rows',async()=>{
 const phone=app();await phone.import(sample);assert.match(phone.get('review-summary').textContent,/未確認2件/);
 let card=phone.get('review-list').children[0];const amount=card.children[2].children[2].children[0];amount.value='1500';amount.oninput();card.children[4].onclick();
 assert.match(phone.get('review-summary').textContent,/確認済み1件/);
 const reloaded=app(phone.storage);assert.match(reloaded.get('review-summary').textContent,/確認済み1件/);
 reloaded.get('review-export').onclick();let csv=await reloaded.download().text();assert.match(csv,/1500/);assert.doesNotMatch(csv,/R-2/);
 await reloaded.import(sample);assert.match(reloaded.get('review-status').textContent,/同じIDの2件/);
 card=reloaded.get('review-list').children[0];const vendor=card.children[2].children[0].children[0];vendor.value='修正店舗';vendor.oninput();assert.equal(reloaded.get('review-export').disabled,true);
 assert.match(app(phone.storage).get('review-summary').textContent,/未確認2件/);
});
test('malformed CSV and storage failure leave earlier review intact',async()=>{
 const phone=app();await phone.import(sample);const before=[...phone.storage.values()][0];
 await phone.import('not a CSV');assert.equal([...phone.storage.values()][0],before);
 const full=app(phone.storage,true);let card=full.get('review-list').children[0];let amount=card.children[2].children[2].children[0];amount.value='999';amount.oninput();assert.match(full.get('review-status').textContent,/保存できません/);assert.equal([...phone.storage.values()][0],before);
 const broken=app(new Map([['oiso-mobile-csv-review-v1','{']]));assert.equal(broken.get('review-import').disabled,true);
});
