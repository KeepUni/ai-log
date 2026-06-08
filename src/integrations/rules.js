import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RULE =
  'Before you edit any file in this project, first read `.ai-log/recent.md`. ' +
  'It lists the changes coding agents recently made here, most recent first, with diffs. ' +
  'Use it so you do not undo, duplicate, or break recent work. ' +
  'When a file has relevant recent history, review it before changing that file.';

const START = '<!-- ai-log:start -->';
const END = '<!-- ai-log:end -->';
const BLOCK = new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`);

function installBlockRule(path) {
  const block = `${START}\n## ai-log\n\n${RULE}\n${END}`;
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const content = existing.includes(START)
    ? existing.replace(BLOCK, `\n\n${block}\n`).trimStart()
    : existing.trim()
      ? `${existing.trimEnd()}\n\n${block}\n`
      : `${block}\n`;
  writeFileSync(path, content);
  return path;
}

export function uninstallBlockRule(path) {
  if (!existsSync(path)) return null;
  const existing = readFileSync(path, 'utf8');
  if (!existing.includes(START)) return null;
  const rest = existing.replace(BLOCK, '\n').trim();
  if (rest) writeFileSync(path, `${rest}\n`);
  else rmSync(path);
  return path;
}

export const installClaudeRule = (root) => installBlockRule(join(root, 'CLAUDE.md'));
export const uninstallClaudeRule = (root) => uninstallBlockRule(join(root, 'CLAUDE.md'));

export function installCursorRule(root) {
  const path = join(root, '.cursor', 'rules', 'ai-log.mdc');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\ndescription: Consult ai-log change history before editing\nalwaysApply: true\n---\n\n${RULE}\n`);
  return path;
}

export function uninstallCursorRule(root) {
  const path = join(root, '.cursor', 'rules', 'ai-log.mdc');
  if (!existsSync(path)) return null;
  rmSync(path);
  return path;
}
