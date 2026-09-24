// 型の定義（Javaのクラスやインターフェースのイメージです）
// スマホから送られてくるデータの形をあらかじめ定義して安全性を高めます
interface UploadRequest {
  userId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  sensorType: 'CAMERA' | 'VOICE';
  rawText: string;
  amount: number;
  category: string;
  vendorName: string;
}

export async function handleUpload(request: Request, env: any): Promise<Response> {
  try {
    // 1. スマホから送られてきたJSONデータを受け取る (JSでおなじみの処理)
    const data: UploadRequest = await request.json();

    // 2. データのバリデーション（簡易チェック）
    if (!data.userId || !data.amount) {
      return new Response("必要なデータが足りません", { status: 400 });
    }

    // 3. Cloudflare D1 (SQLデータベース) にデータを挿入する
    // あなたが勉強している SQL の INSERT 文そのものです！
    const query = `
      INSERT INTO expense_records (
        id, user_id, timestamp, latitude, longitude, sensor_type, raw_text, amount, category, vendor_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `;

    // ランダムな一意のID（UUID）を生成 (JavaのUUID.randomUUID()のようなもの)
    const recordId = crypto.randomUUID();

    // D1データベースに対してSQLを実行する (JSの非同期処理 async/await)
    await env.DB.prepare(query)
      .bind(
        recordId,
        data.userId,
        data.timestamp,
        data.latitude,
        data.longitude,
        data.sensorType,
        data.rawText,
        data.amount,
        data.category,
        data.vendorName
      )
      .run();

    // 4. スマホ側に「無事に保存できたよ！」とレスポンスを返す
    return new Response(
      JSON.stringify({ success: true, message: "現場のファクトを記録しました", id: recordId }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    // エラーが発生した場合の処理 (Javaの try-catch と全く同じ思想)
    return new Response(`サーバーエラー: ${error.message}`, { status: 500 });
  }
}