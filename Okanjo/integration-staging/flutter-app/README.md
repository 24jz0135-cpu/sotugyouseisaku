# OISO Flutter アプリ

このディレクトリはスマートフォン向けFlutterアプリです。既存のHTML版はそのまま残し、Flutter版はAndroidネイティブアプリとして起動します。

## 起動

このプロジェクトは日本語を含むWindowsパスにあります。Android実機の起動では一部Androidツールがそのパスを扱えないため、英数字のショートカットを用意しています。

```powershell
Set-Location C:\tmp\OISOFlutter
flutter devices
flutter run -d <端末ID>
```

ショートカットがない場合は、PowerShellで次のように作成します。

```powershell
New-Item -ItemType Junction -Path C:\tmp\OISOFlutter -Target 'C:\Users\24jz\Downloads\sotugyouseisaku-main (2)\sotugyouseisaku-main\Okanjo\スマートフォン\OISO\instant-ledger\frontend-app'
```

## 保存先

アプリの記録・テーマ・解析結果は端末内のアプリ設定領域に保存します。写真はアプリ専用領域の `OISO/receipts` と `OISO/theme-photos` に保存され、他のファイルと混在しません。端末バックアップは `.oaiso` ファイルとして共有・復元できます。

## 主な画面

- 経費帳：月の集計、未確定・確定済み件数、記録追加、バックアップ
- レシート保管：カメラ撮影、端末写真の選択、写真の閲覧と削除
- 履歴一覧：記録の編集・確定、PCへ送信（Relay）
- 詳細設定：5色テーマ、画面・ウィジェット別の写真、写真の範囲選択、薄く表示する設定、テーマ設定の保存
- 解析結果の確認：PC側で作成したCSVの読み込み、編集、確定、共有

音声メモの録音画面は含めていません。
