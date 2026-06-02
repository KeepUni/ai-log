import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeFileAtomic } from '../src/core/atomic.js';

test('writeFileAtomic writes the full content and leaves no temp file behind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ailog-atomic-'));
  const path = join(dir, 'out.txt');
  writeFileAtomic(path, 'hello world');
  assert.equal(readFileSync(path, 'utf8'), 'hello world');
  assert.deepEqual(readdirSync(dir), ['out.txt']);
});

test('writeFileAtomic overwrites an existing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ailog-atomic-'));
  const path = join(dir, 'out.txt');
  writeFileAtomic(path, 'first');
  writeFileAtomic(path, 'second');
  assert.equal(readFileSync(path, 'utf8'), 'second');
  assert.deepEqual(readdirSync(dir), ['out.txt']);
});
