import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
