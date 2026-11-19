globalThis.OisoReview = (() => {
  const fields = ['receiptId','date','vendor','amount','category','confidence'];
  function parseCsv(text) {
    if(text.length > 2*1024*1024) throw Error('CSVは2MB以内にしてください');
    text=text.replace(/^\uFEFF/,'');
    const rows=[];let row=[],value='',quoted=false,closed=false;
    const cell=()=>{row.push(value);value='';closed=false;};
    const line=()=>{cell();if(row.some(value=>value!==''))rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const char=text[i];
      if(quoted){if(char==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=char;continue;}
      if(char===','){cell();continue;}
      if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;line();continue;}
      if(closed)throw Error('CSVの引用符の後に不正な文字があります');
      if(char==='"'){if(value)throw Error('CSVの引用符が不正です');quoted=true;}else value+=char;
    }
    if(quoted)throw Error('CSVの引用符が閉じていません');
    if(value||closed||row.length)line();
    if(rows.length<2)throw Error('明細が入ったOISOの解析結果CSVを選んでください');
    const header=rows.shift().map(value=>value.trim());
    if(new Set(header).size!==header.length||!fields.slice(0,5).every(key=>header.includes(key)))throw Error('receiptId・date・vendor・amount・categoryの列が必要です');
    if(rows.length>5000)throw Error('一度に読み込める明細は5000件までです');
    const ids=new Set();
    return rows.map((values,index)=>{
      if(values.length!==header.length)throw Error(`${index+2}行目の列数が一致しません`);
      const get=key=>values[header.indexOf(key)]??'';
      const receiptId=get('receiptId').trim();
      if(!receiptId||ids.has(receiptId))throw Error(`${index+2}行目のレシートIDが空欄または重複しています`);
      ids.add(receiptId);
      return {receiptId,date:get('date'),vendor:get('vendor'),amount:get('amount'),category:get('category'),confidence:get('confidence'),confirmed:false};
    });
  }
  function issues(row){
    const errors=[];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date)errors.push('日付');
    if(!row.vendor.trim())errors.push('店舗名');
    if(!/^-?\d+$/.test(row.amount)||!Number.isSafeInteger(Number(row.amount)))errors.push('金額（整数円）');
    if(!row.category.trim())errors.push('科目');
    return errors;
  }
  function merge(existing,incoming){
    const ids=new Set(existing.map(row=>row.receiptId));let skipped=0;
    const added=incoming.filter(row=>{if(ids.has(row.receiptId)){skipped++;return false;}ids.add(row.receiptId);return true;});
    if(existing.length+added.length>5000)throw Error('保存件数の上限は5000件です');
    return {records:[...existing,...added],added:added.length,skipped};
  }
  function csv(records){
    const escape=(value,numeric=false)=>{let text=String(value??'');if(!numeric&&/^[\s]*[=+@-]|^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    return '\uFEFF'+[fields.join(','),...records.map(row=>fields.map(key=>escape(row[key],['amount','confidence'].includes(key)&&/^-?\d+(\.\d+)?$/.test(String(row[key])))).join(','))].join('\r\n');
  }
  function validateSaved(records){
    if(!Array.isArray(records)||records.length>5000)throw Error('保存データの形式が不正です');
    const ids=new Set();
    for(const row of records){if(!row||!fields.every(key=>typeof row[key]==='string')||!row.receiptId||ids.has(row.receiptId)||typeof row.confirmed!=='boolean')throw Error('保存データの形式が不正です');ids.add(row.receiptId);}
    return records;
  }
  return {parseCsv,issues,merge,csv,validateSaved};
})();
