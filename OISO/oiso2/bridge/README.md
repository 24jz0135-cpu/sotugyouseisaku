# OISO2 Bridge（利用者PCで実行）

Discordを受信箱として使い、添付されたレシート画像をこのPCへ保存します。Botトークン・画像・CSVは開発者のサーバーへ送信しません。

## 初回設定

1. Discord Developer Portalで**自分用**のBotを作成し、専用の非公開チャンネルへ追加します。
2. Botにそのチャンネルの「メッセージを見る」「メッセージを送信」「添付ファイルを送信」権限を与えます。
3. `.env.example` をコピーして `.env` を作り、`DISCORD_BOT_TOKEN` と `DISCORD_CHANNEL_ID` を設定します。`.env` はGit管理外です。トークンをOISO本体やGitへ書かないでください。
4. このフォルダで `npm install`、続けて `npm start` を実行します。
5. OISO2を `http://127.0.0.1:4174/` で開き、「Bridgeの受信箱を取り込む」を押します。

## スマホから送る

Discord接続済みのOISO2で「スマホ送信用QRを作成」を押し、OISOの履歴画面にある「PCへ送信（Relay）」から読み取ります。QRは送信専用の一時Webhook URLで、10分後にPC Bridgeが削除します。BotトークンはQRにもスマホにも渡りません。

## 解析モード

- `ANALYZER_MODE=mock` はCSVまでの配送・編集を検証する安全な初期設定です。
- `ANALYZER_MODE=codex` は、このPCでサインイン済みの `codex` を起動します。画像を添付し、`schema.json` に沿うJSONを作らせます。利用者自身のCodex/ChatGPT利用枠を使います。

Bridgeは `127.0.0.1` だけで待ち受けます。外部ネットワークへ受信箱を公開しません。
