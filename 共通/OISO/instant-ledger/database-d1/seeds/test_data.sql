-- 1. テスト用のユーザー（飲食店）を登録
INSERT INTO users (id, restaurant_name, tax_filing_type) 
VALUES ('user_shinjuku_001', '新宿ビストロ・エッジ', 'BLUE');

-- 2. スマホの「カメラ」センサーから発生した仕入れ経費のファクト（豊洲市場での仕入れ）
INSERT INTO expense_records (
    id, 
    user_id, 
    timestamp, 
    latitude, 
    longitude, 
    sensor_type, 
    raw_text, 
    amount, 
    category, 
    vendor_name, 
    image_url, 
    status
) VALUES (
    'exp_fact_001',
    'user_shinjuku_001',
    '2026-06-11 06:30:00',      -- 朝の仕入れ時間
    35.6445, 139.7915,          -- 豊洲市場のGPS座標（緯度・経度）
    'CAMERA',                   -- カメラセンサーで撮影
    'レシート: 鮮魚田中 合計 ￥15,400 本マグロほか', -- OCRで読み取った体裁
    15400,
    '仕入高',                    -- 自動判定された勘定科目
    '鮮魚田中 豊洲店',
    'https://storage.cloudflare.com/receipts/001.jpg',
    'VERIFIED'                  -- 確定済み
);

-- 3. スマホの「音声」センサーから発生した経費のファクト（急な買い出し）
INSERT INTO expense_records (
    id, 
    user_id, 
    timestamp, 
    latitude, 
    longitude, 
    sensor_type, 
    raw_text, 
    amount, 
    category, 
    vendor_name, 
    status
) VALUES (
    'exp_fact_002',
    'user_shinjuku_001',
    '2026-06-11 15:00:00',
    35.6909, 139.7003,          -- 新宿の業務スーパー付近の座標
    'VOICE',                    -- 両手が塞がっていたので音声で入力
    '音声メモ: 「業務スーパーでパセリとトマト、現金で2,300円」',
    2300,
    '仕入高',
    '業務スーパー 新宿店',
    'PENDING'                   -- あとでワンタップで確認するため「未確定」
);