$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'bridge')
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.jsをインストールしてから、もう一度起動してください。' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw '必要なライブラリを取得できませんでした。ネット接続を確認してください。' }
}
Write-Host 'OISO2を起動します。ブラウザで http://127.0.0.1:8788/ を開いてください。'
Write-Host '終了するときは Ctrl+C を押してください。'
node index.mjs
