document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('receive-retry'), status = document.getElementById('receive-status');
  async function receive() {
    if (button.disabled) return;
    button.disabled = true;
    try {
      const response = await fetch('data', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error('共有期限が切れた場合はPCでQRを作り直してください');
      const result = await response.json();
      if (result.format !== 'oiso-result' || typeof result.csv !== 'string') throw Error('結果の形式が不正です');
      const imported = globalThis.importOisoReviewCsv(result.csv);
      status.textContent = `${imported.added}件を受信しました。下の明細で間違いを修正してください。`;
    } catch (error) { status.textContent = `受信できませんでした: ${error.message}。同じWi-Fiに接続し、PCのOISOを起動したまま再試行してください。保存済みの明細は下から編集できます。`; }
    finally { button.disabled = false; }
  }
  button.onclick = receive;
  receive();
});
