import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const bin = fileURLToPath(new URL('../bin/ai-log.js', import.meta.url));

function run(cwd, args, input) {
  return execFileSync('node', [bin, ...args], { cwd, input, encoding: 'utf8' });
}

function project() {
  const root = mkdtempSync(join(tmpdir(), 'ailog-x-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'app.js'), 'const a = 1;\nconst b = 2;\n');
  return root;
}

const payloads = {
  claude: (root, file) => ({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { file_path: file } }),
  cursor: (root, file) => ({ hook_event_name: 'afterFileEdit', workspace_roots: [root], file_path: file }),
};

for (const [tool, payload] of Object.entries(payloads)) {
  test(`records an edit coming from ${tool}`, () => {
    const root = project();
    const file = join(root, 'src', 'app.js');
    run(root, ['init', '--private', `--${tool}`, '--yes']);

    writeFileSync(file, 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
    run(root, ['capture', '--tool', tool], JSON.stringify(payload(root, file)));

    const entry = JSON.parse(readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim().split('\n').pop());
    assert.equal(entry.file, 'src/app.js');
    assert.equal(entry.tool, tool);
    assert.equal(entry.added, 1);
    assert.equal(entry.removed, 0);
  });
}

test('default init installs both tools', () => {
  const root = project();
  run(root, ['init', '--private', '--yes']);
  assert.ok(readFileSync(join(root, '.claude', 'settings.json'), 'utf8').includes('capture --tool claude'));
  assert.ok(readFileSync(join(root, '.cursor', 'hooks.json'), 'utf8').includes('capture --tool cursor'));
});
