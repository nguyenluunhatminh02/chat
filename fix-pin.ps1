# Fix Pin Errors - Automated Script
Write-Host "🔧 Fixing Pin Errors..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Backend
Write-Host "Step 1: Stopping backend processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "✅ Backend stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Regenerate Prisma Client
Write-Host "Step 2: Regenerating Prisma client..." -ForegroundColor Yellow
Set-Location backend
& npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma client regenerated" -ForegroundColor Green
} else {
    Write-Host "❌ Prisma generate failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Verify Ban Model
Write-Host "Step 3: Verifying Ban model..." -ForegroundColor Yellow
$banExists = Select-String -Path "generated\prisma\index.d.ts" -Pattern "export type Ban" -Quiet
if ($banExists) {
    Write-Host "✅ Ban model exists in Prisma client" -ForegroundColor Green
} else {
    Write-Host "⚠️  Ban model not found (might be cached)" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Start Backend
Write-Host "Step 4: Starting backend..." -ForegroundColor Yellow
Write-Host "Running: npm run start:dev" -ForegroundColor Gray
Write-Host ""
& npm run start:dev

# Note: Backend will run in this terminal
# Open a new terminal to test frontend
