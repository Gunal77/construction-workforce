# PowerShell script to test API endpoints
# Usage: .\scripts\test-api-endpoints.ps1

$baseUrl = "http://localhost:4000"
$token = "YOUR_TOKEN_HERE"  # Replace with actual token

Write-Host "`n🧪 Testing API Endpoints...`n" -ForegroundColor Cyan

# Test Employees Endpoint
Write-Host "1. Testing /api/admin/employees..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/employees" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -ErrorAction Stop
    
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Found $($data.employees.Count) employees" -ForegroundColor Green
    if ($data.employees.Count -gt 0) {
        Write-Host "   Sample: $($data.employees[0].name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}

# Test Projects Endpoint
Write-Host "`n2. Testing /api/admin/projects..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/projects" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -ErrorAction Stop
    
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Found $($data.projects.Count) projects" -ForegroundColor Green
    if ($data.projects.Count -gt 0) {
        Write-Host "   Sample: $($data.projects[0].name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Supervisors Endpoint
Write-Host "`n3. Testing /api/admin/supervisors..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/supervisors" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        } `
        -ErrorAction Stop
    
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Success! Found $($data.supervisors.Count) supervisors" -ForegroundColor Green
    if ($data.supervisors.Count -gt 0) {
        Write-Host "   Sample: $($data.supervisors[0].name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Testing complete!`n" -ForegroundColor Cyan

