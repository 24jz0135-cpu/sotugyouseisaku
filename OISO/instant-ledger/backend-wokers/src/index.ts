import { handleUpload } from './handlers/upload';
import { handleSummary } from './handlers/summary';
import { handleVerify } from './handlers/verify';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    
    const url = new URL(request.url);

    // デバッグ用ログ（通信が届いたか確認するため）
    console.log(`[サーバー受信] メソッド: ${request.method} / パス: ${url.pathname}`);

    // 1. CORSのプリフライト対応
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // 2. ルーティング
    // (A) 新規記録のアップロード (POST /api/upload)
    if (request.method === "POST" && url.pathname === "/api/upload") {
      const response = await handleUpload(request, env);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
    }

    // (B) 履歴一覧の取得 (GET /api/records)
    if (request.method === "GET" && url.pathname === "/api/records") {
      const response = await handleSummary(request, env);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
    }

    // (C) レコードのステータス確定 (POST /api/verify)
    if (request.method === "POST" && url.pathname === "/api/verify") {
      const response = await handleVerify(request, env);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
    }

    // 3. 該当がない場合は404
    return new Response("Not Found (お探しのページ・機能は見つかりません)", { 
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};