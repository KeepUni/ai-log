import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { writeFileAtomic } from '../core/atomic.js';
import { classify } from '../core/classify.js';
import { diffLines } from '../core/diff.js';
import { debug, setDebug } from '../core/debug.js';
import { createIgnore } from '../core/ignore.js';
import { neighborsOf, readGraph, removeNode, updateNode, writeGraph } from '../core/graph.js';
import { withLock } from '../core/lock.js';
import { aiLogPaths, findRoot } from '../core/paths.js';
import { renderFileContext, renderRecentMd } from '../core/recent.js';
import { listSnapshots, readFileState, readSnapshot, relPathOf, removeSnapshot, walkFiles, writeSnapshot } from '../core/snapshots.js';
import { appendEntry, readRecentEntries, rotateHistory } from '../core/store.js';

const PATCH_LIMIT = 8000;
const BOM = 0xfeff;

function readStdin(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, timeoutMs).unref();
  });
}

function parsePayload(raw) {
  const text = (raw.charCodeAt(0) === BOM ? raw.slice(1) : raw).trim();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalize(tool, payload) {
  const event = payload.hook_event_name;
  if (tool === 'claude') {
    if (event === 'PostToolUse') return { mode: 'record', file: payload.tool_input?.file_path };
    if (event === 'PreToolUse') return { mode: 'inject-file', file: payload.tool_input?.file_path };
    if (event === 'SessionStart') return { mode: 'inject-global' };
    if (event === 'Stop') return { mode: 'reconcile' };
  }
  if (tool === 'cursor') {
    if (event === 'afterFileEdit') return { mode: 'record', file: payload.file_path };
    if (event === 'sessionStart') return { mode: 'inject-global' };
    if (event === 'stop') return { mode: 'reconcile' };
  }
  return { mode: 'noop' };
}

function locate(payload, file) {
  if (file && isAbsolute(file)) return findRoot(dirname(file));
  const cwd = payload.cwd || payload.workspace_roots?.[0];
  return findRoot(cwd ? resolve(cwd) : process.cwd());
}

function emitClaude(event, context) {
  if (!context) return;
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }),
  );
}

function emitCursor(context) {
  if (!context) return;
  process.stdout.write(JSON.stringify({ additional_context: context }));
}

function inject(tool, mode, root, file) {
  const entries = readRecentEntries(root);
  if (mode === 'inject-global') {
    const context = renderRecentMd(entries);
    if (tool === 'claude') emitClaude('SessionStart', context);
    else emitCursor(context);
    return;
  }
  const relPath = file ? relPathOf(root, resolve(file)) : null;
  if (!relPath) return;
  const neighbors = neighborsOf(readGraph(root), relPath);
  emitClaude('PreToolUse', renderFileContext(entries, relPath, neighbors));
}

function commit(root, tool, relPath, before, after, graph) {
  const diff = diffLines(before, after);
  if (diff.changed === 0) return false;

  const created = before === '';
  const { size, kinds } = classify({ added: diff.added, removed: diff.removed, patch: diff.patch, file: relPath });
  const patch = created
    ? ''
    : diff.patch.length > PATCH_LIMIT
      ? `${diff.patch.slice(0, PATCH_LIMIT)}\n... (truncated)`
      : diff.patch;

  appendEntry(root, {
    ts: new Date().toISOString(),
    tool,
    file: relPath,
    size,
    added: diff.added,
    removed: diff.removed,
    kinds,
    ...(created ? { created: true } : {}),
    patch,
  });
  writeSnapshot(root, relPath, after);
  if (graph) {
    if (after === '') removeNode(graph, relPath);
    else updateNode(graph, root, relPath, after);
  }
  debug(root, `${created ? 'created' : 'recorded'} ${relPath} +${diff.added}/-${diff.removed} ${size}`);
  return true;
}

function refresh(root) {
  rotateHistory(root);
  writeFileAtomic(aiLogPaths(root).recent, renderRecentMd(readRecentEntries(root)));
}

function record(tool, root, file) {
  const relPath = relPathOf(root, resolve(file));
  if (!relPath) return debug(root, `skip outside-root ${file}`);
  if (createIgnore(root).isIgnored(relPath)) return debug(root, `skip ignored ${relPath}`);

  const state = readFileState(resolve(file));
  if (state.binary || state.tooLarge) return debug(root, `skip binary/large ${relPath}`);
  const after = state.content;

  withLock(root, () => {
    const before = readSnapshot(root, relPath) ?? '';
    if (before === after) return debug(root, `skip nochange ${relPath}`);
    const graph = readGraph(root);
    if (commit(root, tool, relPath, before, after, graph)) {
      writeGraph(root, graph);
      refresh(root);
    }
  });
}

function reconcile(tool, root) {
  const ignore = createIgnore(root);
  const marker = join(aiLogPaths(root).base, '.reconcile');
  const scanStart = Date.now();
  let since = 0;
  try {
    since = Number(readFileSync(marker, 'utf8')) || 0;
  } catch {
    // first reconcile of this project; scan everything once
  }

  withLock(root, () => {
    let recorded = 0;
    const graph = readGraph(root);

    walkFiles(root, ignore, (abs, relPath) => {
      let mtimeMs;
      try {
        mtimeMs = statSync(abs).mtimeMs;
      } catch {
        return;
      }
      if (mtimeMs < since) return;
      const state = readFileState(abs);
      if (!state.exists || state.binary || state.tooLarge) return;
      const before = readSnapshot(root, relPath) ?? '';
      if (before === state.content) return;
      if (commit(root, tool, relPath, before, state.content, graph)) recorded++;
    });

    for (const relPath of listSnapshots(root)) {
      if (ignore.isIgnored(relPath) || existsSync(join(root, ...relPath.split('/')))) continue;
      const before = readSnapshot(root, relPath) ?? '';
      if (before !== '' && commit(root, tool, relPath, before, '', graph)) recorded++;
      removeSnapshot(root, relPath);
    }

    if (recorded) {
      writeGraph(root, graph);
      refresh(root);
    }
    writeFileAtomic(marker, String(scanStart));
    debug(root, `reconcile recorded ${recorded}`);
  });
}

export async function capture(options) {
  setDebug(options.debug);
  const tool = options.tool;

  const raw = await readStdin();
  const payload = parsePayload(raw);
  if (!payload) return debug(null, `${tool}: unparseable stdin (${raw.length} bytes)`);

  const { mode, file } = normalize(tool, payload);
  const root = locate(payload, file);
  debug(root, `event=${payload.hook_event_name} tool=${tool} mode=${mode} file=${file ?? '-'} root=${root ?? 'none'}`);

  if (mode === 'noop') return;
  if (mode === 'record' && !file) return;
  if (!root) return;

  try {
    if (mode === 'record') record(tool, root, file);
    else if (mode === 'reconcile') reconcile(tool, root);
    else inject(tool, mode, root, file);
  } catch (error) {
    debug(root, `error: ${error.message}`);
  }
}
