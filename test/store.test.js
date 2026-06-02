import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appendEntry, readEntries, readRecentEntries } from '../src/core/store.js';

function tmpRoot() {
  const root = mkdtempSync(join(tmpdir(), 'ailog-store-'));
  mkdirSync(join(root, '.ai-log'), { recursive: true });
  return root;
}

test('readRecentEntries returns the newest entries within the byte budget', () => {
  const root = tmpRoot();
  for (let i = 0; i < 1000; i++) appendEntry(root, { file: `f${i}.js`, n: i });

  const recent = readRecentEntries(root, 4096);
  assert.ok(recent.length > 0 && recent.length < 1000, 'budget should bound the result');
  assert.equal(recent[recent.length - 1].file, 'f999.js', 'newest entry must be present');
  for (const entry of recent) assert.equal(typeof entry.file, 'string', 'no partial line should slip through');
});

test('readRecentEntries returns everything when the budget exceeds the file', () => {
  const root = tmpRoot();
  for (let i = 0; i < 5; i++) appendEntry(root, { file: `f${i}.js` });
  const all = readRecentEntries(root);
  assert.equal(all.length, 5);
  assert.equal(all[0].file, 'f0.js');
});

test('readEntries returns the full history in order', () => {
  const root = tmpRoot();
  for (let i = 0; i < 3; i++) appendEntry(root, { file: `f${i}.js` });
  assert.deepEqual(readEntries(root).map((e) => e.file), ['f0.js', 'f1.js', 'f2.js']);
});
