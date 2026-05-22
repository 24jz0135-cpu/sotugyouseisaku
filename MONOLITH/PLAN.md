# MONOLITH 修正計画

## 現在の問題点（フィードバックから）
1. **テストデータが残っている** - 5万円の収入データ
2. **日付が間違っている** - 2025/01/15（現在2026年）
3. **画像保存ページがない** - OCRで読み取った画像を保存・アップロードする機能が必要
4. **カテゴリ入力が面倒** - いちいち打つのは時間のロス
5. **カテゴリ別に見れない** - データ分析 기능がない

## 修正計画

### ステップ1: useOCR.ts の修正
- モックテキストを削除
- 現在の日付を自動取得（2026年）
- OCR結果を動的に生成

### ステップ2: RecordScreen.tsx の修正
- **カテゴリ選択をリスト化** ← NEW!
  -  predefined categories: 食費, 交通費, 住居費, 光熱費, 医療費, 娯楽費, 買い物, 其他
  - ドロップダウンまたは按钮リストで選択
- ローカルモードから実際のBackend APIに接続
- POSTでentriesテーブルに保存

### ステップ3: AnalyticsScreen.tsx の修正
- **カテゴリ別フィルター追加** ← NEW!
  - カテゴリ별集計・graphs表示
  - 選択したカテゴリだけのデータ表示

### ステップ4: 新機能：画像保存ページの追加
- 読み取った画像をCloudflare R2または別のストレージに保存
- 画像一覧表示ページ
- 画像の詳細表示・削除機能

### ステップ5: テストデータ削除
- 既存のテストデータ（5万円収入）を削除

## 依存ファイル
- `MONOLITH/app/src/hooks/useOCR.ts`
- `MONOLITH/app/src/screens/RecordScreen.tsx`
- `MONOLITH/app/src/screens/AnalyticsScreen.tsx`
- `MONOLITH/app/src/screens/ImageGalleryScreen.tsx` (新規)
- `MONOLITH/TODO.md`

##  predefined カテゴリリスト（案）
- 食費（Food）
- 交通費（Transportation）
- 住居費（Housing）
- 光熱費（Utilities）
- 医療費（Medical）
- 娯楽費（Entertainment）
- 買い物（Shopping）
- 収入（Income）
- その他（Other）

## 次のアクション
承認いただければステップ1から順に修正を開始します。
