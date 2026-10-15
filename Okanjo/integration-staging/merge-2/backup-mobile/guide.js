(() => {
  const steps = [
    { title: 'レシートを撮影', icon: '📷', label: '現場で記録 → レシート撮影', text: '画面下の「現場で記録」を開き、レシート全体をカメラに収めて撮影します。カメラの使用を求められたら許可してください。', tip: '明るい場所で、文字がぶれないように撮影しましょう。' },
    { title: '音声でも入力できます', icon: '🎙️', label: '現場で記録 → 音声メモ', text: '撮影の代わりに「音声メモ」も使えます。「音声メモを入力する」を押し、店舗名・金額・買ったものを話してください。', tip: '例：「田中商店で野菜を3,000円分購入」。入力結果は必ず確認してください。' },
    { title: '内容を確認して保存', icon: '📝', label: '入力内容をチェック', text: '表示された店舗名・金額・勘定科目を確認し、違うところを修正します。「この経費を記録する」を押すと保存されます。', tip: '撮影や音声入力の結果には誤りが含まれることがあります。' },
    { title: '履歴を見て確定', icon: '✅', label: '履歴一覧 → 未確定', text: '画面下の「履歴一覧」で保存した経費を確認します。未確定の記録を見直し、問題がなければ「確定する」を押してください。', tip: '「すべて」「未確定」「確定済み」で表示を切り替えられます。' },
    { title: 'バックアップを残そう', icon: '📦', label: '履歴一覧 → 端末バックアップ', text: '「バックアップ」で会計データと保存済みのレシート画像を .oaiso ファイルに保存できます。「復元」から保存したファイルを読み込めます。', tip: 'データはこのブラウザーに保存されます。ブラウザーのデータを消す前にバックアップしてください。' },
    { title: 'テーマをカスタマイズ', icon: '🎨', label: '右上のパレット → 詳細設定', text: '色テーマを選んだり、詳細設定から背景や各ウィジェットに写真を設定できます。写真は範囲を調整してから適用できます。', tip: '写真の薄さは背景とウィジェットごとに切り替えられます。設定は「見た目を保存」で名前を付けて保存できます。' },
    { title: 'PCへレシートを送る', icon: '🖥️', label: '履歴一覧 → PCへ送信（Relay）', text: 'PCでOISO2 Bridgeを起動してスマホ送信用QRを作成し、Relayの「QRを読み取る」から設定します。その後「未送信の証憑を送る」でレシートをPCへ送れます。', tip: 'RelayはDiscordを経由します。送りたいレシートを確認してから送信してください。'
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
