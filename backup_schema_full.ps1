param(
  [string]$PgDumpPath = "C:\Users\joao\scoop\apps\postgresql\current\bin\pg_dump.exe",
  [string]$OutputDir  = "C:\Projetos\LIGA35-DEV\liga35-admin\backups"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Ensure-Dir([string]$Path) {
  if (!(Test-Path $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function UriEncode([string]$s) {
  return [System.Uri]::EscapeDataString($s)
}

function Build-ConnectionString([string]$DbHost, [string]$DbName, [string]$DbUser, [string]$DbPass, [int]$Port = 5432) {
  $u = UriEncode $DbUser
  $p = UriEncode $DbPass
  return "postgresql://$u`:$p@$DbHost`:$Port/$DbName"
}

if (!(Test-Path $PgDumpPath)) {
  throw "pg_dump não encontrado em: $PgDumpPath"
}

Ensure-Dir $OutputDir

Write-Host "=== Backup Schema (Supabase) ===" -ForegroundColor Cyan

$dbHost = Read-Host "Host (ex.: db.xxxxx.supabase.co)"
$dbName = Read-Host "Database (ex.: postgres)"
$dbUser = Read-Host "User (ex.: postgres)"
$dbPassSecure = Read-Host -AsSecureString "Password (não aparece ao digitar)"

# converter SecureString -> string (somente em memória)
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassSecure)
try {
  $dbPassPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
} finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

$conn = Build-ConnectionString -DbHost $dbHost -DbName $dbName -DbUser $dbUser -DbPass $dbPassPlain -Port 5432

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile   = Join-Path $OutputDir "schema_full_$timestamp.sql"

Write-Host "[INFO] Gerando: $outFile" -ForegroundColor Yellow

& $PgDumpPath `
  --schema=public `
  --no-owner `
  --no-privileges `
  --format=plain `
  --dbname="$conn" `
  --file="$outFile"

if (!(Test-Path $outFile)) {
  throw "Falhou: arquivo não foi gerado."
}

Write-Host "[OK] Schema exportado: $outFile" -ForegroundColor Green