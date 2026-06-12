param(
  [string]$DatabaseUrl
)

if (-not $DatabaseUrl) {
  Write-Error "Pass Railway DATABASE_URL like: .\seed-railway-admin.ps1 -DatabaseUrl `"postgresql://...`""
  exit 1
}

$env:DATABASE_URL = $DatabaseUrl

Write-Host "Seeding Railway admin user..." -ForegroundColor Cyan

npx prisma migrate deploy
npx tsx scripts/seed-admin.ts

Write-Host "Done. Try login: admin@schoolconnect.test / password123" -ForegroundColor Green