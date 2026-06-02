import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { appendEntry, readEntries, rotateHistory } from '../src/core/store.js';

const bin = fileURLToPath(new URL('../bin/ai-log.js', import.meta.url));

test('a newly created file is logged compactly, without a full diff', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-vol-'));
  mkdirSync(join(root, 'src'));
  execFileSync('node', [bin, 'init', '--private', '--yes'], { cwd: root, encoding: 'utf8' });

  const file = join(root, 'src', 'big.js');
  writeFileSync(file, Array.from({ length: 200 }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n');
  execFileSync('node', [bin, 'capture', '--tool', 'claude'], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: root, tool_input: { file_path: file } }),
  });

  const entry = JSON.parse(readFileSync(join(root, '.ai-log', 'history.jsonl'), 'utf8').trim());
  assert.equal(entry.created, true);
  assert.equal(entry.patch, '', 'a creation stores no full diff');
  assert.ok(entry.added >= 200);
  assert.match(readFileSync(join(root, '.ai-log', 'recent.md'), 'utf8'), /created, 20\d lines/);
});

test('rotateHistory trims past the cap but keeps the newest entries intact', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-rot-'));
  mkdirSync(join(root, '.ai-log'), { recursive: true });
  for (let i = 0; i < 3000; i++) appendEntry(root, { file: `f${i}.js`, blob: 'x'.repeat(300) });

  const before = statSync(join(root, '.ai-log', 'history.jsonl')).size;
  rotateHistory(root, 200 * 1024, 100 * 1024);
  const after = statSync(join(root, '.ai-log', 'history.jsonl')).size;

  assert.ok(after < before);
  assert.ok(after <= 100 * 1024);
  const entries = readEntries(root);
  assert.equal(entries[entries.length - 1].file, 'f2999.js', 'newest entry survives');
  for (const entry of entries) assert.equal(typeof entry.file, 'string', 'no corrupt/partial line');
});
