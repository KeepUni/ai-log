import { neighborsOf, readGraph } from '../core/graph.js';
import { findRoot } from '../core/paths.js';
import { renderFileContext, renderRecentMd } from '../core/recent.js';
import { readEntries } from '../core/store.js';

export function context(file) {
  const root = findRoot(process.cwd());
  if (!root) {
    console.log('ai-log is not initialized here. Run `ai-log init`.');
    return;
  }
  const entries = readEntries(root);
  if (!file) {
    console.log(renderRecentMd(entries));
    return;
  }
  const rel = file.replace(/\\/g, '/');
  const output = renderFileContext(entries, rel, neighborsOf(readGraph(root), rel));
  console.log(output || `No recorded changes for ${rel}.`);
}
