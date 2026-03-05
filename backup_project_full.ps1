param(
  [string]$ProjectRoot = "C:\Projetos\LIGA35-DEV\liga35-admin",
  [string]$OutputDir = "C:\Projetos\LIGA35-DEV\liga35-admin\backups"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipFile = Join-Path $OutputDir "LIGA35_FULL_$timestamp.zip"

$exclude = @(
  "node_modules",
  "dist",
  ".git",
  "backups"
)

$items = Get-ChildItem $ProjectRoot -Recurse | Where-Object {
  $path = $_.FullName
  foreach ($ex in $exclude) {
    if ($path -like "*\$ex*") { return $false }
  }
  return $true
}

Compress-Archive -Path $items.FullName -DestinationPath $zipFile -Force

Write-Host "[OK] Backup completo criado: $zipFile" -ForegroundColor Green