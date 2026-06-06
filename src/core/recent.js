const RECENT_ENTRIES = 20;
const DETAIL_ENTRIES = 10;
const EXCERPT_LINES = 8;
const MAJOR_EXCERPT_LINES = 3;
const FILE_ENTRIES = 5;
const SAMPLE_LINES = 12;
const CO_CHANGE_WINDOW_MS = 120000;
const RELATED_LIMIT = 3;
const RELATED_MIN = 2;
const GRAPH_LIMIT = 8;

function shortTime(iso) {
  return iso.replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, 'Z').replace(/\.\d{3}Z$/, 'Z');
}

function kindTag(entry) {
  return entry.kinds.length ? ` [${entry.kinds.join(', ')}]` : '';
}

function summary(entry) {
  if (entry.created) return `created, ${entry.added} lines${kindTag(entry)}`;
  return `${entry.size} +${entry.added}/-${entry.removed}${kindTag(entry)}`;
}

function changedLines(patch, max) {
  if (!patch) return '';
  const lines = patch.split('\n').filter((line) => line[0] === '+' || line[0] === '-');
  const head = lines.slice(0, max);
  if (lines.length > max) head.push(`... (${lines.length - max} more changed lines)`);
  return head.join('\n');
}

function hunk(patch, max) {
  if (!patch) return '';
  const lines = patch.split('\n');
  const head = lines.slice(0, max);
  if (lines.length > max) head.push(`... (${lines.length - max} more lines)`);
  return head.join('\n');
}

function relatedFiles(entries, file) {
  const targetTimes = entries.filter((e) => e.file === file).map((e) => Date.parse(e.ts));
  if (targetTimes.length === 0) return [];
  const counts = new Map();
  for (const entry of entries) {
    if (entry.file === file) continue;
    const t = Date.parse(entry.ts);
    if (targetTimes.some((tt) => Math.abs(tt - t) <= CO_CHANGE_WINDOW_MS)) {
      counts.set(entry.file, (counts.get(entry.file) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= RELATED_MIN)
    .sort((a, b) => b[1] - a[1])
    .slice(0, RELATED_LIMIT)
    .map(([f]) => f);
}

export function renderRecentMd(entries) {
  const recent = entries.slice(-RECENT_ENTRIES).reverse();
  const lines = [
    '# ai-log - recent changes',
    '',
    'Read this before editing. It is the log of changes coding agents have already made to this project, most recent first. Use it to avoid undoing or duplicating recent work.',
    '',
  ];
  if (recent.length === 0) {
    lines.push('_No changes recorded yet._', '');
    return lines.join('\n');
  }
  lines.push(`_Last updated ${shortTime(new Date().toISOString())}, showing the ${recent.length} most recent changes._`, '');
  recent.forEach((entry, index) => {
    lines.push(`- \`${entry.file}\` (${summary(entry)}) ${shortTime(entry.ts)} ${entry.tool}`);
    if (index < DETAIL_ENTRIES) {
      const excerpt = changedLines(entry.patch, entry.size === 'major' ? MAJOR_EXCERPT_LINES : EXCERPT_LINES);
      if (excerpt) lines.push('', '```diff', excerpt, '```', '');
    }
  });
  return lines.join('\n');
}

export function renderFileContext(entries, file, neighbors = null) {
  const lines = [];
  const forFile = entries.filter((e) => e.file === file).slice(-FILE_ENTRIES).reverse();
  if (forFile.length) {
    lines.push(`Recent ai-log history for ${file} (most recent first):`, '');
    for (const entry of forFile) {
      lines.push(`* ${shortTime(entry.ts)} (${summary(entry)})`);
      const snippet = hunk(entry.patch, SAMPLE_LINES);
      if (snippet) lines.push('```diff', snippet, '```');
    }
    const related = relatedFiles(entries, file);
    if (related.length) {
      lines.push('', `Files often changed alongside ${file} (check them before you edit):`);
      for (const rel of related) {
        const last = entries.filter((e) => e.file === rel).at(-1);
        lines.push(`* ${rel} (latest: ${summary(last)} ${shortTime(last.ts)})`);
      }
    }
  }

  if (neighbors?.imports.length) {
    if (lines.length) lines.push('');
    lines.push(`${file} imports (review these if your change touches them):`);
    for (const dep of neighbors.imports.slice(0, GRAPH_LIMIT)) lines.push(`* ${dep}`);
  }
  if (neighbors?.importedBy.length) {
    if (lines.length) lines.push('');
    lines.push(`Files that import ${file} (your change may affect them):`);
    for (const dep of neighbors.importedBy.slice(0, GRAPH_LIMIT)) lines.push(`* ${dep}`);
  }

  return lines.length ? lines.join('\n') : '';
}
