#requires -Version 5.1
<#
backup_project.ps1 — LIGA35-DEV (liga35-admin)
- Cria backup .zip em .\backups com timestamp
- Exclui pastas grandes/irrelevantes (node_modules, dist, build, .git, backups, etc.)
- Gera manifest .txt com contagem de arquivos e tamanho total
- Verifica balanceamento de @layer (Tailwind) nos .css
- Suporta -WhatIf (simulação)
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$ProjectRoot = ".",
  [string]$BackupDir = "backups",
  [string]$Prefix = "liga35-admin",
  [switch]$IncludeNodeModules,
  [switch]$SkipLayerCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$p) {
  return (Resolve-Path -LiteralPath $p).Path
}

function Ensure-Directory([string]$dir) {
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
}

function Get-Timestamp() {
  return (Get-Date).ToString("yyyyMMdd_HHmmss")
}

function Test-LayerBalanceInFile([string]$filePath) {
  # Verifica se cada "@layer X {" tem um "}" correspondente (heurística simples, mas efetiva)
  # Só roda em .css
  $text = Get-Content -LiteralPath $filePath -Raw -ErrorAction Stop

  if ($text -notmatch "@layer") { return $true }

  $lines = $text -split "`r?`n"
  $stack = New-Object System.Collections.Generic.Stack[string]

  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]

    # captura "@layer base {" / "@layer components{" / "@layer utilities {"
    if ($line -match "^\s*@layer\s+([a-zA-Z0-9_-]+)\s*\{") {
      $layerName = $Matches[1]
      $stack.Push($layerName)
      continue
    }

    # conta chaves (mas só quando tem layer ativo)
    if ($stack.Count -gt 0) {
      # pode haver várias chaves na mesma linha
      $opens  = ([regex]::Matches($line, "\{")).Count
      $closes = ([regex]::Matches($line, "\}")).Count

      # O "{“ do @layer já foi contabilizado ao dar Push, então aqui consideramos os demais
      # Para evitar dupla-contagem, subtrai 1 abertura se a linha do @layer também tiver sido capturada (já tratamos acima)
      # Neste ponto, não é a linha do @layer, então é safe.

      # Ajusta stack com fechamentos quando achar que encerrou o bloco principal do layer:
      # Heurística: quando aparecem "}" e estamos dentro de layer, vamos “consumir” 1 fechamento por vez
      for ($c = 0; $c -lt $closes; $c++) {
        if ($stack.Count -gt 0) { [void]$stack.Pop() }
      }
    }
  }

  return ($stack.Count -eq 0)
}

function Assert-LayerBalance([string]$rootPath) {
  $cssFiles = Get-ChildItem -LiteralPath $rootPath -Recurse -File -Filter "*.css" -ErrorAction Stop
  $bad = @()

  foreach ($f in $cssFiles) {
    if (-not (Test-LayerBalanceInFile -filePath $f.FullName)) {
      $bad += $f.FullName
    }
  }

  if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host "ERRO: Encontrado @layer desbalanceado em:" -ForegroundColor Red
    $bad | ForEach-Object { Write-Host (" - " + $_) -ForegroundColor Red }
    Write-Host ""
    throw "Falha na verificação de @layer. Corrija os arquivos CSS acima antes de gerar backup."
  }
}

function Should-ExcludePath([string]$fullPath, [string]$rootFullPath, [string[]]$excludeDirs) {
  # exclui se qualquer segmento bater com excludeDirs (comparação por pasta)
  $rel = $fullPath.Substring($rootFullPath.Length).TrimStart('\')
  if ([string]::IsNullOrWhiteSpace($rel)) { return $false }

  $parts = $rel -split "\\"
  foreach ($p in $parts) {
    foreach ($ex in $excludeDirs) {
      if ($p -ieq $ex) { return $true }
    }
  }
  return $false
}

try {
  $rootFull = Resolve-FullPath $ProjectRoot
  $backupFull = Join-Path $rootFull $BackupDir
  Ensure-Directory $backupFull

  if (-not $SkipLayerCheck) {
    Assert-LayerBalance -rootPath $rootFull
  }

  $ts = Get-Timestamp
  $zipName = "{0}_{1}.zip" -f $Prefix, $ts
  $zipPath = Join-Path $backupFull $zipName

  $manifestName = "{0}_{1}_manifest.txt" -f $Prefix, $ts
  $manifestPath = Join-Path $backupFull $manifestName

  $exclude = @(
    ".git",
    "node_modules",
    "dist",
    "build",
    ".vite",
    ".turbo",
    ".next",
    "coverage",
    "backups",
    ".cache",
    ".parcel-cache",
    "tmp",
    "temp"
  )

  if ($IncludeNodeModules) {
    $exclude = $exclude | Where-Object { $_ -ine "node_modules" }
  }

  # Coleta arquivos para backup
  $allFiles = Get-ChildItem -LiteralPath $rootFull -Recurse -File -Force -ErrorAction Stop

  $files = New-Object System.Collections.Generic.List[System.IO.FileInfo]
  foreach ($f in $allFiles) {
    if (-not (Should-ExcludePath -fullPath $f.FullName -rootFullPath $rootFull -excludeDirs $exclude)) {
      $files.Add($f) | Out-Null
    }
  }

  if ($files.Count -eq 0) {
    throw "Nenhum arquivo encontrado para backup (após exclusões)."
  }

  $totalBytes = 0L
  foreach ($f in $files) { $totalBytes += $f.Length }

  $summary = @()
  $summary += "ProjectRoot : $rootFull"
  $summary += "BackupDir   : $backupFull"
  $summary += "Timestamp   : $ts"
  $summary += "ZipFile     : $zipPath"
  $summary += "Files       : $($files.Count)"
  $summary += "TotalBytes  : $totalBytes"
  $summary += "ExcludedDirs: $($exclude -join ', ')"
  $summary += ""

  # Monta staging temporário para zip sem depender do Compress-Archive aceitar lista de paths com raiz variável
  $stage = Join-Path $backupFull ("_stage_{0}" -f $ts)

  if ($PSCmdlet.ShouldProcess($zipPath, "Create backup zip")) {

    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    New-Item -ItemType Directory -Path $stage | Out-Null

    foreach ($f in $files) {
      $rel = $f.FullName.Substring($rootFull.Length).TrimStart('\')
      $dest = Join-Path $stage $rel
      $destDir = Split-Path -Parent $dest
      if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      }
      Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
    }

    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -Force

    # Manifest
    $summary += "---- FILE LIST (relative) ----"
    foreach ($f in $files) {
      $rel = $f.FullName.Substring($rootFull.Length).TrimStart('\')
      $summary += $rel
    }

    # Grava manifest UTF-8 sem BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($manifestPath, $summary, $utf8NoBom)

    # limpa staging
    Remove-Item -LiteralPath $stage -Recurse -Force

    Write-Host ("OK: Backup criado: {0}" -f $zipPath) -ForegroundColor Green
    Write-Host ("OK: Manifest:     {0}" -f $manifestPath) -ForegroundColor Green
  }
  else {
    # WhatIf: apenas reporta
    Write-Host ("WHATIF: Criaria ZIP em: {0}" -f $zipPath) -ForegroundColor Cyan
    Write-Host ("WHATIF: Criaria manifest em: {0}" -f $manifestPath) -ForegroundColor Cyan
    Write-Host ("WHATIF: Arquivos incluídos: {0} (bytes: {1})" -f $files.Count, $totalBytes) -ForegroundColor Cyan
  }
}
catch {
  Write-Host ("ERRO: {0}" -f $_.Exception.Message) -ForegroundColor Red
  throw
}