# Quick test to check if backend is using MongoDB
# Usage: .\scripts\test-db-connection.ps1

$baseUrl = "http://localhost:4000"

Write-Host "`n🔍 Testing Backend Database Configuration...`n" -ForegroundColor Cyan

# Test Health Endpoint (no auth required)
Write-Host "1. Checking /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
    $health = $response.Content | ConvertFrom-Json
    
    Write-Host "   Database Provider: $($health.database.provider)" -ForegroundColor $(if ($health.database.provider -eq 'mongodb') { 'Green' } else { 'Red' })
    Write-Host "   Database Connected: $($health.database.connected)" -ForegroundColor $(if ($health.database.connected) { 'Green' } else { 'Red' })
    
    if ($health.database.provider -eq 'mongodb' -and $health.database.connected) {
        Write-Host "   ✅ Backend is using MongoDB!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Backend is NOT using MongoDB!" -ForegroundColor Red
        Write-Host "   Action: Set DB_PROVIDER=mongodb in .env and restart server" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Is the backend server running on port 4000?" -ForegroundColor Yellow
}

Write-Host "`n✅ Test complete!`n" -ForegroundColor Cyan

