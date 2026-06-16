# Start backend + frontend for local development
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting backend on http://localhost:5000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; node src/server.js"

Start-Sleep -Seconds 2

Write-Host "Starting frontend on http://localhost:3001 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; `$env:PORT='3001'; `$env:BROWSER='none'; npm start"

Write-Host ""
Write-Host "Open in your browser (Chrome or Edge): http://localhost:3001"
Write-Host "API: http://localhost:5000/api/health"
Write-Host "Do not use Cursor Simple Browser preview if you see chrome-error iframe errors."
