import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const bin = fileURLToPath(new URL('../bin/ai-log.js', import.meta.url));

function captureAsync(root, file) {
  return new Promise((resolve) => {
    const child = spawn('node', [bin, 'capture', '--tool', 'claude'], { cwd: root });
    child.on('close', resolve);
    child.stdin.end(JSON.stringify({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { file_path: file } }));
  });
}

test('concurrent captures never interleave or corrupt the history', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-conc-'));
  mkdirSync(join(root, 'src'));
  execFileSync('node', [bin, 'init', '--private', '--yes'], { cwd: root, encoding: 'utf8' });

  const count = 8;
  const pending = [];
  for (let i = 0; i < count; i++) {
    const file = join(root, 'src', `f${i}.js`);
    writeFileSync(file, `export const v${i} = ${i};\nexport const w${i} = ${i + 1};\n`);
    pending.push(captureAsync(root, file));
  }
  await Promise.all(pending);

  const lines = readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, count, 'every concurrent edit should produce exactly one entry');
  const files = lines.map((line) => JSON.parse(line).file).sort();
  assert.deepEqual(files, Array.from({ length: count }, (_, i) => `src/f${i}.js`).sort());

  const recent = readFileSync(join(root, '.ai-log', 'recent.md'), 'utf8');
  assert.match(recent, /recent changes/);
});
