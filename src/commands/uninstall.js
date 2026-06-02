import { readJson } from '../core/jsonfile.js';
import { aiLogPaths, findRoot } from '../core/paths.js';
import { uninstallClaude } from '../integrations/claude.js';
import { uninstallCursor } from '../integrations/cursor.js';
import { uninstallClaudeRule, uninstallCursorRule } from '../integrations/rules.js';

export function uninstall() {
  const root = findRoot(process.cwd());
  if (!root) {
    console.log('ai-log is not initialized here.');
    return;
  }
  const config = readJson(aiLogPaths(root).config) || {};
  const tools = config.tools ?? ['claude', 'cursor'];

  const removed = [];
  if (tools.includes('claude')) removed.push(uninstallClaude(root), uninstallClaudeRule(root));
  if (tools.includes('cursor')) removed.push(uninstallCursor(root), uninstallCursorRule(root));

  console.log('Removed ai-log hooks from:');
  for (const path of removed.filter(Boolean)) console.log(`  ${path}`);
  console.log('Your change history in .ai-log is kept. Delete the folder to remove it.');
}
