import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const bin = fileURLToPath(new URL('../bin/ai-log.js', import.meta.url));

function run(cwd, args, input) {
  return execFileSync('node', [bin, ...args], { cwd, input, encoding: 'utf8' });
}

function project() {
  const root = mkdtempSync(join(tmpdir(), 'ailog-e2e-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'app.js'), 'const a = 1;\nconst b = 2;\n');
  return root;
}

test('full hook lifecycle: init, capture an edit, inject context, status', () => {
  const root = project();
  const file = join(root, 'src', 'app.js');

  run(root, ['init', '--private', '--yes']);
  assert.ok(readFileSync(join(root, '.claude', 'settings.json'), 'utf8').includes('capture --tool claude'));
  assert.ok(readFileSync(join(root, '.cursor', 'hooks.json'), 'utf8').includes('capture --tool cursor'));

  writeFileSync(file, 'const a = 1;\nconst b = 22;\nconst c = 3;\n');
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({
    hook_event_name: 'PostToolUse',
    cwd: root,
    tool_input: { file_path: file },
  }));

  const history = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim().split('\n');
  assert.equal(history.length, 1);
  const entry = JSON.parse(history[0]);
  assert.equal(entry.file, 'src/app.js');
  assert.equal(entry.added, 2);
  assert.equal(entry.removed, 1);

  const injected = run(root, ['capture', '--tool', 'claude'], JSON.stringify({
    hook_event_name: 'PreToolUse',
    cwd: root,
    tool_input: { file_path: file },
  }));
  const payload = JSON.parse(injected);
  assert.match(payload.hookSpecificOutput.additionalContext, /src\/app\.js/);

  assert.match(run(root, ['status']), /1 \(/);
});

test('parses a cursor payload prefixed with a UTF-8 BOM', () => {
  const root = project();
  const file = join(root, 'src', 'app.js');

  run(root, ['init', '--private', '--cursor', '--yes']);
  writeFileSync(file, 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  const bom = String.fromCharCode(0xfeff);
  run(root, ['capture', '--tool', 'cursor'], bom + JSON.stringify({
    hook_event_name: 'afterFileEdit',
    workspace_roots: [root],
    file_path: file,
    edits: [],
  }));

  const history = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim();
  assert.ok(history.length > 0, 'a BOM-prefixed payload must still be recorded');
  const entry = JSON.parse(history.split('\n')[0]);
  assert.equal(entry.file, 'src/app.js');
  assert.equal(entry.tool, 'cursor');
});

test('re-running init keeps recent.md reflecting existing history', () => {
  const root = project();
  const file = join(root, 'src', 'app.js');

  run(root, ['init', '--private', '--yes']);
  writeFileSync(file, 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { file_path: file } }));

  run(root, ['init', '--private', '--yes']);
  assert.match(readFileSync(join(root, '.ai-log', 'recent.md'), 'utf8'), /app\.js/);
});

test('the first reconcile after init records nothing (install artifacts are baselined)', () => {
  const root = project();
  run(root, ['init', '--private', '--yes']);
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({ hook_event_name: 'Stop', cwd: root }));
  const history = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim();
  assert.equal(history, '', 'init must baseline its own hook/rule/MCP files so a clean reconcile logs nothing');
});

test('reconcile (Stop hook) catches a shell edit the file hooks missed', () => {
  const root = project();
  const file = join(root, 'src', 'app.js');

  run(root, ['init', '--private', '--yes']);
  // simulate an edit made through the shell: change the file with no capture/hook firing
  writeFileSync(file, 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\n');
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({ hook_event_name: 'Stop', cwd: root }));

  const history = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim();
  assert.ok(history.length > 0, 'reconcile should record the shell edit');
  assert.equal(JSON.parse(history.split('\n').pop()).file, 'src/app.js');
});

test('reconcile reads its cutoff from the marker contents, not the marker mtime', () => {
  const root = project();
  const file = join(root, 'src', 'app.js');

  run(root, ['init', '--private', '--yes']);
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({ hook_event_name: 'Stop', cwd: root }));

  // The marker is written after the scan stats files, so its mtime is always
  // later than the scan start. Exaggerate that with a far-future mtime: it must
  // not hide a later edit, because the cutoff comes from the marker's contents.
  const marker = join(root, '.ai-log', '.reconcile');
  const future = new Date(Date.now() + 3600_000);
  utimesSync(marker, future, future);

  writeFileSync(file, 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({ hook_event_name: 'Stop', cwd: root }));

  const history = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim();
  assert.ok(history.length > 0, 'a late marker mtime must not hide a shell edit');
  assert.equal(JSON.parse(history.split('\n').pop()).file, 'src/app.js');
});

test('reconcile records a file deleted through the shell', () => {
  const root = project();
  run(root, ['init', '--private', '--yes']);
  rmSync(join(root, 'src', 'app.js'));
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({ hook_event_name: 'Stop', cwd: root }));

  const entry = JSON.parse(readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim().split('\n').pop());
  assert.equal(entry.file, 'src/app.js');
  assert.ok(entry.removed > 0 && entry.added === 0);
  assert.ok(entry.kinds.includes('deletion'));
});

test('uninstall removes our hooks but keeps the user\'s own', () => {
  const root = project();
  run(root, ['init', '--private', '--yes']);

  const settingsPath = join(root, '.claude', 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  settings.hooks.PostToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] });
  writeFileSync(settingsPath, JSON.stringify(settings));

  run(root, ['uninstall']);
  const after = readFileSync(settingsPath, 'utf8');
  assert.doesNotMatch(after, /capture --tool/, 'ai-log hooks are gone');
  assert.match(after, /echo mine/, "the user's own hook is preserved");
});

test('uninstall leaves settings pristine when ai-log was the only hook', () => {
  const root = project();
  run(root, ['init', '--private', '--claude', '--yes']);
  run(root, ['uninstall']);
  const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(settings, {}, 'no empty hooks shell is left behind');
});

test('import-graph context surfaces imports and importers before any edit history', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-graph-e2e-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.js'), "import { b } from './b';\nexport const a = b + 1;\n");
  writeFileSync(join(root, 'src', 'b.js'), 'export const b = 2;\n');
  run(root, ['init', '--private', '--yes']);

  const contextFor = (name) => {
    const out = run(root, ['capture', '--tool', 'claude'], JSON.stringify({
      hook_event_name: 'PreToolUse',
      cwd: root,
      tool_input: { file_path: join(root, 'src', name) },
    }));
    return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
  };

  const aCtx = contextFor('a.js');
  assert.match(aCtx, /a\.js imports/);
  assert.match(aCtx, /src\/b\.js/);

  const bCtx = contextFor('b.js');
  assert.match(bCtx, /Files that import src\/b\.js/);
  assert.match(bCtx, /src\/a\.js/);
});

test('editing a file updates its import-graph edges', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-graph-upd-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.js'), 'export const a = 1;\n');
  writeFileSync(join(root, 'src', 'b.js'), 'export const b = 2;\n');
  run(root, ['init', '--private', '--yes']);

  writeFileSync(join(root, 'src', 'a.js'), "import { b } from './b';\nexport const a = b;\n");
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({
    hook_event_name: 'PostToolUse',
    cwd: root,
    tool_input: { file_path: join(root, 'src', 'a.js') },
  }));

  const out = run(root, ['capture', '--tool', 'claude'], JSON.stringify({
    hook_event_name: 'PreToolUse',
    cwd: root,
    tool_input: { file_path: join(root, 'src', 'b.js') },
  }));
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /Files that import src\/b\.js/);
  assert.match(ctx, /src\/a\.js/);
});

test('`context <file>` shows the import graph for inspection', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-ctx-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'a.js'), "import { b } from './b';\nexport const a = 1;\n");
  writeFileSync(join(root, 'src', 'b.js'), 'export const b = 2;\n');
  run(root, ['init', '--private', '--yes']);

  const out = run(root, ['context', 'src/b.js']);
  assert.match(out, /Files that import src\/b\.js/);
  assert.match(out, /src\/a\.js/);
});

test('a secret file is never recorded', () => {
  const root = project();
  const secret = join(root, '.env');

  run(root, ['init', '--private', '--yes']);
  writeFileSync(secret, 'API_KEY=super-secret\n');
  run(root, ['capture', '--tool', 'claude'], JSON.stringify({
    hook_event_name: 'PostToolUse',
    cwd: root,
    tool_input: { file_path: secret },
  }));

  const history = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim();
  assert.equal(history, '');
});
