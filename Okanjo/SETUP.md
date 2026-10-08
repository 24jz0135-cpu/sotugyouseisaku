# OISOを実機で使える状態にする

## 現在の状態

スマホの撮影・保存・Discord送信、PCの受信・解析呼び出し・CSV保存、共通Relayのコードがあります。
このPCではDiscord BotとOracle VMがまだ作られていないため、外部配送と実レシートのAI解析の実機確認は未完了です。
mockモードのCSVは空欄のテスト用データです。会計データとして使わないでください。

## 1. PC版だけ起動する

1. Node.jsをインストールしたPCで、`デスクトップ/OISO/oiso2/start.ps1` をPowerShellから実行します。
2. ブラウザで `http://127.0.0.1:8788/` を開きます。別のWebサーバーは不要です。
3. Discordが未設定でも、画像を追加して分析用画像を作り、AIの回答JSONを取り込めます。
4. 結果欄で店名・日付・金額・勘定科目を修正し、「確認・修正したCSVを保存」を押します。
5. 起動したPowerShellを閉じるとBridgeも止まります。

## 2. Discord Botを作る（提供者が1回だけ）

1. [Discord Developer Portal](https://discord.com/developers/applications)へ本人のアカウントでログイン。
2. New Applicationから `OISO` を作成し、Bot画面を開きます。
3. Message Content Intentを有効化して保存します。
4. Bot Tokenを発行します。値はOracle上の`.env`へ保存し、チャット・Git・画面共有に載せません。
5. Botの招待URLを生成します。scopeは `bot`。権限は View Channels / Send Messages / Read Message History / Attach Files / Manage Messages / Manage Webhooks を選びます。
6. 自分のテスト用Discordサーバーへ招待し、専用の非公開テキストチャンネルを作ります。Botがそのチャンネルを読めるようにします。
7. ペアリングコマンドは、そのチャンネルの「チャンネルの管理」権限を持つユーザーが送ります。

公式: https://docs.discord.com/developers/quick-start/getting-started

## 3. Oracleに中継サーバーを用意する

本人によるOracle登録・本人確認と、費用条件の確認が必要です。無料と表示される対象構成を選び、容量不足の場合に有料構成へ自動で変更しないでください。

1. Oracle CloudのCompute → InstancesでUbuntu VMを作ります。
2. SSH公開鍵を登録し、対応する秘密鍵は自分のPCで保管します。
3. パブリックIPv4を確認し、所有するドメインのサブドメイン（例 `relay.example.com`）のAレコードを向けます。
4. Oracleのネットワーク設定とVMのファイアウォールでHTTPS 443とHTTP 80を許可します。SSH 22は管理するPCの接続元に絞ります。3000番は公開不要です。
5. VMにNode.js（20以降）、npm、Nginx、TLS証明書の取得・更新ツールを準備します。

公式: https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm

### サービスの配置

以下はVM上で行います。プロジェクトの `共通/OISO/common-relay` の中身を `/opt/oiso-common-relay` に配置してください。

```sh
sudo useradd --system --home /opt/oiso-common-relay --shell /usr/sbin/nologin oiso
sudo mkdir -p /opt/oiso-common-relay/relay-data
sudo chown -R oiso:oiso /opt/oiso-common-relay
cd /opt/oiso-common-relay
sudo -u oiso npm ci --ignore-scripts
sudo -u oiso cp .env.example .env
sudo chmod 600 .env
sudo -u oiso nano .env
```

`.env`の `DISCORD_BOT_TOKEN=` にBotトークンを設定します。

```sh
sudo cp oiso-common-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oiso-common-relay
curl http://127.0.0.1:3000/health
```

`ok: true` と `discord: true` が返ることを確認します。失敗時は `sudo journalctl -u oiso-common-relay -n 50` で原因を確認します。

### HTTPS

所有するドメインの証明書を取得してから、`nginx.conf.example`のホスト名・証明書パスを実値へ変更し、Nginxへ配置します。
証明書のない状態ではテンプレートのまま起動できません。証明書の自動更新も設定してください。

```sh
sudo nginx -t
sudo systemctl reload nginx
curl https://実際のホスト名/health
```

テンプレートはペアリング発行を制限し、秘密情報を含むURLのアクセスログを無効にしています。
`relay-data`はPC接続用トークンを含むため、公開フォルダーに置かないでください。

## 4. PCとスマホをつなぐ

1. PCの `デスクトップ/OISO/oiso2/bridge/.env.example` を同じ場所の `.env` にコピー。
2. `COMMON_RELAY_URL=https://実際のホスト名` を設定。
3. 最初は `ANALYZER_MODE=mock`、`AUTO_ANALYZE=false` のままBridgeを再起動。
4. PC画面で「Discordとペアリング」を押し、表示されたコマンドを専用チャンネルへ送信。
5. 接続完了後にスマホ送信用QRを作成。スマホOISOの「PCへ送信（Relay）」で読み取ります。
6. スマホでレシートを撮影・保存し、「未送信の証憑を送る」を押します。
7. 送信成功はDiscordへの到着を意味します。PCで「受信箱を取り込む」を押し、画像を確認してください。
8. 「Bridgeで解析してCSVを返す」を押し、mockの空欄CSVが保存・返送されることを確認。

QRは10分間有効です。共通Relayでは同じPCの送信済み履歴を新しいQRへ引き継ぎます。再ペアリングは別のPC接続として扱われます。
送信途中で止まったら再送すると、そのQRで成功を記録した分を除いて再開します。応答が失われた場合は重複する可能性があるため、CSV確定前に確認してください。

## 5. 実際のAI解析へ切り替える

1. 利用者PCにCodex CLIを用意して、本人のアカウントでログイン。
2. PowerShellで `codex exec --help` が動くことを確認。
3. `.env` の `ANALYZER_MODE=codex` に変更してBridgeを再起動。
4. Windowsで `codex` が見つからない場合、`CODEX_COMMAND` に実行可能な `codex.exe` の絶対パスを設定。
5. 読めるレシート1枚で手動解析し、日付・店名・金額が合うことを確認。
6. 正常動作を確認後、必要であれば `AUTO_ANALYZE=true` にします。

Codexは利用者PCから起動しますが、AI推論が完全にPC内で行われるという意味ではありません。画像は利用するAIサービスへ送信されます。
公式: https://learn.chatgpt.com/docs/non-interactive-mode

## 完成確認

- スマホから撮影した1枚がPCへ届く。
- PC受信後にDiscordの元画像が削除される。
- 実解析のCSVを確認・修正して保存できる。
- 11枚以上の送信、途中失敗後の再送、QR期限切れを確認する。
- Oracle再起動後にBotが戻り、期限切れWebhookが削除される。
- サービス利用前に、Discord経由の一時配送とAIへの画像送信を利用者に説明する。

開発用回帰テストはプロジェクトの外側の `Okanjo` で `node --test Okanjo/tests/*.test.mjs` を実行します。
