(() => {
  const KEY = 'oiso-relay-session';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const set = value => {
    localStorage.setItem(KEY, JSON.stringify(value));
    if (value.deviceId) localStorage.setItem(`${KEY}-sent-${value.deviceId}`, JSON.stringify(value.sentReceiptIds || []));
  };
  const valid = value => value?.format === 'oiso-relay' && value?.uploadUrl?.startsWith('https://discord.com/api/webhooks/') && Date.now() < value.expiresAt;
  const style = document.createElement('style');
  style.textContent = '.relay-panel{margin:16px 0;padding:15px;border:1px solid #bcdced;border-radius:14px;background:#f5fbff}.relay-panel h3{margin:0 0 6px}.relay-panel p{margin:0 0 10px;font-size:12px;line-height:1.6;color:#5d7186}.relay-actions{display:flex;gap:8px;flex-wrap:wrap}.relay-actions button{border:0;border-radius:9px;padding:9px 11px;background:#1769aa;color:#fff;font-weight:700}.relay-actions button.secondary{background:#e9f3f9;color:#1769aa}.relay-modal{position:fixed;inset:0;z-index:100;background:#001527a8;display:grid;place-items:center;padding:20px}.relay-modal>div{width:min(420px,100%);background:#fff;border-radius:18px;padding:20px}.relay-modal h2{margin:0 0 8px;font-size:20px}.relay-modal p{font-size:13px;line-height:1.6;color:#60738a}.relay-modal textarea{width:100%;min-height:90px;margin:8px 0;border:1px solid #bcd3e0;border-radius:9px;padding:9px}.relay-modal video{width:100%;border-radius:10px}.relay-status{font-size:12px;color:#1769aa;font-weight:700}.relay-close{float:right;border:0;background:none;font-size:20px}'; document.head.append(style);
  function panel() {
    const anchor = document.querySelector('.backup-panel'); if (!anchor) return;
    const node = document.createElement('section'); node.className = 'relay-panel'; node.innerHTML = '<h3>PCへ送信（Relay）</h3><p id="relay-copy">PCのOISO2 Bridgeが作成した一時QRを読み込むと、保存済みレシートをDiscordアプリなしでPCへ配送できます。</p><div class="relay-actions"><button id="relay-scan">QRを読み取る</button><button id="relay-send" class="secondary">未送信の証憑を送る</button><button id="relay-clear" class="secondary">設定を消す</button></div><p id="relay-status" class="relay-status"></p>';
    anchor.after(node); $('#relay-scan').onclick = openScanner; $('#relay-send').onclick = send; $('#relay-clear').onclick = () => { localStorage.removeItem(KEY); status('送信先設定を消しました。'); };
  }
  const $ = selector => document.querySelector(selector);
  const status = text => { const node = $('#relay-status'); if (node) node.textContent = text; };
  function saveConfig(text) {
    try { const config = JSON.parse(text); if (!valid(config)) throw new Error('期限切れ、またはOISO2 BridgeのQRではありません'); if (config.deviceId) config.sentReceiptIds = JSON.parse(localStorage.getItem(`${KEY}-sent-${config.deviceId}`) || '[]'); set(config); status(`PC送信先を設定しました（${new Date(config.expiresAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}まで）。`); return true; }
    catch (error) { status(error.message); return false; }
  }
  function openScanner() {
    const modal = document.createElement('div'); modal.className = 'relay-modal'; modal.innerHTML = '<div><button class="relay-close">×</button><h2>PCのQRを読み取る</h2><p>OISO2 Bridgeで作成した「スマホ送信用QR」を映してください。カメラが使えない場合は、QRの内容を貼り付けられます。</p><div id="relay-reader"></div><textarea id="relay-paste" placeholder="設定文字列を貼り付け"></textarea><div class="relay-actions"><button id="relay-apply">設定する</button></div></div>'; document.body.append(modal);
    let scanner; const close = () => { scanner?.clear?.().catch(()=>{}); modal.remove(); };
    modal.querySelector('.relay-close').onclick = close;
    modal.querySelector('#relay-apply').onclick = () => { if (saveConfig(modal.querySelector('#relay-paste').value.trim())) close(); };
    if (window.Html5QrcodeScanner) { scanner = new Html5QrcodeScanner('relay-reader', { fps: 8, qrbox: 220 }, false); scanner.render(text => { if (saveConfig(text)) close(); }, () => {}); }
  }
  let sending = false;
  async function send() {
    if (sending) return;
    const config = get(); if (!valid(config)) return status('先にPCの一時QRを読み取ってください。');
    const button = $('#relay-send');
    sending = true; button.disabled = true;
    let completed = 0;
    try {
      const receipts = await receiptVault.getAll(); const unsent = receipts.filter(receipt => !config.sentReceiptIds?.includes(receipt.id));
      if (!unsent.length) return status('この送信先へ送れる未送信の証憑はありません。');
      for (const receipt of unsent) {
        if (!valid(config)) throw new Error('QRの有効期限が切れました。PCで新しいQRを作成してください');
        const bytes = Uint8Array.from(atob(receipt.dataUrl.split(',')[1]), char => char.charCodeAt(0));
        if (bytes.length > 20 * 1024 * 1024) throw new Error(`${receipt.id} は20MBを超えています`);
        const type = receipt.mimeType || 'image/jpeg';
        const extension = ({ 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[type] || 'jpg';
        const form = new FormData();
        form.append('payload_json', JSON.stringify({ content: `OISO Relay ${config.sessionId}`, allowed_mentions: { parse: [] } }));
        form.append('files[0]', new File([bytes], `${receipt.id}.${extension}`, { type }));
        status(`${completed + 1}/${unsent.length}枚を送信中…`);
        for (let retry = 0; ; retry++) {
          const response = await fetch(`${config.uploadUrl}?wait=true`, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
          if (response.status === 429 && retry < 3) {
            const limit = await response.json();
            const seconds = Math.min(30, Math.max(1, Number(limit.retry_after) || 2));
            status(`混み合っています。${seconds}秒後に再送します…`);
            await new Promise(resolve => setTimeout(resolve, seconds * 1000));
            if (!valid(config)) throw new Error('QRの有効期限が切れました');
            continue;
          }
          if (!response.ok) throw new Error(`送信できませんでした (${response.status})`);
          break;
        }
        config.sentReceiptIds = [...new Set([...(config.sentReceiptIds || []), receipt.id])];
        set(config); completed++;
      }
      status(`${completed}枚をDiscordへ送信しました。PCのOISO2で受信を確認してください。`);
    } catch (error) { status(`${completed}枚送信済み。送信停止: ${error.message}。再実行すると未送信分から再開します。`); }
    finally { sending = false; button.disabled = false; }
  }
  document.addEventListener('DOMContentLoaded', panel);
})();
