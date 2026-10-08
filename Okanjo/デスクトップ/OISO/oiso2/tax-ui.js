function taxElement(tag, text) { const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node; }
function renderTax() {
  const out=$('tax-records');out.replaceChildren();
  (S.records||[]).forEach((row,index)=>{
    if(row.taxCategory===undefined)row.taxCategory=OisoTax.categories.includes(row.category)?row.category:'';
    const card=taxElement('article');card.className='tax-record';
    card.append(taxElement('strong',`${row.receiptId||row.id||'IDなし'} · ${row.vendor||'店舗名未入力'} · ${row.amount??'未入力'}円`));
    const fields=taxElement('div');fields.className='tax-fields';card.append(fields);
    function field(label,key,type,options) {
      const wrapper=taxElement('label',label),input=taxElement(options?'select':'input');
      if(options) options.forEach(([value,text])=>{const option=taxElement('option',text);option.value=value;input.append(option);});
      else input.type=type;
      input.setAttribute('aria-label',`${label} ${index+1}`);
      input.value=row[key]??(key==='bookedDate'?row.date??'':'');
      if(type==='number'){input.min='0';input.max='100';input.step='1';}
      input.oninput=()=>{row[key]=type==='number'?(input.value===''?null:Number(input.value)):input.value;row.taxConfirmed=false;confirmed.checked=false;refreshTaxSummary();};
      wrapper.append(input);fields.append(wrapper);
    }
    field('計上日','bookedDate','date');
    field('経費科目','taxCategory','text',[['','選んでください'],...OisoTax.categories.map(name=>[name,name])]);
    field('事業で使った割合（%）','businessPercent','number');
    field('按分の根拠・メモ','taxNote','text');
    const confirmLabel=taxElement('label',' 科目・金額・計上日・事業割合を確認した'),confirmed=taxElement('input');confirmed.type='checkbox';confirmed.checked=row.taxConfirmed===true;confirmed.onchange=()=>{row.taxConfirmed=confirmed.checked;refreshTaxSummary();};confirmLabel.prepend(confirmed);card.append(confirmLabel);
    const excludeLabel=taxElement('label',' この明細を集計対象から外す'),exclude=taxElement('input');exclude.type='checkbox';exclude.checked=row.taxExcluded===true;exclude.onchange=()=>{row.taxExcluded=exclude.checked;row.taxConfirmed=false;confirmed.checked=false;refreshTaxSummary();};excludeLabel.prepend(exclude);card.append(excludeLabel);
    const status=taxElement('p');status.id=`tax-row-${index}`;status.className='note';card.append(status);out.append(card);
  });
  refreshTaxSummary();
}
function currentTaxSummary(){return OisoTax.summarize(S.records||[],Number($('tax-year').value),$('tax-form').value);}
function refreshTaxSummary(){
  const out=$('tax-summary');out.replaceChildren();$('tax-export').disabled=true;$('tax-details').disabled=true;$('tax-backup').disabled=!(S.records||[]).length;
  try{
    const summary=currentTaxSummary();
    summary.details.forEach((row,index)=>{const node=$(`tax-row-${index}`);if(node)node.textContent=row.status;});
    out.append(taxElement('p',`集計済み ${summary.included}件 ／ 要確認 ${summary.pending}件 ／ 対象年外 ${summary.outside}件 ／ 対象外・私用 ${summary.excluded}件`));
    out.append(taxElement('strong',`登録した経費の合計：${summary.total.toLocaleString('ja-JP')}円`));
    const table=taxElement('table'),head=taxElement('tr');['経費科目','入力先の項目','事業分（円）'].forEach(text=>head.append(taxElement('th',text)));table.append(head);
    summary.groups.forEach(group=>{const tr=taxElement('tr');[group.category,group.destination,group.amount.toLocaleString('ja-JP')].forEach(text=>tr.append(taxElement('td',text)));table.append(tr);});out.append(table);
    if(summary.pending)out.append(taxElement('p','要確認の明細を修正すると、集計表を保存できます。対象外にする場合も明細一覧に残ります。'));
    $('tax-export').disabled=summary.pending>0||!summary.included;$('tax-details').disabled=!summary.details.length;
  }catch(error){out.append(taxElement('p',error.message));}
}
function initTax(){
  $('tax-year').value=new Date().getFullYear();
  $('tax-year').oninput=refreshTaxSummary;$('tax-form').onchange=refreshTaxSummary;
  $('tax-export').onclick=()=>{try{const summary=currentTaxSummary();dl(OisoTax.summaryCsv(summary),`oiso_${summary.year}_${summary.form}_expense_summary.csv`,'text/csv;charset=utf-8');}catch(error){alert(error.message);}};
  $('tax-details').onclick=()=>{try{const summary=currentTaxSummary();dl(OisoTax.detailsCsv(summary),`oiso_${summary.year}_expense_details.csv`,'text/csv;charset=utf-8');}catch(error){alert(error.message);}};
  $('tax-backup').onclick=()=>dl(JSON.stringify({format:'oiso-business-expenses',version:1,year:Number($('tax-year').value),form:$('tax-form').value,records:S.records},null,2),'oiso_expenses_backup.json','application/json');
  renderTax();
}
