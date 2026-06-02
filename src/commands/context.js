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
  const output = file ? renderFileContext(entries, file.replace(/\\/g, '/')) : renderRecentMd(entries);
  console.log(output || `No recorded changes for ${file}.`);
}
