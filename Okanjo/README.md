# OAISO 機能分離

このプロジェクトは、スマートフォン向けInstant Ledger、PC向けOISO2、両者をつなぐOISO2 Bridgeで構成します。

実装済み機能と確認状況は [FEATURES.md](FEATURES.md)、検証結果とデモ手順は [VERIFICATION.md](VERIFICATION.md) を参照してください。

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
