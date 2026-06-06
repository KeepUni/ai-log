import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

export const DIR = '.ai-log';

export function aiLogPaths(root) {
  const base = join(root, DIR);
  return {
    root,
    base,
    history: join(base, 'history.jsonl'),
    recent: join(base, 'recent.md'),
    snapshots: join(base, 'snapshots'),
    config: join(base, 'config.json'),
    graph: join(base, 'graph.json'),
    gitignore: join(base, '.gitignore'),
  };
}

export function findRoot(startDir) {
  let dir = startDir;
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, DIR))) return dir;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}
