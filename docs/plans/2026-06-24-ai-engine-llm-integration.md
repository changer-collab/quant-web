# DeepSeek LLM 集成到 Report Analysis 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `packages/ai-engine` 的 `report_analysis` 模块从纯规则引擎升级为 LLM 驱动的文本分析，接入 DeepSeek API，同时通过环境变量管理 API Key 确保安全。

**Architecture:** 在 `report_analysis/` 下新增 `llm_client.py` 封装 DeepSeek 调用，`ReportAnalyzer` 新增 LLM 模式——优先尝试 LLM，失败时 fallback 到现有规则引擎。所有密钥通过项目根目录一个统一 `.env` 管理（已被 `.gitignore` 排除），Python 包纯读 `os.environ`，不引入 dotenv 依赖。

**Tech Stack:** Python httpx (同步 HTTP 客户端), DeepSeek OpenAI-compatible API, pytest

---

## 配置管理方案

**统一一个 `.env`，不搞多个：**

| 层 | 方式 | 说明 |
|---|---|---|
| 根目录 `.env` | gitignored，唯一密钥文件 | 所有服务共用 |
| 根目录 `.env.example` | 提交到 git，模板 | `DEEPSEEK_API_KEY=sk-your-key` |
| TS 层 (worker/api) | `process.env.XXX` | 已有模式，不变 |
| Python 层 (ai-engine) | `os.environ.get()` | 不引入 dotenv，由启动入口加载 |

Python 包不自己加载 `.env`，由调用入口（Worker 子进程或 CLI）通过 `python-dotenv` 或系统环境变量统一注入。这样 Python 包保持纯净，不依赖 dotenv。

---

## 安全审查结论

扫描完成，**代码库中未发现硬编码的敏感信息**。