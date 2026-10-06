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

## 提供者が持つもの・持たないもの

- 持つ: 共通Discord Botのトークン、接続先チャンネルID、短時間の受信メタデータ。
- 持たない: 利用者のOpenAI/Gemini APIキー、Codex認証、レシート画像の恒久保存、AI解析結果の恒久保存。

画像はDiscordの一時添付としてのみ流れ、利用者のPC Bridgeが受信確認した時点でRelayが元メッセージを削除します。PCだけがローカルのCodexを起動します。

PC Bridgeが受信確認すると、RelayはDiscord上の元画像を削除します。AI解析はOracleでは行わず、利用者PCのCodexだけで実行します。
