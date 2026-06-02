const CONTEXT = 3;

function splitLines(text) {
  if (text === '') return [];
  return text.split(/\r?\n/);
}

function lcsOps(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push({ tag: 'eq', value: a[i++], _b: j++ });
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ tag: 'del', value: a[i++] });
    else ops.push({ tag: 'add', value: b[j++] });
  }
  while (i < n) ops.push({ tag: 'del', value: a[i++] });
  while (j < m) ops.push({ tag: 'add', value: b[j++] });
  return ops;
}

function annotate(ops) {
  let aLine = 1;
  let bLine = 1;
  return ops.map((op) => {
    const rec = {
      tag: op.tag,
      value: op.value,
      a: op.tag !== 'add' ? aLine : null,
      b: op.tag !== 'del' ? bLine : null,
    };
    if (op.tag !== 'add') aLine++;
    if (op.tag !== 'del') bLine++;
    return rec;
  });
}

function hunkRanges(ops) {
  const n = ops.length;
  const keep = new Array(n).fill(false);
  for (let idx = 0; idx < n; idx++) {
    if (ops[idx].tag === 'eq') continue;
    for (let k = Math.max(0, idx - CONTEXT); k <= Math.min(n - 1, idx + CONTEXT); k++) keep[k] = true;
  }
  const ranges = [];
  let start = -1;
  for (let idx = 0; idx <= n; idx++) {
    if (idx < n && keep[idx]) {
      if (start === -1) start = idx;
    } else if (start !== -1) {
      ranges.push([start, idx - 1]);
      start = -1;
    }
  }
  return ranges;
}

function renderHunk(rows) {
  const aLines = rows.filter((r) => r.a !== null);
  const bLines = rows.filter((r) => r.b !== null);
  const aStart = aLines.length ? aLines[0].a : 0;
  const bStart = bLines.length ? bLines[0].b : 0;
  const header = `@@ -${aStart},${aLines.length} +${bStart},${bLines.length} @@`;
  const body = rows.map((r) => {
    const prefix = r.tag === 'add' ? '+' : r.tag === 'del' ? '-' : ' ';
    return prefix + r.value;
  });
  return [header, ...body].join('\n');
}

export function diffLines(before, after) {
  const a = splitLines(before);
  const b = splitLines(after);
  const ops = lcsOps(a, b);
  const added = ops.reduce((sum, op) => sum + (op.tag === 'add' ? 1 : 0), 0);
  const removed = ops.reduce((sum, op) => sum + (op.tag === 'del' ? 1 : 0), 0);
  const annotated = annotate(ops);
  const patch = hunkRanges(annotated)
    .map(([s, e]) => renderHunk(annotated.slice(s, e + 1)))
    .join('\n');
  return { added, removed, patch, changed: added + removed };
}
