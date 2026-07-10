<#
.SYNOPSIS
QuantWeb pre-start environment check

.DESCRIPTION
Detects common startup blockers:
  1. better-sqlite3 native module ABI mismatch
  2. quantforge-* Python packages missing (editable install)
  3. API(3002) / Web(4173) ports occupied

.PARAMETER Fix
Attempt auto-fix (rebuild better-sqlite3, install missing Python packages).

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -Fix
#>
param([switch]$Fix)

$ErrorActionPreference = 'Continue'
$root = (Resolve-Path "$PSScriptRoot/..").Path
$script:issues = @()

function Write-Step($msg) { Write-Host "`n[$msg]" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK   $msg" -ForegroundColor Green }
function Write-Bad($msg)  { Write-Host "  FAIL $msg" -ForegroundColor Red }
function Write-Tip($msg)  { Write-Host "  ->   $msg" -ForegroundColor Yellow }

# ── 1. Node ───────────────────────────────────────────────────
Write-Step 'Node'
$nodeVer = (node -v 2>$null)
if (-not $nodeVer) {
  Write-Bad 'node not found. Install Node.js first.'
  exit 1
}
$abi = node -e "console.log(process.versions.modules)"
Write-Ok "Node $nodeVer (ABI $abi)"

# ── 2. better-sqlite3 native module ───────────────────────────
Write-Step 'better-sqlite3'
$apiDir = Join-Path $root 'apps/api'
Push-Location $apiDir
$bsqlTest = node -e "try{const D=require('better-sqlite3');const db=new D(':memory:');db.close();console.log('OK')}catch(e){console.log('FAIL|'+e.message)}" 2>&1
Pop-Location

if ($bsqlTest -eq 'OK') {
  Write-Ok 'native module loads correctly'
} else {
  $script:issues += 'better-sqlite3'
  $parts = $bsqlTest -split '\|'
  $detail = if ($parts.Count -gt 1) { $parts[1] } else { $bsqlTest }
  Write-Bad 'native module failed to load'
  if ($detail -match 'NODE_MODULE_VERSION') {
    Write-Tip 'ABI mismatch: module compiled for older Node. Rebuild required.'
  } else {
    Write-Tip $detail
  }
  if ($Fix) {
    Write-Host '  fixing: pnpm rebuild better-sqlite3 ...' -ForegroundColor Yellow
    pnpm rebuild better-sqlite3 2>&1 | Out-Host
    Push-Location $apiDir
    $recheck = node -e "try{require('better-sqlite3');console.log('OK')}catch(e){console.log('FAIL')}" 2>&1
    Pop-Location
    if ($recheck -eq 'OK') { Write-Ok 'better-sqlite3 fixed' } else { Write-Bad 'pnpm rebuild did not work. Use node-gyp rebuild manually (see docs/startup-troubleshooting.md).' }
  } else {
    Write-Tip 'fix: pnpm rebuild better-sqlite3  (or run with -Fix)'
  }
}

# ── 3. Python quantforge packages ─────────────────────────────
Write-Step 'Python quantforge packages'
$pyPackages = [ordered]@{
  'quantforge-ai'         = 'packages/ai-engine'
  'quantforge-algorithms' = 'packages/algorithms'
  'quantforge-loop'       = 'packages/loop-engine'
  'quantforge-obsidian'   = 'packages/obsidian-sync'
  'quantforge-strategy'   = 'packages/strategy-runtime'
  'quantforge-strategies' = 'packages/strategies'
}
$missingPy = @()
foreach ($pkg in $pyPackages.Keys) {
  $path = $pyPackages[$pkg]
  $r = python -m pip show $pkg 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok $pkg
  } else {
    $script:issues += $pkg
    $missingPy += @{ Name = $pkg; Path = $path }
    Write-Bad "$pkg NOT installed"
  }
}
if ($missingPy.Count -gt 0 -and $Fix) {
  Write-Host '  fixing: installing missing packages ...' -ForegroundColor Yellow
  foreach ($m in $missingPy) {
    $target = Join-Path $root $m.Path
    Write-Host "    pip install -e $target" -ForegroundColor Yellow
    python -m pip install -e $target 2>&1 | Out-Host
  }
} elseif ($missingPy.Count -gt 0) {
  Write-Tip 'fix: python -m pip install -e <package-path>  (or run with -Fix)'
}

# ── 4. Ports ──────────────────────────────────────────────────
Write-Step 'Ports'
$ports = @{ 3002 = 'API'; 4173 = 'Web (Vite)' }
foreach ($port in ($ports.Keys | Sort-Object)) {
  $label = $ports[$port]
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    $procName = if ($proc) { $proc.ProcessName } else { 'unknown' }
    Write-Bad "port $port ($label) in use - PID $($conn.OwningProcess) ($procName)"
    Write-Tip "release: Stop-Process -Id $($conn.OwningProcess) -Force"
  } else {
    Write-Ok "port $port ($label) free"
  }
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ''
if ($script:issues.Count -eq 0) {
  Write-Host 'Environment check passed. Ready to start services.' -ForegroundColor Green
  exit 0
} else {
  Write-Host "Found $($script:issues.Count) issue(s): $($script:issues -join ', ')" -ForegroundColor Red
  Write-Host 'See docs/startup-troubleshooting.md for details.' -ForegroundColor Yellow
  if (-not $Fix) { Write-Host 'Run with -Fix to auto-fix some issues.' -ForegroundColor Yellow }
  exit 1
}
