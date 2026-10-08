/* General-business expense preparation; not an e-Tax import or tax return. */
globalThis.OisoTax = (() => {
  const categories = ['租税公課','荷造運賃','水道光熱費','旅費交通費','通信費','広告宣伝費','接待交際費','損害保険料','修繕費','消耗品費','福利厚生費','給料賃金','外注工賃','利子割引料','地代家賃','雑費','会議費','支払手数料','新聞図書費'];
  const custom = new Set(['会議費','支払手数料','新聞図書費']);
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  function summarize(records, year, form) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw Error('対象年は2000〜2100年で指定してください');
    if (!['blue','white'].includes(form)) throw Error('申告の種類を選んでください');
    const ids = new Map();
    records.forEach(row => { const id = row.receiptId || row.id; if(id) ids.set(id,(ids.get(id)||0)+1); });
    const groups = new Map(), details = [];
    let total = 0, pending = 0, outside = 0, excluded = 0, included = 0;
    for (const row of records) {
      const id = row.receiptId || row.id || '', date = row.bookedDate ?? row.date;
      const detail = {id,date,vendor:row.vendor,category:row.taxCategory,amount:row.amount,percent:row.businessPercent,note:row.taxNote||'',expense:null,status:''};
      details.push(detail);
      if(row.taxExcluded === true) { detail.status='対象外（本人指定）'; excluded++; continue; }
      if(validDate(date) && Number(date.slice(0,4)) !== year) { detail.status='対象年外'; outside++; continue; }
      const errors=[];
      if(!validDate(date)) errors.push('計上日');
      if(!id || ids.get(id)>1) errors.push('IDなし・重複');
      if(typeof row.vendor !== 'string' || !row.vendor.trim()) errors.push('店舗名');
      if(!Number.isSafeInteger(row.amount) || Math.abs(row.amount)>1e12) errors.push('整数の金額');
      if(!categories.includes(row.taxCategory)) errors.push('経費科目');
      if(!Number.isInteger(row.businessPercent) || row.businessPercent<0 || row.businessPercent>100) errors.push('事業割合');
      if(row.businessPercent>0 && row.businessPercent<100 && !detail.note.trim()) errors.push('按分の根拠');
      if(row.taxConfirmed !== true) errors.push('本人確認');
      if(errors.length) {detail.status=`要確認: ${errors.join('・')}`;pending++;continue;}
      // Integer yen, integer percentage; truncate each receipt toward zero.
      detail.expense=Number(BigInt(row.amount)*BigInt(row.businessPercent)/100n);
      detail.status=row.businessPercent===0?'私用（0%）':'集計済み';
      if(row.businessPercent===0){excluded++;continue;}
      included++;total+=detail.expense;
      const category=row.taxCategory;
      groups.set(category,(groups.get(category)||0)+detail.expense);
    }
    if(!Number.isSafeInteger(total)) throw Error('合計金額が大きすぎます');
    const title=form==='blue'?'青色申告決算書（一般用）':'収支内訳書（一般用）';
    return {year,form,title,total,pending,outside,excluded,included,details,
      groups:categories.filter(category=>groups.has(category)).map(category=>({category,amount:groups.get(category),destination:custom.has(category)?`空欄に「${category}」を設定`:category}))};
  }
  function csv(rows) {
    return '\uFEFF'+rows.map(row=>row.map(value=>{
      let text=value==null?'':String(value);
      if(typeof value==='string' && /^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    }).join(',')).join('\r\n');
  }
  function summaryCsv(summary) {
    if(summary.pending || !summary.included) throw Error('要確認の明細を確認し、集計対象を1件以上用意してください');
    return csv([['OISO 申告入力用・経費集計（e-Tax取込不可）'],['対象年',summary.year],['入力先',summary.title],['計算方法','明細ごとに事業割合を掛け、1円未満を0方向に切捨て'],['経費科目','入力先の項目','事業分の金額（円）'],...summary.groups.map(row=>[row.category,row.destination,row.amount]),['登録した経費の合計','',summary.total],['範囲','売上・仕入・棚卸・減価償却・貸倒・専従者給与・控除・税額・貸借対照表は含まない'],['確認元','国税庁 令和7年分 一般用の手引き。申告年の様式と照合してください']]);
  }
  function detailsCsv(summary) { return csv([['対象年',summary.year],['レシートID','計上日','店舗名','経費科目','帳簿上の金額（円）','事業割合（%）','事業分（円）','按分の根拠・メモ','状態'],...summary.details.map(row=>[row.id,row.date,row.vendor,row.category,row.amount,row.percent,row.expense,row.note,row.status])]); }
  return {categories,summarize,summaryCsv,detailsCsv};
})();
