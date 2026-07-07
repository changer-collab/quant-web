# UserPromptSubmit hook for Superpowers for Trae.
# Keep this short: it is injected on every user prompt.

$ErrorActionPreference = "Stop"

function Write-AdditionalContext {
    param([string]$Context)

    @{
        continue = $true
        suppressOutput = $true
        hookSpecificOutput = @{
            hookEventName = "UserPromptSubmit"
            additionalContext = $Context
        }
    } | ConvertTo-Json -Depth 5 -Compress
}

$context = @"
<SUPERPOWERS_RUNTIME_REMINDER>
[项目主流程] 修改 d:\quant-web\ 下文件时，按 .trae/rules/quant-web-workflow.md 执行（最高优先级）：上下文加载→需求确认→编码→跨模块类型契约检查→验证→文档维护→用户验收（先总结再询问）→技能缺口记录→修改记录。
[Superpowers 辅助] Skills 按描述自动触发，不手动指定。Bugs 用 systematic-debugging。完成声明用 verification-before-completion。
[技能缺口] 遇到没有合适 skill 的复杂问题，自行完成后记录到 .trae/skill-requests.md。
[修改记录] 每次修改文件追加到 .trae/changelog-pending.md。commit 时整理写入仓库 CHANGELOG.md 并清空临时记录。
</SUPERPOWERS_RUNTIME_REMINDER>
"@

Write-AdditionalContext $context
