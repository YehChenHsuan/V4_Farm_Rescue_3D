$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) { & $pythonCommand.Source -m http.server 8764 --bind 127.0.0.1 }
elseif (Test-Path -LiteralPath 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe') { & 'C:\Users\LENOVO\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8764 --bind 127.0.0.1 }
else { Write-Host '需要 Python 3，或以任何靜態網站伺服器開啟此資料夾。'; Read-Host '按 Enter 結束' }
