(() => {
  const get=id=>document.getElementById(id);let timer;
  async function request(path,body){return bridgeRequest('/api/lan/'+path,body?{method:'POST',headers:{'Content-Type':'application/json','X-Oiso-Lan':'1'},body:JSON.stringify(body)}:{});}
  async function devices(){const state=await request('state');get('lan-devices').replaceChildren(...state.devices.map(d=>{const row=document.createElement('p');row.textContent=d.name+' ';const button=document.createElement('button');button.textContent='接続解除';button.onclick=()=>run(async()=>{if(!confirm('この端末の接続を解除しますか？'))return;await request('revoke',{id:d.id});await devices();});row.append(button);return row;}));return state;}
  async function run(action){try{await action();}catch(e){get('lan-status').textContent='接続操作に失敗しました: '+e.message;}}
  get('lan-refresh').onclick=()=>run(async()=>{const state=await devices();get('lan-status').textContent=`登録端末 ${state.devices.length}台（接続中かどうかはスマホで確認できます）`;});
  get('lan-pair').onclick=()=>run(async()=>{
    const state=await devices();if(!state.addresses.length)throw Error('PCをWi-Fiに接続してください');
    const select=document.createElement('select');select.setAttribute('aria-label','スマホと同じLANのアドレス');state.addresses.forEach(ip=>select.add(new Option(ip,ip)));
    const button=document.createElement('button');button.textContent='このアドレスでQRを作成';const image=document.createElement('img');image.width=320;image.style.maxWidth='100%';image.alt='OISO2 LAN接続QR';image.hidden=true;
    const create=async()=>{button.disabled=true;try{const result=await request('pair',{host:select.value});image.src=result.qr;image.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{image.hidden=true;get('lan-status').textContent='QRの有効期限が切れました。作り直してください。';},Math.max(0,result.expires-Date.now()));get('lan-status').textContent='スマホの「PC接続 → PCの接続QRを読む」で読み取ってください。5分間・1回限り有効です。';}finally{button.disabled=false;}};
    button.onclick=()=>run(create);select.onchange=()=>{image.hidden=true;clearTimeout(timer);get('lan-status').textContent='このアドレスでQRを作成してください';};const box=get('lan-qr');box.style.display='flex';box.style.flexDirection='column';box.style.alignItems='flex-start';box.style.gap='12px';box.replaceChildren(select,button,image);await create();
  });
})();
