# OISO2 Bridge（利用者PCで実行）

Discordを受信箱として使い、添付されたレシート画像をこのPCへ保存します。標準構成では、開発者がOracle Cloudで動かす共通Botを使うため、利用者がBotトークンを作る必要はありません。AI解析はこのPCでのみ動きます。

## 初回設定

1. `.env.example` をコピーして `.env` を作り、運営者から案内された `COMMON_RELAY_URL` を設定します。
2. このフォルダで `npm install`、続けて `npm start` を実行します。
3. OISO2を `http://127.0.0.1:4174/` で開き、「Bridgeを確認」→「Discordとペアリング」を押します。
4. Botを入れた自分専用Discordチャンネルに、画面へ表示された `!oiso-pair ...` を送ります。
5. 接続完了後に「スマホ送信用QRを作成」を押します。

### 自分のBotを使う場合（開発用・従来方式）

`COMMON_RELAY_URL` を空欄にし、`DISCORD_BOT_TOKEN` と `DISCORD_CHANNEL_ID` を設定すれば、利用者自身のBotにも接続できます。実際のトークンはGitへコミットしないでください。

## スマホから送る

Discord接続済みのOISO2で「スマホ送信用QRを作成」を押し、OISOの履歴画面にある「PCへ送信（Relay）」から読み取ります。QRは送信専用の一時Webhook URLで、10分後にPC Bridgeが削除します。BotトークンはQRにもスマホにも渡りません。

## 解析モード

- `ANALYZER_MODE=mock` はCSVまでの配送・編集を検証する安全な初期設定です。
- `ANALYZER_MODE=codex` は、このPCでサインイン済みの `codex` を起動します。画像を添付し、`schema.json` に沿うJSONを作らせます。利用者自身のCodex/ChatGPT利用枠を使います。

`AUTO_ANALYZE=true` にすると、Discordから受信した画像をFIFOキューへ追加し、完了時にCSVを同じDiscordチャンネルへ返します。受け付けるのは画像だけで、Discordの自由文をCodexやシェルへ渡すことはありません。まずは `false` のまま受信・手動解析を確認してから有効にしてください。

Bridgeは `127.0.0.1` だけで待ち受けます。外部ネットワークへ受信箱を公開しません。
