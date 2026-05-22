-- 1. 取引データ（収入・支出のメイン記録）
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,          -- 'income' (収入) か 'expense' (支出)
  amount INTEGER NOT NULL,      -- 金額
  category TEXT,               -- 勘定科目（自動仕分け用）
  description TEXT,            -- ボイスメモのテキスト化内容
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. センサーログ（事実の証拠）
CREATE TABLE IF NOT EXISTS sensor_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER,            -- どの取引に紐付いているか
  latitude REAL,               -- 位置情報（緯度）
  longitude REAL,              -- 位置情報（経度）
  vibration_flag INTEGER,      -- レジの振動検知（0 or 1）
  device_id TEXT,              -- どのスマホで記録したか
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

-- 3. レシート・納品書（画像解析データ）
CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER,
  image_url TEXT,              -- R2ストレージ等に保存したURL
  ocr_raw_text TEXT,           -- 読み取った生の文字列
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);