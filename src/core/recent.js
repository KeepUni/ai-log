const RECENT_ENTRIES = 20;
const DETAIL_ENTRIES = 10;
const EXCERPT_LINES = 8;
const MAJOR_EXCERPT_LINES = 3;
const FILE_ENTRIES = 5;
const SAMPLE_LINES = 12;

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

export function renderFileContext(entries, file) {
  const forFile = entries.filter((e) => e.file === file).slice(-FILE_ENTRIES).reverse();
  if (forFile.length === 0) return '';
  const lines = [`Recent ai-log history for ${file} (most recent first):`, ''];
  for (const entry of forFile) {
    lines.push(`* ${shortTime(entry.ts)} (${summary(entry)})`);
    const snippet = hunk(entry.patch, SAMPLE_LINES);
    if (snippet) lines.push('```diff', snippet, '```');
  }
  return lines.join('\n');
}
