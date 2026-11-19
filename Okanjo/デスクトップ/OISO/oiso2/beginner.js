(() => {
  const get=id=>document.getElementById(id);
  get('guide-open').onclick=()=>{get('guide').hidden=false;get('guide').scrollIntoView({behavior:'smooth'});};
  get('guide-close').onclick=()=>{get('guide').hidden=true;get('guide-open').focus();};
  function refresh(){const count=S.records?.length||0;get('result-share').disabled=!count;get('return-count').textContent=count?`${count}件の読み取り結果があります。下のボタンで、スマホに渡してください。`:'まだ読み取り結果がありません。手順3で回答を受け取ると、ここからスマホへ渡せます。';}
  new MutationObserver(refresh).observe(get('results'),{childList:true});refresh();
  get('answer-import').onclick=()=>{
    const text=get('answer').value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    if(!text){get('answer-status').textContent='先にChatGPTの回答をコピーし、上の欄に貼り付けてください。';get('answer').focus();return;}
    try{
      const value=JSON.parse(text),rows=Array.isArray(value)?value:value.records??value.receipts;
      if(!Array.isArray(rows)||!rows.length)throw Error('読み取り結果が含まれていません');
      const ids=new Set(S.r.map(r=>r.id));
      if(ids.size&&rows.some(r=>!r||!ids.has(r.receiptId)))throw Error('選んだ写真と回答の番号が一致しません。今回作った画像を使って、もう一度読み取ってください');
      importLedger(rows);
      get('answer-status').textContent=`${rows.length}件の回答を受け取りました。次は「4 スマホに渡して、確認する」へ進んでください。`;
      refresh();get('step-return').scrollIntoView({behavior:'smooth'});
    }catch(e){get('answer-status').textContent='回答を受け取れませんでした。ChatGPTの回答全体をコピーして貼り付け直してください。 '+(e instanceof SyntaxError?'':e.message);}
  };
})();
