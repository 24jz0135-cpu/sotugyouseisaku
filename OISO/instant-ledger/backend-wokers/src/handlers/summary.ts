export async function handleSummary(request: Request, env: any): Promise<Response> {
  try {
    // D1データベースから全ての経費データを取得し、日付が新しい順（降順）にソートします
    const query = `
      SELECT id, user_id, timestamp, latitude, longitude, sensor_type, raw_text, amount, category, vendor_name, status
      FROM expense_records
      ORDER BY timestamp DESC
    `;

    // SQLを実行し結果を取得
    const { results } = await env.DB.prepare(query).all();

    // JSON形式でレスポンスを返却
    return new Response(
      JSON.stringify(results),
      {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 200
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: `サーバーエラー: ${error.message}` }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 500 
      }
    );
  }
}
