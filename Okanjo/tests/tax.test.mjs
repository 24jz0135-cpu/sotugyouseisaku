import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(await readFile(new URL('../デスクトップ/OISO/oiso2/tax.js',import.meta.url),'utf8'),context);
const tax=context.OisoTax;
const row=(id,extra={})=>({receiptId:id,date:'2026-01-01',vendor:'店',amount:1001,taxCategory:'通信費',businessPercent:50,taxNote:'利用時間の半分',taxConfirmed:true,...extra});

test('business portion uses exact integer arithmetic, signed refunds and selected accounting year',()=>{
 const summary=tax.summarize([row('1'),row('2',{amount:-101}),row('3',{date:'2025-12-31'}),row('4',{businessPercent:0}),row('5',{taxExcluded:true}),row('6',{date:'2025-12-31',bookedDate:'2026-01-02',amount:200,businessPercent:100})],2026,'blue');
 assert.equal(summary.total,650);assert.equal(summary.included,3);assert.equal(summary.outside,1);assert.equal(summary.excluded,2);assert.equal(summary.pending,0);
 assert.equal(summary.groups[0].amount,650);
 assert.match(tax.summaryCsv(summary),/e-Tax取込不可/);
});
test('missing dates, duplicate IDs, invalid values and unconfirmed AI records cannot be exported',()=>{
 for(const extra of [{date:'2026-02-30'},{amount:null},{amount:1.5},{businessPercent:null},{businessPercent:101},{businessPercent:0.5},{taxNote:''},{taxCategory:'減価償却費'},{taxConfirmed:false},{vendor:''}]){
  const summary=tax.summarize([row('1',extra)],2026,'white');
  assert.equal(summary.pending,1);assert.equal(summary.total,0);assert.throws(()=>tax.summaryCsv(summary),/要確認/);
 }
 const duplicated=tax.summarize([row('same'),row('same')],2026,'blue');assert.equal(duplicated.pending,2);
 assert.throws(()=>tax.summarize([],NaN,'blue'),/対象年/);
 assert.throws(()=>tax.summaryCsv(tax.summarize([],2026,'blue')),/1件以上/);
});
test('CSV includes excluded and pending rows for review and quotes untrusted text',()=>{
 const summary=tax.summarize([row('1',{vendor:' =SUM(1,2)',taxCategory:'会議費',taxNote:'面積,"半分"\n確認済み'}),row('2',{taxConfirmed:false}),row('3',{taxExcluded:true})],2026,'white');
 const csv=tax.detailsCsv(summary);
 assert.match(csv,/"' =SUM\(1,2\)"/);assert.match(csv,/"面積,""半分""\n確認済み"/);assert.match(csv,/要確認/);assert.match(csv,/対象外/);
 assert.equal(summary.groups[0].destination,'空欄に「会議費」を設定');
});

test('tax screen updates totals, invalidates confirmation after edits, and backs up allocation fields',async()=>{
 const nodes=new Map();let downloaded;
 function element(tag){return {tag,children:[],value:'',append(child){this.children.push(child);if(child.id)nodes.set(child.id,child);},prepend(child){this.children.unshift(child);},replaceChildren(){this.children=[];},setAttribute(){}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,element('div'));return nodes.get(id);};
 const ui=vm.createContext({document:{createElement:element},OisoTax:tax,$:get,S:{records:[row('1')]},dl:data=>downloaded=data,alert:message=>{throw Error(message);}});
 vm.runInContext(await readFile(new URL('../デスクトップ/OISO/oiso2/tax-ui.js',import.meta.url),'utf8'),ui);
 get('tax-form').value='blue';vm.runInContext('initTax()',ui);get('tax-year').value='2026';get('tax-year').oninput();
 assert.equal(get('tax-export').disabled,false);
 const card=get('tax-records').children[0];const percent=card.children[1].children[2].children[0];
 percent.value='75';percent.oninput();assert.equal(get('tax-export').disabled,true);
 const confirm=card.children[2].children[0];confirm.checked=true;confirm.onchange();assert.equal(get('tax-export').disabled,false);
 get('tax-export').onclick();assert.match(downloaded,/"750"/);
 get('tax-backup').onclick();const backup=JSON.parse(downloaded);assert.equal(backup.records[0].businessPercent,75);assert.equal(backup.records[0].taxConfirmed,true);assert.equal(backup.year,2026);
});
