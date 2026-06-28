#!/usr/bin/env node
/**
 * ralph-run.mjs - 流式执行 claude CLI
 *
 * 替代 ralph.ps1 中的阻塞式管道:
 *   $Prompt | claude --print 2>&1 | Tee-Object ...
 *
 * 改为:
 *   node ralph-run.mjs <prompt-file> <output-file>
 *
 * 特性:
 * - 实时显示 Claude 的文本输出（不再等待全部完成）
 * - 显示工具调用指示器（🔧 tool_name）
 * - 保留 claude 的退出码
 * - 将完整输出保存到文件供后续处理
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";

const promptFile = process.argv[2];
const outputFile = process.argv[3];

if (!promptFile) {
  console.error("Usage: node ralph-run.mjs <prompt-file> [output-file]");
  process.exit(1);
}

// 清理可能存在的旧的 outputFile（避免上一轮残留）
if (outputFile && existsSync(outputFile)) {
  unlinkSync(outputFile);
}

const prompt = readFileSync(promptFile, "utf-8");

// 调试：显示 prompt 信息（输出到 stderr，不混入 output 文件）
process.stderr.write(`\n[ralph-run] Prompt file: ${promptFile}\n`);
process.stderr.write(`[ralph-run] Prompt length: ${prompt.length} chars\n`);
if (prompt.length < 10) {
  process.stderr.write(`[ralph-run] WARNING: Prompt is very short: "${prompt}"\n`);
}
process.stderr.write(`[ralph-run] Starting claude CLI...\n`);

const child = spawn("claude", [
  "--dangerously-skip-permissions",
  "--print",
  "--verbose",
  "--output-format", "stream-json",
], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.env.PROJECT_ROOT || process.cwd(),
  shell: true,  // Windows 必须：.cmd 文件需要 shell 解析
});

// 写入 prompt 后关闭 stdin
child.stdin.write(prompt);
child.stdin.end();

const chunks = [];

// ─── 直接解析 stdout 流（不用 readline，避免 PowerShell 下的缓冲问题）───
let buffer = "";
child.stdout.on("data", (data) => {
  buffer += data.toString();
  const lines = buffer.split("\n");
  // 保留最后一个可能不完整的行
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;

    // 非 JSON 行直接输出
    if (!line.startsWith("{")) {
      process.stdout.write(line + "\n");
      chunks.push(line);
      continue;
    }

    try {
      const msg = JSON.parse(line);

      switch (msg.type) {
        case "assistant":
          if (msg.message?.content) {
            for (const block of msg.message.content) {
              if (block.type === "text" && block.text) {
                process.stdout.write(block.text);
                chunks.push(block.text);
              }
              if (block.type === "tool_use") {
                const name = block.name || "unknown";
                const input = block.input || {};
                let detail = "";
                if (name === "Bash" && input.command) {
                  detail = input.command.length > 80
                    ? input.command.slice(0, 80) + "..."
                    : input.command;
                } else if (name === "Read" || name === "Write" || name === "Edit") {
                  detail = input.file_path || "";
                } else if (name === "Grep" || name === "Glob") {
                  detail = input.pattern || input.path || "";
                }
                const label = detail ? `🔧 ${name}: ${detail}` : `🔧 ${name}`;
                process.stderr.write(`\n${label}\n`);
              }
            }
          }
          break;

        case "result":
          if (msg.result) {
            if (chunks.length === 0) {
              process.stdout.write(msg.result);
            }
            chunks.push("\n" + msg.result);
          }
          if (msg.duration_ms || msg.cost_usd) {
            const stats = [];
            if (msg.duration_ms) stats.push(`${(msg.duration_ms / 1000).toFixed(1)}s`);
            if (msg.cost_usd) stats.push(`$${msg.cost_usd.toFixed(4)}`);
            if (msg.total_cost_usd) stats.push(`total $${msg.total_cost_usd.toFixed(4)}`);
            process.stderr.write(`\n⏱️ ${stats.join(" | ")}\n`);
          }
          break;
      }
    } catch {
      process.stdout.write(line + "\n");
      chunks.push(line);
    }
  }
});

// stderr 直接显示（claude 的警告、错误等）
child.stderr.on("data", (data) => {
  process.stderr.write(data);
});

// ─── 进程结束（flush 剩余 buffer 再保存）───
child.on("close", (code) => {
  const exitCode = code ?? 0;

  // flush buffer 中剩余的行
  if (buffer.trim()) {
    if (!buffer.startsWith("{")) {
      process.stdout.write(buffer + "\n");
      chunks.push(buffer);
    }
    // 如果是尾部 JSON，尝试解析（可能是 incomplete，忽略）
  }

  // 保存完整输出到文件（供 ralph-core 后续处理）
  if (outputFile) {
    writeFileSync(outputFile, chunks.join(""), "utf-8");
  }

  process.exit(exitCode);
});

child.on("error", (err) => {
  console.error(`Failed to start claude: ${err.message}`);
  process.exit(1);
});
