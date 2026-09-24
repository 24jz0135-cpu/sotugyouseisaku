-- ① ユーザー（飲食店）を管理するテーブル
CREATE TABLE users (
    id TEXT PRIMARY KEY,          -- ユーザーの固有ID (UUID)
    restaurant_name TEXT NOT NULL, -- 飲食店名
    tax_filing_type TEXT,          -- 'BLUE' (青色申告) or 'WHITE' (白色申告)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ② 経費・仕入れの「現場のファクト」を記録するテーブル（心臓部！）
CREATE TABLE expense_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,     -- 現場で発生した正確な日時
    latitude REAL,                   -- 撮影時の緯度（GPS）
    longitude REAL,                  -- 撮影時の経度（GPS）
    sensor_type TEXT NOT NULL,       -- 'CAMERA' (カメラ), 'VOICE' (音声), 'AUTO_TRIP' (自動移動)
    raw_text TEXT,                   -- OCRや音声認識の生テキスト
    amount INTEGER,                  -- 確定金額
    category TEXT,                   -- 勘定科目 (e.g., '仕入高', '消耗品費')
    vendor_name TEXT,                -- 購入先店舗名 (e.g., '豊洲市場 ○○水産')
    image_url TEXT,                  -- 領収書画像の保存先URL
    status TEXT DEFAULT 'PENDING',   -- 'PENDING' (未確定), 'VERIFIED' (確定)
    FOREIGN KEY (user_id) REFERENCES users(id)
);