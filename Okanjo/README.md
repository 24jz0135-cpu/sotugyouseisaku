# Oaiso 本体（スマホ＋PC補助）

## 採用する構成

- スマホ本体: `integration-staging/flutter-app`（Android ID: `jp.co.oaiso.instant_ledger`）
- PC本体: `デスクトップ/OISO/oiso2`。`OISO2を起動.cmd` を開くと起動します。
- 0.2.0に、QRペアリング・再接続・時計ずれ対策・接続エラー案内を統合しています。PCの簡単操作画面もこの本体に含まれます。
- インストール確認: スマホの「PC接続」に「Oaiso 0.2.0 · 本体統合版」と表示されます。
- 既存アプリと同じID・SQLiteファイル・画像領域を使います。比較版の別DBで既存データを置き換えません。
- 作業フォルダー外の `Oaiso-LAN` は試作比較用として保持します。本体を使う際は不要です。比較版のデータは別アプリのため、自動では取り込みません。

接続手順は [LAN-CONNECTION.md](LAN-CONNECTION.md)、PC操作は [かんたん操作ガイド](デスクトップ/OISO/oiso2/かんたん操作ガイド.md) を参照してください。

QR接続は認証・再接続までです。接続だけで写真が自動転送される機能は含みません。画像の追加と解析結果共有は、PC画面の案内に沿って操作します。実機での通しの確認は未完了です。

---

## 既存構成の詳細

このプロジェクトは、スマートフォン向けInstant Ledger、PC向けOISO2、両者をつなぐOISO2 Bridgeで構成します。

実装済み機能と確認状況は [FEATURES.md](FEATURES.md)、検証結果とデモ手順は [VERIFICATION.md](VERIFICATION.md) を参照してください。

PCの解析結果をスマホへ返して手修正する手順は [PHONE-RESULTS.md](PHONE-RESULTS.md) にまとめています。

## デスクトップ
- `デスクトップ\OISO\oiso2`: レシートの一括取り込み、分析用画像・manifest作成、AI解析結果の取り込み、およびBridge受信箱からの取り込み。
- `デスクトップ\OISO\oiso2\bridge`: 利用者PCで動かすDiscord連携Bridge。初回設定と起動手順は同フォルダーの `README.md` を参照してください。

## スマートフォン
- `スマートフォン\OISO\instant-ledger\frontend-app`: Instant LedgerのWebフロントエンド。テーマ写真・範囲選択・プリセット機能、使い方ガイド、保存済みレシートをBridgeへ送るRelayを統合しています。
- `integration-staging/flutter-app`: Flutter Android版。起動・ビルド方法は同フォルダーの `README.md` を参照してください。Web版は引き続き別フォルダーで維持しています。

## 共通
- `共通\OISO\instant-ledger\backend-wokers`: API、アップロード、検証、集計などのバックエンド。
- `共通\OISO\instant-ledger\database-d1`: D1データベースのマイグレーションとテストデータ。

Bridgeの`.env`と`bridge-data`はPC内に保管し、ルートの`.gitignore`で除外しています。必要なnpm依存関係はBridgeフォルダーで `npm install` して準備してください。
