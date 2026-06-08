import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from '../core/jsonfile.js';
import { uninstallBlockRule } from './rules.js';

const MARKER = 'capture --tool';

const hasMarker = (entry) => Object.values(entry).some((v) => typeof v === 'string' && v.includes(MARKER));

// Removes ai-log artifacts left by integrations that have since been dropped
// (currently Windsurf), so `uninstall` honors "remove only what ai-log added"
// even on a project initialized by an older version.
export function removeLegacy(root) {
  const removed = [];

  const hooks = join(root, '.windsurf', 'hooks.json');
  const config = readJson(hooks);
  if (config?.hooks) {
    let changed = false;
    for (const event of Object.keys(config.hooks)) {
      const entries = config.hooks[event] || [];
      const kept = entries.filter((entry) => !hasMarker(entry));
      if (kept.length === entries.length) continue;
      changed = true;
      if (kept.length) config.hooks[event] = kept;
      else delete config.hooks[event];
    }
    if (changed) {
      if (Object.keys(config.hooks).length === 0) delete config.hooks;
      const keys = Object.keys(config);
      if (keys.length === 0 || (keys.length === 1 && keys[0] === 'version')) rmSync(hooks);
      else writeJson(hooks, config);
      removed.push(hooks);
    }
  }

  const rules = uninstallBlockRule(join(root, '.windsurfrules'));
  if (rules) removed.push(rules);

  return removed;
}
