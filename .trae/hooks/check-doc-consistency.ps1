# Document consistency checker for QuantForge.
# Verifies AGENT.md existence (@include references in AGENTS.md) and
# README.md presence for each independently-developable subproject.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .trae/hooks/check-doc-consistency.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .trae/hooks/check-doc-consistency.ps1 -RepoRoot D:\quant-web
#
# Exit codes:
#   0 = all required docs present
#   1 = missing required docs (AGENT.md @include targets)
#   2 = missing recommended docs (subproject README.md)

param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

$ErrorActionPreference = "Stop"
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $script:failures.Add($Message) | Out-Null
}

function Add-Warning {
    param([string]$Message)
    $script:warnings.Add($Message) | Out-Null
}

function Test-RequiredPath {
    param(
        [string]$RelativePath,
        [string]$Description = $RelativePath
    )

    $fullPath = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        Add-Failure "Missing $Description at $RelativePath"
    }
}

function Test-RecommendedPath {
    param(
        [string]$RelativePath,
        [string]$Description = $RelativePath
    )

    $fullPath = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        Add-Warning "Missing recommended $Description at $RelativePath"
    }
}

# === 1. Root-level required docs ===
Test-RequiredPath "README.md" "root README"
Test-RequiredPath "AGENT.md" "root AGENT"
Test-RequiredPath "AGENTS.md" "root AGENTS"
Test-RequiredPath "CLAUDE.md" "root CLAUDE"
Test-RequiredPath "CHANGELOG.md" "root CHANGELOG"
Test-RequiredPath "docs/README.md" "docs entry"
Test-RequiredPath "docs/roadmap.md" "roadmap"
Test-RequiredPath "docs/dev-workflow.md" "dev workflow"

# === 2. Subproject AGENT.md (required, @include targets in AGENTS.md) ===
# These MUST exist because AGENTS.md uses <!-- @include: path --> to reference them.
$requiredAgentMd = @(
    "apps/web/AGENT.md",
    "apps/api/AGENT.md",
    "apps/worker/AGENT.md",
    "services/data-center/AGENT.md",
    "services/data-collector/AGENT.md",
    "packages/backtest-engine/AGENT.md",
    "packages/ai-engine/AGENT.md",
    "packages/strategy-runtime/AGENT.md",
    "packages/factor-lab/AGENT.md",
    "packages/strategies/AGENT.md",
    "packages/loop-engine/AGENT.md",
    "packages/obsidian-sync/AGENT.md",
    "packages/data-client/AGENT.md"
)

foreach ($agentMd in $requiredAgentMd) {
    Test-RequiredPath $agentMd "subproject AGENT.md (referenced by AGENTS.md @include)"
}

# === 3. Subproject README.md (recommended by AGENTS.md role rule) ===
# AGENTS.md says: "每个可独立开发子项目必须维护自己的 README.md 和 AGENT.md"
# But some Python packages (backtest-engine/ai-engine/factor-lab/strategies/loop-engine)
# currently lack README.md — report as warning, not failure, to allow incremental adoption.
$recommendedReadmeMd = @(
    "apps/web/README.md",
    "apps/api/README.md",
    "apps/worker/README.md",
    "services/data-center/README.md",
    "services/data-collector/README.md",
    "packages/strategy-runtime/README.md",
    "packages/backtest-engine/README.md",
    "packages/ai-engine/README.md",
    "packages/factor-lab/README.md",
    "packages/strategies/README.md",
    "packages/loop-engine/README.md",
    "packages/obsidian-sync/README.md",
    "packages/data-client/README.md"
)

foreach ($readmeMd in $recommendedReadmeMd) {
    Test-RecommendedPath $readmeMd "subproject README.md"
}

# === 4. Trae runtime docs ===
Test-RequiredPath ".trae/rules/quant-web-workflow.md" "quant-web-workflow rule"
Test-RequiredPath ".trae/rules/superpowers.md" "superpowers rule"
Test-RequiredPath ".trae/hooks.json" "hooks config"
Test-RequiredPath ".trae/changelog-pending.md" "changelog pending"

# === 5. Verify @include references in AGENTS.md point to existing files ===
$agentsMdPath = Join-Path $RepoRoot "AGENTS.md"
if (Test-Path -LiteralPath $agentsMdPath) {
    $agentsContent = Get-Content -LiteralPath $agentsMdPath -Raw -Encoding UTF8
    $includePattern = [regex]'<!--\s*@include:\s*([^>\s]+)\s*-->'
    $matches = $includePattern.Matches($agentsContent)
    foreach ($match in $matches) {
        $includedPath = $match.Groups[1].Value.Trim()
        $fullPath = Join-Path $RepoRoot $includedPath
        if (-not (Test-Path -LiteralPath $fullPath)) {
            Add-Failure "AGENTS.md @include references non-existent file: $includedPath"
        }
    }
}

# === Output ===
if ($warnings.Count -gt 0) {
    Write-Output "Document consistency warnings:"
    foreach ($warning in $warnings) {
        Write-Output "  [WARN] $warning"
    }
    Write-Output ""
}

if ($failures.Count -gt 0) {
    Write-Output "Document consistency check FAILED:"
    foreach ($failure in $failures) {
        Write-Output "  [FAIL] $failure"
    }
    Write-Output ""
    Write-Output "Required docs missing. Fix these before proceeding."
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Output "Required docs OK. $([string]$warnings.Count) recommended README.md missing (warnings only)."
    exit 2
}

Write-Output "Document consistency check passed."
Write-Output "Checked root docs, $($requiredAgentMd.Count) subproject AGENT.md, $($recommendedReadmeMd.Count) subproject README.md, Trae runtime docs, and AGENTS.md @include references."
exit 0
