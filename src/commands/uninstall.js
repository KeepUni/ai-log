import { rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from '../core/jsonfile.js';
import { aiLogPaths, findRoot } from '../core/paths.js';
import { uninstallClaude, uninstallClaudeMcp } from '../integrations/claude.js';
import { uninstallCursor } from '../integrations/cursor.js';
import { removeLegacy } from '../integrations/legacy.js';
import { uninstallClaudeRule, uninstallCursorRule } from '../integrations/rules.js';

export function uninstall(options = {}) {
  const root = findRoot(process.cwd());
  if (!root) {
    console.log('ai-log is not initialized here.');
    return;
  }
  const paths = aiLogPaths(root);
  const config = readJson(paths.config) || {};
  const tools = config.tools ?? ['claude', 'cursor'];

  const removed = [];
  if (tools.includes('claude')) removed.push(uninstallClaude(root), uninstallClaudeRule(root), uninstallClaudeMcp(root));
  if (tools.includes('cursor')) removed.push(uninstallCursor(root), uninstallCursorRule(root));
  removed.push(...removeLegacy(root));

  console.log('Removed ai-log from:');
  for (const path of removed.filter(Boolean)) console.log(`  ${path}`);

  for (const dir of ['.cursor/rules', '.cursor', '.claude', '.windsurf']) {
    try {
      rmdirSync(join(root, ...dir.split('/')));
    } catch {
      // absent, or still holds the user's own files; leave it alone
    }
  }

  if (options.purge) {
    rmSync(paths.base, { recursive: true, force: true });
    console.log(`  ${paths.base} (purged)`);
    console.log('Fully removed from this project. To remove the CLI too: npm rm -g @keepuni/ai-log');
  } else {
    console.log('Your change history in .ai-log is kept; re-run with --purge to delete it too.');
    console.log('To remove the CLI itself: npm rm -g @keepuni/ai-log');
  }
}
