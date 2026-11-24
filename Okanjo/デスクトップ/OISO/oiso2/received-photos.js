(() => {
  const get=id=>document.getElementById(id);
  let loading=false,previous='';
  const viewer=get('received-viewer');
  get('received-close').onclick=()=>viewer.close();
  async function refresh(){
    if(loading)return;loading=true;get('received-refresh').disabled=true;
    try{
      const result=await bridgeRequest('/api/lan/receipts');
      const photos=result.receipts.slice().sort((a,b)=>b.created.localeCompare(a.created));
      const signature=JSON.stringify(photos);
      if(signature!==previous){
        const cards=photos.map(photo=>{
          const card=document.createElement('article');card.className='tile';
          const image=document.createElement('img');image.src=bridge.base+photo.url;image.alt='届いたレシート';image.loading='lazy';
          const button=document.createElement('button');button.type='button';button.textContent='写真を大きく見る';
          button.onclick=()=>{get('received-full').src=bridge.base+photo.url;viewer.showModal();};
          const date=document.createElement('p');date.textContent=new Date(photo.created).toLocaleString('ja-JP');
          card.append(image,date,button);return card;
        });
        get('received-photos').replaceChildren(...cards);previous=signature;
      }
      get('received-status').textContent=photos.length?`${photos.length}枚の写真をPCに保存済みです。「写真を大きく見る」で内容を確認できます。`:'まだ写真が届いていません。スマホで写真を選び、「送信」を押してください。';
    }catch(_){get('received-status').textContent='届いた写真を確認できませんでした。PC補助アプリを開き直して、もう一度お試しください。';}
    finally{loading=false;get('received-refresh').disabled=false;}
  }
  get('received-refresh').onclick=refresh;
  refresh();setInterval(()=>{if(!document.hidden)refresh();},4000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
