import { readJson } from '../core/jsonfile.js';
import { aiLogPaths, findRoot } from '../core/paths.js';
import { uninstallClaude, uninstallClaudeMcp } from '../integrations/claude.js';
import { uninstallCursor } from '../integrations/cursor.js';
import { uninstallClaudeRule, uninstallCursorRule, uninstallWindsurfRule } from '../integrations/rules.js';
import { uninstallWindsurf } from '../integrations/windsurf.js';

export function uninstall() {
  const root = findRoot(process.cwd());
  if (!root) {
    console.log('ai-log is not initialized here.');
    return;
  }
  const config = readJson(aiLogPaths(root).config) || {};
  const tools = config.tools ?? ['claude', 'cursor', 'windsurf'];

  const removed = [];
  if (tools.includes('claude')) removed.push(uninstallClaude(root), uninstallClaudeRule(root), uninstallClaudeMcp(root));
  if (tools.includes('cursor')) removed.push(uninstallCursor(root), uninstallCursorRule(root));
  if (tools.includes('windsurf')) removed.push(uninstallWindsurf(root), uninstallWindsurfRule(root));

  console.log('Removed ai-log hooks from:');
  for (const path of removed.filter(Boolean)) console.log(`  ${path}`);
  console.log('Your change history in .ai-log is kept. Delete the folder to remove it.');
}
