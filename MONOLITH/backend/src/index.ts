import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Cloudflare Workers 環境で D1 バインディングを型付け
interface Bindings {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ヘルスチェック
app.get('/', (c) => c.json({ status: 'ok', service: 'monolith-api' }));

// 全エントリー取得
app.get('/entries', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM entries ORDER BY created_at DESC'
  ).all();
  return c.json(results ?? []);
});

// エントリー詳細（センサー・画像付き）
app.get('/entries/:id', async (c) => {
  const id = c.req.param('id');
  const entry = await c.env.DB.prepare(
    'SELECT * FROM entries WHERE id = ?'
  ).bind(id).first();

  if (!entry) return c.json({ error: 'Not found' }, 404);

  const sensors = await c.env.DB.prepare(
    'SELECT * FROM sensor_evidence WHERE entry_id = ?'
  ).bind(id).all();

  const images = await c.env.DB.prepare(
    'SELECT * FROM images WHERE entry_id = ?'
  ).bind(id).all();

  return c.json({
    ...entry,
    sensor_evidence: sensors.results ?? [],
    images: images.results ?? [],
  });
});

// エントリー作成
app.post('/entries', async (c) => {
  const body = await c.req.json<{
    type: 'income' | 'expense';
    amount: number;
    category?: string;
    description?: string;
    sensor?: {
      latitude?: number;
      longitude?: number;
      vibrationFlag?: number;
      device_id?: string;
    };
    image_url?: string;
    ocr_raw_text?: string;
  }>();

  const { type, amount, category, description, sensor, image_url, ocr_raw_text } = body;

  if (!type || amount == null || Number.isNaN(amount)) {
    return c.json({ error: 'Missing required fields: type, amount' }, 400);
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO entries (type, amount, category, description) VALUES (?, ?, ?, ?) RETURNING id'
  )
    .bind(type, amount, category ?? null, description ?? null)
    .first<{ id: number }>();

  const entryId = result?.id;
  if (!entryId) {
    return c.json({ error: 'Failed to create entry' }, 500);
  }

  // センサー証拠保存
  if (sensor) {
    await c.env.DB.prepare(
      'INSERT INTO sensor_evidence (entry_id, latitude, longitude, vibration_flag, device_id) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(
        entryId,
        sensor.latitude ?? null,
        sensor.longitude ?? null,
        sensor.vibrationFlag ?? 0,
        sensor.device_id ?? null
      )
      .run();
  }

  // 画像・OCR保存
  if (image_url || ocr_raw_text) {
    await c.env.DB.prepare(
      'INSERT INTO images (entry_id, image_url, ocr_raw_text) VALUES (?, ?, ?)'
    )
      .bind(entryId, image_url ?? null, ocr_raw_text ?? null)
      .run();
  }

  return c.json({ id: entryId, created: true }, 201);
});

// エントリー削除
app.delete('/entries/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM sensor_evidence WHERE entry_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM images WHERE entry_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});

// 月次サマリー
app.get('/analytics/monthly', async (c) => {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = c.req.query();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;

  const income = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE type = 'income' AND created_at >= ? AND created_at < ?"
  ).bind(start, end).first<{ total: number }>();

  const expense = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM entries WHERE type = 'expense' AND created_at >= ? AND created_at < ?"
  ).bind(start, end).first<{ total: number }>();

  return c.json({
    year: Number(year),
    month: Number(month),
    income: income?.total ?? 0,
    expense: expense?.total ?? 0,
    balance: (income?.total ?? 0) - (expense?.total ?? 0),
  });
});

export default app;

