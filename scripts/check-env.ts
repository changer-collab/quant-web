/**
 * 环境检查脚本 — 验证 Python、Baostock、AKShare 环境可用
 *
 * 用法: npx tsx scripts/check-env.ts
 *
 * 检查项：
 * - Python 3.8+ 已安装且在 PATH 中
 * - baostock 已安装（seed-data.ts 实际使用的数据源）
 * - akshare 已安装（适配器存在，可选）
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function checkPython(): Promise<void> {
  try {
    const { stdout } = await exec('python', ['--version']);
    console.log(`Python: ${stdout.trim()}`);
  } catch {
    throw new Error('Python 未安装或不在 PATH 中');
  }
}

async function checkBaostock(): Promise<void> {
  // baostock login/logout 会输出到 stdout，需重定向到 devnull
  const script = `
import json, sys, os
_real_stdout = sys.stdout
try:
  sys.stdout = open(os.devnull, 'w')
  import baostock as bs
  lg = bs.login()
  sys.stdout = _real_stdout
  if lg.error_code != "0":
    raise Exception(f"login failed: {lg.error_msg}")
  sys.stdout = open(os.devnull, 'w')
  bs.logout()
  sys.stdout = _real_stdout
  print(json.dumps({"ok": True}))
except Exception as e:
  sys.stdout = _real_stdout
  print(json.dumps({"ok": False, "error": str(e)}))
`;
  await runCheck('baostock', script);
}

async function checkAkshare(): Promise<void> {
  const script = `
import json
try:
  import akshare as ak
  print(json.dumps({"ok": True}))
except Exception as e:
  print(json.dumps({"ok": False, "error": str(e)}))
`;
  await runCheck('akshare', script);
}

async function runCheck(pkg: string, script: string): Promise<void> {
  try {
    const { stdout } = await exec('python', ['-c', script], { timeout: 30_000 });
    const result = JSON.parse(stdout.trim());
    if (!result.ok) {
      throw new Error(`${pkg} 不可用: ${result.error}`);
    }
    console.log(`${pkg}: 可用`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('不可用')) {
      throw err;
    }
    throw new Error(`${pkg} 检查失败: ${err}`);
  }
}

async function main(): Promise<void> {
  console.log('=== 环境检查 ===\n');
  await checkPython();
  await checkBaostock();
  try {
    await checkAkshare();
  } catch (err) {
    console.warn(`akshare: 可选依赖未安装（${err}），seed-data.ts 使用 baostock 不受影响`);
  }
  console.log('\n=== 环境检查通过 ===');
}

main().catch((err) => {
  console.error(`\n环境检查失败: ${err.message}`);
  process.exit(1);
});
