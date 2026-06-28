#!/usr/bin/env pwsh
# Ralph - 自治 AI Agent 循环脚本（PowerShell 包装层）
# 用法: ./ralph.ps1 [--Tool claude] [-MaxIterations 50] [-MaxFailures 5] [-MaxAttempts 5]
# 依赖: claude CLI, git, node
#
# 核心逻辑在 ralph-core.mjs 中实现，本文件只负责：
# 1. 参数解析
# 2. 循环调用 claude CLI
# 3. 将输出传递给 core 记录

param(
    [string]$Tool = "claude",
    [int]$MaxIterations = 50,
    [int]$MaxFailures = 5,
    [int]$MaxAttempts = 5
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")

# ─── UTF-8 编码设置 ───
# Claude CLI 输出 UTF-8 中文，PowerShell 5.x 控制台默认 GBK，导致乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ─── 安全执行 node 命令的辅助函数 ───
# 解决 $ErrorActionPreference = "Stop" 与 2>$null 的冲突：
# PS 5.x 中 native command 写 stderr 会在 redirect 生效前抛 NativeCommandError，
# 导致变量为 null。用 try/catch 包装，stderr 输出被忽略，返回 stdout 或空字符串。
function Invoke-Core {
    param([string[]]$Arguments)
    try {
        $result = & node @Arguments 2>$null
        return ($result -join "`n")
    } catch {
        return ""
    }
}

# ─── 前置校验 ───

if ($Tool -ne "claude") {
    Write-Error "Error: Invalid tool '$Tool'. Must be 'claude'."
    exit 1
}

$PrdFile = Join-Path $ScriptDir "prd.json"
$PromptFile = Join-Path $ScriptDir "AGENT_PROMPT.md"

if (-not (Test-Path $PrdFile)) {
    Write-Error "Error: prd.json not found at $PrdFile"
    exit 1
}
if (-not (Test-Path $PromptFile)) {
    Write-Error "Error: AGENT_PROMPT.md not found at $PromptFile"
    exit 1
}

# ─── 初始化状态 & 引擎 ───

$null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--init")
$null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--init-run")

# ─── 检查剩余故事 ───

$RemainingStr = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--remaining")
$Remaining = if ($RemainingStr) { [int]($RemainingStr.Trim()) } else { 0 }
if ($Remaining -eq 0) {
    Write-Host "All stories are already complete! Nothing to do."
    exit 0
}

# ─── 分支归档 ───

$null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--archive")

Write-Host "Starting Ralph (PowerShell) - Tool: $Tool - Max iterations: $MaxIterations"
Write-Host "Remaining stories: $Remaining"
Write-Host "Project root: $ProjectRoot"

# ─── 主循环 ───

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host ""
    Write-Host "==============================================================="
    Write-Host "  Ralph Iteration $i of $MaxIterations ($Tool)"
    Write-Host "==============================================================="

    Set-Location $ProjectRoot

    # 1. 收敛检测（exit code 3 = should stop）
    $ConvResult = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--check-convergence", "$MaxFailures")
    if ($LASTEXITCODE -eq 3) {
        Write-Error "ERROR: $ConvResult"
        exit 3
    }

    # 2. Story 尝试次数检测（exit code 9 = limits exceeded）
    $LimitResult = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--check-limits", "$MaxAttempts")
    if ($LASTEXITCODE -eq 9) {
        Write-Error "All remaining stories exceeded max attempts. Exiting."
        exit 9
    }

    # 3a. 记录本轮开始前的 git HEAD（用于事后交叉验证）
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--record-git-head")

    # 3b. 获取下一个应执行的 story 并递增其尝试计数
    $NextStory = (Invoke-Core @("$ScriptDir/ralph-core.mjs", "--get-next-story")).Trim()
    Write-Host "  → Next story: $NextStory"
    if ($NextStory -and $NextStory -ne "NONE" -and -not $NextStory.StartsWith("BLOCKED:")) {
        $AttemptNum = (Invoke-Core @("$ScriptDir/ralph-core.mjs", "--increment-story-attempt", "$NextStory")).Trim()
        Write-Host "  → Attempt #$AttemptNum for $NextStory"
    }

    # 3c. 构建增强 Prompt 并写入文件
    $PromptFile = Join-Path $ScriptDir ".current-prompt.md"
    $Prompt = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--build-prompt", "$i")
    $Prompt | Out-File -FilePath $PromptFile -Encoding utf8

    # 4. 执行 claude CLI（流式输出 — 实时显示进度）
    $OutputFile = Join-Path $ScriptDir ".last-output.txt"
    node "$ScriptDir/ralph-run.mjs" "$PromptFile" "$OutputFile"
    $ClaudeExit = $LASTEXITCODE

    # 5. 读取输出并记录错误
    $Output = if (Test-Path $OutputFile) { Get-Content $OutputFile -Raw } else { "" }
    # 写临时文件避免命令行参数过长截断
    $Output | Out-File -FilePath (Join-Path $ScriptDir ".last-raw-output.txt") -Encoding utf8
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--record-error", "$i", "$ClaudeExit")

    # 6. 检查完成信号
    if ($Output -match "<promise>COMPLETE</promise>") {
        Write-Host ""
        Write-Host "Ralph completed all tasks!"
        Write-Host "Completed at iteration $i of $MaxIterations"
        $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--mark-complete")
        exit 0
    }

    # 7. 检测进展
    $RemainingNowStr = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--remaining")
    $RemainingNow = if ($RemainingNowStr) { [int]($RemainingNowStr.Trim()) } else { $Remaining }

    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--update-progress", "$Remaining", "$RemainingNow")

    # 7b. Git 进度交叉验证（代码改了但 passes 没更新 → 自动纠正）
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--check-git-progress")

    # 7c. 多 story 完成检测（一轮完成 >1 个 → 醒目告警）
    $CompletedCountStr = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--detect-multi-story", "$Remaining", "$RemainingNow")
    $CompletedCount = if ($CompletedCountStr) { try { [int]($CompletedCountStr.Trim()) } catch { 0 } } else { 0 }
    if ($CompletedCount -gt 1) {
        Write-Host ""
        Write-Warning "单轮完成 $CompletedCount 个 story（预期每次 1 个），请检查上下文是否压缩丢失细节。"
        Write-Host ""
    }

    $Remaining = $RemainingNow

    # 8. 记录 git 变更
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--record-changes")

    # 9. 写入进度日志
    $null = Invoke-Core @("$ScriptDir/ralph-core.mjs", "--append-log", "$i", "$ClaudeExit", "$Remaining", "$Output")

    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Ralph reached max iterations ($MaxIterations) without completing all stories."
exit 1
