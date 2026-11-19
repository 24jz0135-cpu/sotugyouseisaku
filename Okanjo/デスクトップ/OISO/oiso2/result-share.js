(() => {
  let token;
  const button = document.getElementById('result-share');
  const status = document.getElementById('result-share-status');
  const box = document.getElementById('result-share-box');
  const revoke = document.getElementById('result-share-revoke');
  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      if (!S.records?.length) throw Error('先に解析するか、解析結果を取り込んでください');
      if (token) {
        await bridgeRequest('/api/result-shares/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        token = null; box.replaceChildren(); revoke.hidden = true;
      }
      const fields = ['receiptId', 'date', 'vendor', 'amount', 'category', 'confidence'];
      const csv = [fields.join(','), ...S.records.map(row => fields.map(key => '"' + String(row[key] ?? '').replaceAll('"', '""') + '"').join(','))].join('\r\n');
      const result = await bridgeRequest('/api/result-shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
      token = result.token; box.replaceChildren(); revoke.hidden = false;
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'スマホと同じネットワークのPCアドレス');
      for (const item of result.links) { const option = document.createElement('option'); option.textContent = item.address; select.append(option); }
      const image = document.createElement('img'); image.alt = 'スマホで解析結果を受け取るQR'; image.width = 280; image.style.maxWidth = '100%';
      const link = document.createElement('a'); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.overflowWrap = 'anywhere';
      const show = () => { const item = result.links[select.selectedIndex]; image.src = item.qrDataUrl; link.href = item.url; link.textContent = item.url; };
      select.onchange = show; box.append(select, image, link); box.style.display = 'grid'; box.style.gap = '12px'; show();
      status.textContent = `${result.count}件を共有中（${new Date(result.expiresAt).toLocaleTimeString('ja-JP')}まで）。同じWi-FiのスマホでQRを読んでください。表示中の結果のコピーを渡します。PCで変更した場合はQRを作り直してください。`;
    } catch (error) { status.textContent = `共有できません: ${error.message}`; }
    finally { button.disabled = false; }
  };
  revoke.onclick = async () => {
    revoke.disabled = true;
    try {
      await bridgeRequest('/api/result-shares/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      token = null; box.replaceChildren(); revoke.hidden = true; status.textContent = '共有を終了しました。スマホに保存済みの結果は引き続き編集できます。';
    } catch (error) { status.textContent = `共有を終了できませんでした: ${error.message}`; }
    finally { revoke.disabled = false; }
  };
})();
