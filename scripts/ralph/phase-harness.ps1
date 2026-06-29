#!/usr/bin/env pwsh
# phase-harness.ps1 — 策略分类 Phase 1→4 自动执行
# 在 ralph.ps1 基础上叠加 Phase 级别进度看板
# 用法: ./phase-harness.ps1 [-MaxIterations 80] [-MaxFailures 5] [-MaxAttempts 5]

param(
    [int]$MaxIterations = 80,
    [int]$MaxFailures   = 5,
    [int]$MaxAttempts   = 5
)

$ErrorActionPreference = "Stop"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8

# ─── 安全调用 ralph-core.mjs ───
function Invoke-Core {
    param([string[]]$Arguments)
    try   { $r = & node @Arguments 2>$null; return ($r -join "`n") }
    catch { return "" }
}

# ─── Phase 进度看板 ───
function Show-PhaseProgress {
    $prd = Get-Content (Join-Path $ScriptDir "prd.json") -Raw | ConvertFrom-Json

    $phaseNames = @{1="配置打通"; 2="死代码清理"; 3="诊断后端"; 4="回测参数UI"}

    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║       策略分类 Phase 1 → 4  进度追踪         ║" -ForegroundColor Cyan
    Write-Host "  ╠══════════════════════════════════════════════╣" -ForegroundColor Cyan

    foreach ($p in 1..4) {
        $stories = $prd.userStories | Where-Object { $_.phase -eq $p }
        $total   = if ($stories) { @($stories).Count } else { 0 }
        $done    = if ($stories) { @($stories | Where-Object { $_.passes -eq $true }).Count } else { 0 }

        if ($total -eq 0)        { continue }
        if ($done -eq $total)    { $icon = "✅"; $color = "Green"   }
        elseif ($done -gt 0)     { $icon = "🔄"; $color = "Yellow"  }
        else                     { $icon = "⏳"; $color = "DarkGray" }

        $filled = "█" * $done
        $empty  = "░" * ($total - $done)
        $bar    = ($filled + $empty).PadRight(9)
        $label  = $phaseNames[$p].PadRight(10)

        Write-Host ("  ║  Phase {0} {1}  {2}  [{3}]  {4}/{5}  ║" -f $p, $icon, $label, $bar, $done, $total) -ForegroundColor $color
    }

    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

# ─── 前置校验 ───
foreach ($f in @("prd.json","AGENT_PROMPT.md")) {
    if (-not (Test-Path (Join-Path $ScriptDir $f))) {
        Write-Error "Missing: $f"; exit 1
    }
}

# ─── 初始化 ───
$null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--init")
$null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--init-run")

$RemainingStr = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--remaining")
$Remaining    = if ($RemainingStr) { [int]($RemainingStr.Trim()) } else { 0 }

if ($Remaining -eq 0) {
    Write-Host "✅ 所有 Phase 1→4 故事已全部完成！"
    Show-PhaseProgress
    exit 0
}

$null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--archive")

Write-Host "Phase Harness 启动 — 剩余故事: $Remaining  最大迭代: $MaxIterations"
Show-PhaseProgress

# ─── 主循环 ───
for ($i = 1; $i -le $MaxIterations; $i++) {

    Write-Host "═══════════════════════════════════════════════════════"
    Write-Host "  Iteration $i / $MaxIterations   剩余: $Remaining"
    Write-Host "═══════════════════════════════════════════════════════"

    Set-Location $ProjectRoot

    # 1. 收敛检测
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--check-convergence", "$MaxFailures")
    if ($LASTEXITCODE -eq 3) { Write-Error "收敛检测触发，退出。"; exit 3 }

    # 2. Story 尝试次数限制
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--check-limits", "$MaxAttempts")
    if ($LASTEXITCODE -eq 9) { Write-Error "所有剩余 story 超限，退出。"; exit 9 }

    # 3. 迭代前状态快照
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--record-git-head")
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--snapshot-passes")

    # 4. 取下一个 story 并递增尝试计数
    $NextStory = (Invoke-Core @("$ScriptDir/ralph-core.mjs", "--get-next-story")).Trim()
    Write-Host "  → 下一个故事: $NextStory"
    if ($NextStory -and $NextStory -ne "NONE" -and -not $NextStory.StartsWith("BLOCKED:")) {
        $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--increment-story-attempt", "$NextStory")
    }

    # 5. 构建增强 Prompt
    $PromptFile = Join-Path $ScriptDir ".current-prompt.md"
    $Prompt = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--build-prompt", "$i")
    $Prompt | Out-File -FilePath $PromptFile -Encoding utf8

    $PreIterationHead = git rev-parse HEAD 2>$null

    # 6. 执行 Claude（流式）
    $OutputFile = Join-Path $ScriptDir ".last-output.txt"
    node "$ScriptDir/ralph-run.mjs" "$PromptFile" "$OutputFile"
    $ClaudeExit = $LASTEXITCODE

    # 7. 处理输出
    $Output = if (Test-Path $OutputFile) { Get-Content $OutputFile -Raw } else { "" }
    $Output | Out-File -FilePath (Join-Path $ScriptDir ".last-raw-output.txt") -Encoding utf8
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--record-error", "$i", "$ClaudeExit")

    # 8. Guardian 验证
    $Validation = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--validate-iteration")
    if ($Validation -match "^DENY:") {
        Write-Host "⛔ GUARDIAN REJECTED: $($Validation -replace '^DENY: ', '')" -ForegroundColor Red
        if ($PreIterationHead) {
            git reset --hard $PreIterationHead 2>$null
            git clean -fd -- scripts/ralph/ 2>$null
        }
    }

    $RemainingNowStr = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--remaining")
    $RemainingNow    = if ($RemainingNowStr) { [int]($RemainingNowStr.Trim()) } else { $Remaining }

    # 9. 完成信号
    if ($Output -match "<promise>COMPLETE</promise>") {
        $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--mark-complete")
        Show-PhaseProgress
        Write-Host "✅ 全部完成！(iteration $i)"
        exit 0
    }

    # 10. 更新进度 + 看板
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--update-progress", "$Remaining", "$RemainingNow")
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--check-git-progress")
    $Remaining = $RemainingNow

    Show-PhaseProgress

    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--record-changes")
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--append-log", "$i", "$ClaudeExit", "$Remaining", "$Output")

    Start-Sleep -Seconds 2
}

Write-Host "达到最大迭代次数($MaxIterations)，未完成所有故事。"
exit 1
