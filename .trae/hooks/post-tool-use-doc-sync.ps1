# PostToolUse hook for document sync reminder.
# Triggers after Edit/Write. Reads Trae hook JSON from stdin,
# checks if the modified file belongs to a document sync chain,
# and emits a reminder to additionalContext.

$ErrorActionPreference = "Stop"

function Write-AdditionalContext {
    param([string]$Context)

    @{
        continue = $true
        suppressOutput = $true
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
            additionalContext = $Context
        }
    } | ConvertTo-Json -Depth 5 -Compress
}

function Get-ModuleFromPath {
    param([string]$FilePath)

    # Normalize to forward slashes
    $normalized = ($FilePath -replace "\\", "/")

    # Match known module patterns
    if ($normalized -match "/apps/web/") { return "apps/web" }
    if ($normalized -match "/apps/api/") { return "apps/api" }
    if ($normalized -match "/apps/worker/") { return "apps/worker" }
    if ($normalized -match "/services/data-center/") { return "services/data-center" }
    if ($normalized -match "/services/data-collector/") { return "services/data-collector" }
    if ($normalized -match "/packages/strategy-runtime/") { return "packages/strategy-runtime" }
    if ($normalized -match "/packages/backtest-engine/") { return "packages/backtest-engine" }
    if ($normalized -match "/packages/ai-engine/") { return "packages/ai-engine" }
    if ($normalized -match "/packages/factor-lab/") { return "packages/factor-lab" }
    if ($normalized -match "/packages/strategies/") { return "packages/strategies" }
    if ($normalized -match "/packages/loop-engine/") { return "packages/loop-engine" }
    if ($normalized -match "/packages/obsidian-sync/") { return "packages/obsidian-sync" }
    if ($normalized -match "/packages/data-client/") { return "packages/data-client" }
    return $null
}

function Test-IsCodeFile {
    param([string]$FilePath)

    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
    return $ext -in @(".ts", ".tsx", ".py", ".js", ".jsx")
}

function Test-IsDocFile {
    param([string]$FilePath)

    $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
    return $ext -in @(".md", ".json", ".yaml", ".yml")
}

$stdinText = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($stdinText)) {
    # No payload, nothing to remind
    exit 0
}

try {
    $payload = $stdinText | ConvertFrom-Json
}
catch {
    exit 0
}

# Extract file path from tool_input
$filePath = ""
if ($payload.tool_input -and $payload.tool_input.file_path) {
    $filePath = [string]$payload.tool_input.file_path
}
elseif ($payload.tool_input -and $payload.tool_input.path) {
    $filePath = [string]$payload.tool_input.path
}

if ([string]::IsNullOrWhiteSpace($filePath)) {
    exit 0
}

$moduleName = Get-ModuleFromPath $filePath
if (-not $moduleName) {
    # Not in a tracked module, no reminder needed
    exit 0
}

$isCode = Test-IsCodeFile $filePath
$isDoc = Test-IsDocFile $filePath

$reminders = @()

if ($isCode) {
    # Code file changed — remind to sync README.md and AGENT.md of that module
    $reminders += "修改了 ${moduleName} 代码文件。若涉及能力/接口/边界变更，记得同步 ${moduleName}/README.md 和 ${moduleName}/AGENT.md。"
}

if ($isDoc) {
    # Doc file changed — remind to check cross-references
    $fileName = [System.IO.Path]::GetFileName($filePath)
    if ($fileName -eq "AGENT.md" -or $fileName -eq "README.md") {
        $reminders += "修改了 ${moduleName}/${fileName}。若涉及角色或架构边界变更，同步根级 AGENTS.md 和 README.md。"
    }
    if ($fileName -eq "AGENTS.md") {
        $reminders += "修改了根级 AGENTS.md。检查 @include 引用的子项目 AGENT.md 是否存在（apps/* services/* packages/*）。"
    }
}

if ($reminders.Count -eq 0) {
    exit 0
}

$context = @"
<DOC_SYNC_REMINDER>
$($reminders -join "`n")
修改记录追加到 .trae/changelog-pending.md。commit 时由 commit-push-workflow 整理写入 CHANGELOG.md。
</DOC_SYNC_REMINDER>
"@

Write-AdditionalContext $context
