$ErrorActionPreference = 'Stop'
try {
    $running = $false
    try { $health = Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 2; $running = $health.ok -eq $true } catch { }
    if (-not $running) {
        $node = Get-Command node -ErrorAction SilentlyContinue
        if ($null -eq $node) { throw '初回準備が必要です。Node.jsをインストールしてから、もう一度開いてください。https://nodejs.org/ja' }
        $bridgeDirectory = Join-Path $PSScriptRoot 'bridge'
        if (-not (Test-Path -LiteralPath (Join-Path $bridgeDirectory 'node_modules/selfsigned'))) {
            Write-Host '初回の準備をしています。完了までお待ちください。'
            Push-Location $bridgeDirectory
            try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw '初回準備が完了しませんでした。インターネット接続を確認してください。' } } finally { Pop-Location }
        }
        $data = Join-Path $bridgeDirectory 'bridge-data'
        New-Item -ItemType Directory -Path $data -Force | Out-Null
        $server = Join-Path $bridgeDirectory 'index.mjs'
        $process = Start-Process -FilePath $node.Source -ArgumentList ('"' + $server + '"') -WorkingDirectory $bridgeDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'startup.log') -RedirectStandardError (Join-Path $data 'startup-error.log') -PassThru
        Write-Host 'Oaisoを起動しています。画面が開くまでお待ちください。'
        for ($attempt=0; $attempt -lt 120; $attempt++) {
            Start-Sleep -Milliseconds 500
            try { $health = Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 1; if ($health.ok) { $running=$true; break } } catch { }
            if ($process.HasExited) { break }
        }
        if (-not $running) { if (-not $process.HasExited) { Stop-Process -Id $process.Id }; throw '起動できませんでした。開発担当者に bridge/bridge-data/startup-error.log を見せてください。' }
    }
    Start-Process 'http://127.0.0.1:8788/'
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }
