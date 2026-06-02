import { readJson } from '../core/jsonfile.js';
import { aiLogPaths, findRoot } from '../core/paths.js';
import { readEntries } from '../core/store.js';

export function status() {
  const root = findRoot(process.cwd());
  if (!root) {
    console.log('ai-log is not initialized here. Run `ai-log init`.');
    return;
  }

  const paths = aiLogPaths(root);
  const config = readJson(paths.config) || {};
  const entries = readEntries(root);
  const counts = { minor: 0, medium: 0, major: 0 };
  for (const entry of entries) counts[entry.size]++;

  const out = [];
  out.push(`ai-log in ${root}`);
  out.push(`  storage:  ${config.storage ?? 'unknown'}`);
  out.push(`  tools:    ${(config.tools ?? []).join(', ') || 'none'}`);
  out.push(`  changes:  ${entries.length} (${counts.minor} minor, ${counts.medium} medium, ${counts.major} major)`);
  out.push('');
  for (const entry of entries.slice(-5).reverse()) {
    out.push(`  ${entry.ts}  ${entry.size.padEnd(6)}  +${entry.added}/-${entry.removed}  ${entry.file}`);
  }
  console.log(out.join('\n'));
}
