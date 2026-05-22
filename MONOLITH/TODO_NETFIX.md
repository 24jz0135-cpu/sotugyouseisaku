原因候補
- RecordScreen.tsx の保存時に fetch('https://heated-duncan-edition-handheld.trycloudflare.com/entries') が失敗すると、アプリ側で Network request failed / Save error が出る。
- まずは「URL到達」「CORS/OPTIONS」「バックエンドが想定ボディを受け取れているか」を確認する。

修正方針（最低限）
- RecordScreen.tsx の handleSave を改善：
  - response.status と response.text() をログ/アラートに含める
  - タイムアウト（Promise.race）を追加
- これで “失敗の理由” が可視化され、次の修正（API URLの誤り等）にすぐ進める。

