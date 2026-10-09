(() => {
  const KEY='oiso-mobile-csv-review-v1', $=id=>document.getElementById(id);
  let records=[],blocked=false,page=0;const pageSize=20;
  function message(text){$('review-status').textContent=text;}
  function save(next){
    if(blocked)throw Error('保存データを読み込めないため、上書きを停止しています');
    localStorage.setItem(KEY,JSON.stringify(next));records=next;
  }
  function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
  function summary(){
    const checked=records.filter(row=>row.confirmed&&!OisoReview.issues(row).length).length;
    $('review-summary').textContent=`全${records.length}件 · 未確認${records.length-checked}件 · 確認済み${checked}件`;
    $('review-export').disabled=checked===0;$('review-export').textContent=`確認済み${checked}件をCSV保存`;
    $('review-backup').disabled=!records.length;
  }
  function update(id,patch){
    const next=records.map(row=>row.receiptId===id?{...row,...patch}:row);
    try{save(next);summary();message('この端末に保存しました。');return true;}
    catch(error){message(`保存できませんでした。変更は反映されていません: ${error.message}`);render();return false;}
  }
  function render(){
    summary();const filter=$('review-filter').value;
    const visible=records.filter(row=>filter==='all'||(filter==='pending'?!row.confirmed:row.confirmed));
    page=Math.min(page,Math.max(0,Math.ceil(visible.length/pageSize)-1));
    const out=$('review-list');out.replaceChildren();
    if(!visible.length)out.append(element('p',records.length?'該当する明細はありません。':'Discordから解析結果のCSVを保存し、「解析CSVを読み込む」で選んでください。'));
    visible.slice(page*pageSize,(page+1)*pageSize).forEach(row=>{
      const card=element('article');card.className='review-card';
      card.append(element('h3',row.receiptId));
      const badge=element('p',row.confirmed?'確認済み':'未確認');badge.className='review-badge';card.append(badge);
      const controls=element('div');controls.className='review-fields';card.append(controls);
      let confirmButton;
      for(const [key,label,type] of [['vendor','店舗名','text'],['date','日付','date'],['amount','金額（円）','number'],['category','科目','text']]){
        const wrapper=element('label',label),input=element('input');input.type=type;input.value=row[key];input.setAttribute('aria-label',`${label} ${row.receiptId}`);
        if(type==='number')input.step='1';
        input.oninput=()=>{
          if(update(row.receiptId,{[key]:input.value,confirmed:false})){
            row=records.find(item=>item.receiptId===row.receiptId);badge.textContent='未確認';confirmButton.textContent='内容を確認済みにする';
            validation.textContent=OisoReview.issues(row).length?`確認が必要: ${OisoReview.issues(row).join('・')}`:'';
          }
        };
        wrapper.append(input);controls.append(wrapper);
      }
      const validation=element('p');validation.className='review-validation';validation.textContent=OisoReview.issues(row).length?`確認が必要: ${OisoReview.issues(row).join('・')}`:'';card.append(validation);
      confirmButton=element('button',row.confirmed?'未確認に戻す':'内容を確認済みにする');confirmButton.type='button';
      confirmButton.onclick=()=>{
        const current=records.find(item=>item.receiptId===row.receiptId),errors=OisoReview.issues(current);
        if(!current.confirmed&&errors.length){message(`${row.receiptId}: ${errors.join('・')}を修正してください。`);return;}
        if(update(row.receiptId,{confirmed:!current.confirmed}))render();
      };
      card.append(confirmButton);out.append(card);
    });
    $('review-page').textContent=`${page+1} / ${Math.max(1,Math.ceil(visible.length/pageSize))}`;
    $('review-prev').disabled=page===0;$('review-next').disabled=(page+1)*pageSize>=visible.length;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    try{records=OisoReview.validateSaved(JSON.parse(localStorage.getItem(KEY)||'[]'));}
    catch(error){blocked=true;message(`保存済みの確認データを読み込めません。上書きせず停止しました: ${error.message}`);}
    $('review-import').disabled=blocked;
    $('review-import').onchange=async event=>{
      const file=event.target.files[0];if(!file)return;event.target.disabled=true;
      try{
        if(file.size>2*1024*1024)throw Error('CSVは2MB以内にしてください');
        const incoming=OisoReview.parseCsv(await file.text()),result=OisoReview.merge(records,incoming);
        save(result.records);page=0;$('review-filter').value='all';render();message(`${result.added}件を追加しました。同じIDの${result.skipped}件は、保存済みの修正を守るため追加していません。`);
      }catch(error){message(`読み込めませんでした: ${error.message}`);}
      finally{event.target.value='';event.target.disabled=blocked;}
    };
    $('review-filter').onchange=()=>{page=0;render();};
    $('review-prev').onclick=()=>{page--;render();};$('review-next').onclick=()=>{page++;render();};
    $('review-export').onclick=()=>{const checked=records.filter(row=>row.confirmed&&!OisoReview.issues(row).length);if(!checked.length)return;download(OisoReview.csv(checked),'oiso_mobile_reviewed.csv','text/csv;charset=utf-8');message(`確認済み${checked.length}件を出力しました。未確認${records.length-checked.length}件は含みません。`);};
    $('review-backup').onclick=()=>download(OisoReview.csv(records),'oiso_mobile_working.csv','text/csv;charset=utf-8');
    render();
  });
})();
