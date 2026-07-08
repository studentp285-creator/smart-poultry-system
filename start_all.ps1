# Smart Poultry Monitor - Start All Services
$PYTHON = "C:\Users\KACHA\AppData\Local\Programs\Python\Python313\python.exe"

Write-Host "Starting Smart Poultry Monitor..." -ForegroundColor Green

# Start Django backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PYTHONUTF8='1'; cd '$PSScriptRoot\backend'; & '$PYTHON' manage.py runserver 0.0.0.0:8000"

# Wait for backend to boot
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Seed sample data
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/readings/seed/" -Method POST | Out-Null
    Write-Host "Sample data seeded OK" -ForegroundColor Green
} catch {
    Write-Host "Could not seed data (backend may still be starting - this is OK)" -ForegroundColor Yellow
}

# Start React frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "Services starting in separate windows:" -ForegroundColor Cyan
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Open http://localhost:5173 in your browser" -ForegroundColor Green
