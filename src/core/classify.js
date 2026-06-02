const CONFIG_EXT = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'env']);
const DOC_EXT = new Set(['md', 'markdown', 'rst', 'txt', 'adoc']);

const IMPORT_RE = /^[+-]\s*(import\b|from\b|require\s*\(|using\b|#include\b|use\b)/;
const SIGNATURE_RE =
  /^[+-]\s*(export\s+)?(async\s+)?(function\b|class\b|interface\b|type\s+\w+\s*=|def\b|func\b|fn\b|public\b|private\b|protected\b|const\s+\w+\s*=\s*(async\s*)?\()/;

function extname(relPath) {
  const dot = relPath.lastIndexOf('.');
  const slash = relPath.lastIndexOf('/');
  return dot > slash ? relPath.slice(dot + 1).toLowerCase() : '';
}

export function sizeOf(changed) {
  if (changed > 100) return 'major';
  if (changed >= 10) return 'medium';
  return 'minor';
}

export function classify({ added, removed, patch, file }) {
  const changed = added + removed;
  const kinds = [];
  const ext = extname(file);
  const lines = patch.split('\n').filter((l) => l[0] === '+' || l[0] === '-');

  if (file.endsWith('package.json') || file.endsWith('requirements.txt') || file.endsWith('go.mod')) {
    kinds.push('dependency');
  } else if (lines.some((l) => IMPORT_RE.test(l))) {
    kinds.push('imports');
  }
  if (lines.some((l) => SIGNATURE_RE.test(l))) kinds.push('signature');
  if (CONFIG_EXT.has(ext)) kinds.push('config');
  if (DOC_EXT.has(ext)) kinds.push('docs');
  if (removed > 0 && added === 0) kinds.push('deletion');

  return { size: sizeOf(changed), changed, kinds };
}
