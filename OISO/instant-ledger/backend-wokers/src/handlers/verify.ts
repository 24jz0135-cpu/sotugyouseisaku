interface VerifyRequest {
  id: string;
}

export async function handleVerify(request: Request, env: any): Promise<Response> {
  try {
    // リクエストから確定したいレコードの ID を受け取る
    const data: VerifyRequest = await request.json();

    if (!data.id) {
      return new Response(
        JSON.stringify({ success: false, message: "レコードIDが必要です" }),
        { 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          status: 400 
        }
      );
    }

    // データベース上のステータスを 'VERIFIED' (確定) に更新するSQL
    const query = `
      UPDATE expense_records
      SET status = 'VERIFIED'
      WHERE id = ?
    `;

    await env.DB.prepare(query).bind(data.id).run();

    return new Response(
      JSON.stringify({ success: true, message: "経費レコードを確定しました", id: data.id }),
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
