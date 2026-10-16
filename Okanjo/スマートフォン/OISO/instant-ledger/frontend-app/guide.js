(() => {
  const steps = [
    { title: 'レシート保管を開く', icon: '📷', label: '画面下 → レシート保管', text: '画面下の「レシート保管」を開き、「写真を撮影・追加する」を押します。カメラの使用を求められたら許可してください。', tip: '背面カメラで撮影するか、端末内の画像を選べます。' },
    { title: '撮影・画像を追加', icon: '🧾', label: '写真を撮影・追加する', text: '撮影した写真は複数枚まとめて追加できます。選択したレシート画像は1枚ずつ端末内に保存されます。', tip: '画像は1枚15MB以下にしてください。明るく、文字が読みやすい写真がおすすめです。' },
    { title: '写真は端末に保存', icon: '💾', label: '保存完了メッセージを確認', text: '保存が完了すると画面に枚数が表示されます。この画面ではOCRやAI解析は行いません。画像は端末内に保管され、後からPCへ送れます。', tip: 'ブラウザーのデータを消すと写真も消えるため、バックアップを利用してください。' },
    { title: '会計データの履歴', icon: '✅', label: '画面下 → 履歴一覧', text: '履歴一覧では登録済みの会計データを確認し、「すべて」「未確定」「確定済み」で表示を切り替えられます。未確定の記録は内容を見直してから確定します。', tip: '撮影したレシート画像の送信は、履歴画面内のRelayを使います。' },
    { title: 'バックアップを残そう', icon: '📦', label: '履歴一覧 → 端末バックアップ', text: '「バックアップ」で会計データと端末に保存したレシート画像を .oaiso ファイルに保存できます。「復元」から読み込めます。', tip: 'ブラウザーのデータを消す前にバックアップしてください。' },
    { title: 'テーマをカスタマイズ', icon: '🎨', label: '右上のパレット → 詳細設定', text: '色テーマを選んだり、詳細設定から背景や各ウィジェットに写真を設定できます。写真は範囲を調整してから適用できます。', tip: '写真の薄さは背景とウィジェットごとに切り替えられます。設定は「見た目を保存」で名前を付けて保存できます。' },
    { title: 'PCへレシートを送る', icon: '🖥️', label: '履歴一覧 → PCへ送信（Relay）', text: 'PCでOISO2 Bridgeのスマホ送信用QRを作成し、Relayの「QRを読み取る」から読み込みます。接続後、「未送信の証憑を送る」を押すと端末に保存した未送信画像をPCへ送れます。', tip: '送信にはDiscordを経由します。PC側のOISO2 Bridgeを起動してから操作してください。'
    }
  ];
  const trigger = document.getElementById('btn-help');
  const dialog = document.getElementById('usage-guide');
  const back = document.getElementById('guide-back');
  const next = document.getElementById('guide-next');
  let index = 0;
  function render() {
    const step = steps[index];
    document.getElementById('guide-count').textContent = `${index + 1} / ${steps.length}`;
    document.getElementById('guide-icon').textContent = step.icon;
    document.getElementById('guide-label').textContent = step.label;
    document.getElementById('guide-title').textContent = step.title;
    document.getElementById('guide-text').textContent = step.text;
    document.getElementById('guide-tip').textContent = step.tip;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'ガイドを閉じる' : '次へ →';
    document.querySelectorAll('.guide-dot').forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      dot.setAttribute('aria-current', i === index ? 'step' : 'false');
    });
  }
  trigger.addEventListener('click', () => { index = 0; render(); dialog.showModal(); });
  document.getElementById('guide-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => trigger.focus());
  back.addEventListener('click', () => { if (index > 0) { index--; render(); } });
  next.addEventListener('click', () => { if (index === steps.length - 1) dialog.close(); else { index++; render(); } });
  document.querySelectorAll('.guide-dot').forEach((dot, i) => dot.addEventListener('click', () => { index = i; render(); }));
})();
