(() => {
  const get=id=>document.getElementById(id);let timer;
  async function request(path,body){return bridgeRequest('/api/lan/'+path,body?{method:'POST',headers:{'Content-Type':'application/json','X-Oiso-Lan':'1'},body:JSON.stringify(body)}:{});}
  async function devices(){const state=await request('state');get('lan-devices').replaceChildren(...state.devices.map(d=>{const row=document.createElement('p');row.textContent=d.name+' ';const button=document.createElement('button');button.textContent='このスマホの登録を解除';button.onclick=()=>run(async()=>{if(!confirm('この端末の接続を解除しますか？'))return;await request('revoke',{id:d.id});await devices();});row.append(button);return row;}));return state;}
  async function run(action){try{await action();}catch(e){get('lan-status').textContent='接続操作に失敗しました: '+e.message;}}
  get('lan-refresh').onclick=()=>run(async()=>{const state=await devices();get('lan-status').textContent=`登録端末 ${state.devices.length}台（接続中かどうかはスマホで確認できます）`;});
  get('lan-pair').onclick=()=>run(async()=>{
    const state=await devices();if(!state.addresses.length)throw Error('PCをWi-Fiに接続してください');
    const select=document.createElement('select');select.setAttribute('aria-label','スマホと同じWi-Fiの接続先');state.addresses.forEach(ip=>select.add(new Option(ip,ip)));
    const button=document.createElement('button');button.textContent='この接続先でコードを作り直す';const image=document.createElement('img');image.width=320;image.style.maxWidth='100%';image.alt='OISO2 LAN接続QR';image.hidden=true;
    const create=async()=>{button.disabled=true;try{const result=await request('pair',{host:select.value});image.src=result.qr;image.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{image.hidden=true;get('lan-status').textContent='QRの有効期限が切れました。作り直してください。';},Math.max(0,result.expires-Date.now()));get('lan-status').textContent='スマホのOISOで「PC接続」→「PCの接続QRを読む」を押し、このコードにカメラを向けてください。5分以内に読み取ってください。';}finally{button.disabled=false;}};
    button.onclick=()=>run(create);select.onchange=()=>{image.hidden=true;clearTimeout(timer);get('lan-status').textContent='この接続先でコードを作り直すしてください';};const box=get('lan-qr');box.style.display='flex';box.style.flexDirection='column';box.style.alignItems='flex-start';box.style.gap='12px';const settings=document.createElement('details');const title=document.createElement('summary');title.textContent='読み取れないとき：接続先を変更する';settings.append(title,select,button);box.replaceChildren(image,settings);await create();
  });
})();
