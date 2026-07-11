import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const base = process.env.GITHUB_BASE_REF
  ? `origin/${process.env.GITHUB_BASE_REF}`
  : process.env.GITHUB_EVENT_BEFORE || 'origin/main';
const changedFiles = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`],
  { encoding: 'utf8' }
)
  .split('\n')
  .filter((file) => /\.(ts|tsx|json|css)$/.test(file));

if (changedFiles.length === 0) {
  process.exit(0);
}

execFileSync(process.execPath, [resolve('node_modules/prettier/bin/prettier.cjs'), '--check', ...changedFiles], {
  stdio: 'inherit',
});
