# OISO Common Relay（Oracle Cloud）

共通Discord BotをOracle Cloudで常駐させる中継サービスです。画像本体は保存せず、Discord添付URLと受信状態だけを持ちます。

## 利用者の接続

1. Discordで専用サーバーとテキストチャンネルを作り、OISO Botを招待する。
2. PCのOISO2 Bridgeでペアリングコードを作り、そのチャンネルへ `!oiso-pair コード` と送る。
3. Bridgeが接続完了を確認したら、QRでスマホを接続する。

## Oracle Cloudでの起動

1. Always FreeのUbuntu VMへNode.js 20以降を入れる。
2. `npm install` を実行し、`.env.example` を `.env` へコピーする。
3. 共通Botのトークンを `.env` に設定する。実値をGitへコミットしない。
4. Developer PortalでMessage Content Intentを有効化し、Botへ「チャンネルを見る」「メッセージを送信・管理」「Webhookを管理」の権限を与える。
5. `oiso-common-relay.service` の `User` と `WorkingDirectory` を実環境に合わせ、`/etc/systemd/system/` へ配置する。`systemctl enable --now oiso-common-relay` で常駐化する。
6. Nginx/CaddyなどのHTTPSリバースプロキシ経由で公開し、PC Bridgeの `COMMON_RELAY_URL` にその `https://` URLを設定する。Nodeの3000番ポートをインターネットへ直接公開しない。

## Northflankでの起動

- GitHubリポジトリの `main` を選び、Combined serviceとして作成する。
- Build context: `/`、Dockerfile location: `/deploy/common-relay/Dockerfile`（リポジトリのルート基準）。Northflankのパス入力制約に合わせ、起動設定は英数字の場所に置く。専用の `Dockerfile.dockerignore` でソース4ファイルのみを取り込み、`.env` や保存データを除外する。
- Runtime variable `DISCORD_BOT_TOKEN` に本人がBotトークンを設定する。Gitやビルド引数へ含めない。
- HTTPの公開ポートは `3000`、ヘルスチェックは `GET /health`。起動後は応答の `discord: true` まで確認する。
- 永続ボリュームを `/app/relay-data` にマウントし、インスタンスは1つにする。永続ボリュームなしでは再配置時にペアリング情報や削除待ちの情報が失われるため、本運用しない。利用可能なプラン・料金を画面で確認してから作成する。
- 公開されたHTTPS URLをPC Bridgeの `COMMON_RELAY_URL` に設定する。
- Dockerでは `HOST=0.0.0.0`。従来のVM直接起動は `127.0.0.1` のまま。保存先は `RELAY_DATA_DIR` で変更できる。

## 提供者が持つもの・持たないもの

- 持つ: 共通Discord Botのトークン、接続先チャンネルID、短時間の受信メタデータ。
- 持たない: 利用者のOpenAI/Gemini APIキー、Codex認証、レシート画像の恒久保存、AI解析結果の恒久保存。

画像はDiscordの一時添付としてのみ流れ、利用者のPC Bridgeが受信確認した時点でRelayが元メッセージを削除します。PCだけがローカルのCodexを起動します。

PC Bridgeが受信確認すると、RelayはDiscord上の元画像を削除します。AI解析はOracleでは行わず、利用者PCのCodexだけで実行します。
