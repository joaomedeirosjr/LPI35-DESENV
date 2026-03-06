# patch_admin_rounds_guests.ps1
# Objetivo:
# - Restaurar AdminRounds.tsx (opcional) e aplicar patch "ensureGuestsForStageRoster"
# - Injetar chamadas dentro de genAutofillGuestsForGroup
# - Evitar mojibake: escrita em UTF-8 (sem BOM) e patch deterministico

param(
  [switch]$RestoreFromGit = $true
)

$ErrorActionPreference = "Stop"

function WriteUtf8NoBom([string]$Path, [string]$Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = Join-Path $repoRoot "src\pages\admin\AdminRounds.tsx"

if (!(Test-Path $target)) {
  throw "Arquivo nao encontrado: $target"
}

Push-Location $repoRoot
try {
  if ($RestoreFromGit) {
    Write-Host ">> Restaurando AdminRounds.tsx do HEAD..." -ForegroundColor Cyan
    git restore $target | Out-Null
  }

  # Backup com timestamp
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $backupDir = Join-Path $repoRoot "backups"
  if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
  $backup = Join-Path $backupDir ("AdminRounds.tsx.bak_" + $ts)
  Copy-Item -Path $target -Destination $backup -Force
  Write-Host ">> Backup criado: $backup" -ForegroundColor Green

  $content = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)

  # 1) Injetar helper function se ainda nao existir
  if ($content -match "async function ensureGuestsForStageRoster\(") {
    Write-Host ">> ensureGuestsForStageRoster ja existe. Pulando injecao da funcao." -ForegroundColor Yellow
  } else {
    $needle = "async function clearPairsForGroup"
    $idx = $content.IndexOf($needle)
    if ($idx -lt 0) {
      throw "Nao achei o ponto de injecao: '$needle' (AdminRounds.tsx mudou?)."
    }

    # Encontrar o final do bloco clearPairsForGroup (primeira ocorrencia)
    # Vamos localizar a chave '}' que fecha essa funcao, de forma simples por contagem de braces a partir do 'async function clearPairsForGroup'
    $start = $idx
    $braceStart = $content.IndexOf("{", $start)
    if ($braceStart -lt 0) { throw "Nao encontrei '{' apos clearPairsForGroup." }

    $depth = 0
    $pos = $braceStart
    while ($pos -lt $content.Length) {
      $ch = $content[$pos]
      if ($ch -eq "{") { $depth++ }
      elseif ($ch -eq "}") {
        $depth--
        if ($depth -eq 0) { break }
      }
      $pos++
    }
    if ($depth -ne 0) { throw "Falha ao localizar o fim de clearPairsForGroup (braces desbalanceados)." }

    $afterClearFnEnd = $pos + 1

    $injectFn = @"
  
  async function ensureGuestsForStageRoster(pStageId: number, pCategory?: string) {
    const cat = (pCategory ?? "").toUpperCase().trim()

    let q = supabase
      .from("stage_roster")
      .select("guest_id, category")
      .eq("stage_id", pStageId)
      .eq("kind", "guest")
      .not("guest_id", "is", null)

    if (cat) q = q.eq("category", cat)

    const { data: rosterRows, error: rosterErr } = await q
    if (rosterErr) throw rosterErr

    const rosterIds = Array.from(
      new Set(
        (rosterRows || [])
          .map((r: any) => r?.guest_id)
          .filter((x: any) => typeof x === "string" && x.length > 0)
      )
    ) as string[]

    if (rosterIds.length === 0) return 0

    const { data: existing, error: exErr } = await supabase
      .from("guests")
      .select("id")
      .eq("stage_id", pStageId)
      .in("id", rosterIds)

    if (exErr) throw exErr

    const existingSet = new Set((existing || []).map((r: any) => String(r.id)))
    const missing = rosterIds.filter((id) => !existingSet.has(id))
    if (missing.length === 0) return 0

    const payload = missing.map((id) => ({
      id,
      stage_id: pStageId,
      name: null,
      birth_date: null,
      is_pending: true,
    }))

    const { error: insErr } = await supabase.from("guests").insert(payload)
    if (insErr) throw insErr

    return missing.length
  }

"@

    $content = $content.Substring(0, $afterClearFnEnd) + $injectFn + $content.Substring($afterClearFnEnd)
    Write-Host ">> Funcao ensureGuestsForStageRoster injetada." -ForegroundColor Green
  }

  # 2) Injetar chamadas dentro de genAutofillGuestsForGroup
  $genNeedle = "async function genAutofillGuestsForGroup"
  $gidx = $content.IndexOf($genNeedle)
  if ($gidx -lt 0) {
    throw "Nao achei a funcao genAutofillGuestsForGroup."
  }

  # Vamos injetar 'await ensureGuestsForStageRoster(stageId, aCat)' logo apos o bloco de RPC do needA
  # E idem needB.

  $patternA = 'if\s*\(needA\s*>\s*0\)\s*\{\s*[\s\S]*?supabase\.rpc\("admin_add_stage_roster_guests"[\s\S]*?\)\s*[\s\S]*?if\s*\(error\)\s*throw\s*error\s*;?'
  $patternB = 'if\s*\(needB\s*>\s*0\)\s*\{\s*[\s\S]*?supabase\.rpc\("admin_add_stage_roster_guests"[\s\S]*?\)\s*[\s\S]*?if\s*\(error\)\s*throw\s*error\s*;?'

  $rxA = New-Object System.Text.RegularExpressions.Regex($patternA)
  $rxB = New-Object System.Text.RegularExpressions.Regex($patternB)

  $mA = $rxA.Match($content, $gidx)
  if (!$mA.Success) {
    throw "Nao consegui localizar o bloco needA dentro de genAutofillGuestsForGroup (padrao mudou)."
  }
  if ($mA.Value -notmatch "ensureGuestsForStageRoster") {
    $repA = $mA.Value + "`n`n      await ensureGuestsForStageRoster(stageId, aCat)"
    $content = $content.Substring(0, $mA.Index) + $repA + $content.Substring($mA.Index + $mA.Length)
    Write-Host ">> Injetei ensureGuestsForStageRoster no bloco needA." -ForegroundColor Green
  } else {
    Write-Host ">> Bloco needA ja contem ensureGuestsForStageRoster. Pulando." -ForegroundColor Yellow
  }

  # Recalcular indice de busca do bloco B (conteudo mudou)
  $gidx2 = $content.IndexOf($genNeedle)
  $mB = $rxB.Match($content, $gidx2)
  if (!$mB.Success) {
    throw "Nao consegui localizar o bloco needB dentro de genAutofillGuestsForGroup (padrao mudou)."
  }
  if ($mB.Value -notmatch "ensureGuestsForStageRoster") {
    $repB = $mB.Value + "`n`n      await ensureGuestsForStageRoster(stageId, bCat)"
    $content = $content.Substring(0, $mB.Index) + $repB + $content.Substring($mB.Index + $mB.Length)
    Write-Host ">> Injetei ensureGuestsForStageRoster no bloco needB." -ForegroundColor Green
  } else {
    Write-Host ">> Bloco needB ja contem ensureGuestsForStageRoster. Pulando." -ForegroundColor Yellow
  }

  # 3) Salvar em UTF-8 sem BOM
  WriteUtf8NoBom -Path $target -Content $content
  Write-Host ">> Patch aplicado com sucesso em: $target" -ForegroundColor Cyan

  # 4) Sanity checks
  $final = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)
  if ($final -notmatch "async function ensureGuestsForStageRoster\(") { throw "Sanity fail: funcao nao encontrada apos patch." }
  if ($final -notmatch "await ensureGuestsForStageRoster\(stageId, aCat\)") { throw "Sanity fail: injecao needA nao encontrada." }
  if ($final -notmatch "await ensureGuestsForStageRoster\(stageId, bCat\)") { throw "Sanity fail: injecao needB nao encontrada." }

  Write-Host ">> OK: sanity checks passaram." -ForegroundColor Green

} finally {
  Pop-Location
}