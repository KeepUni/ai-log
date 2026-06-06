import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readFileState, relPathOf } from '../src/core/snapshots.js';

function tmpFile(name, bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'ailog-snap-'));
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

test('reads a text file', () => {
  const state = readFileState(tmpFile('a.txt', 'hello\nworld\n'));
  assert.equal(state.exists, true);
  assert.equal(state.binary, false);
  assert.equal(state.content, 'hello\nworld\n');
});

test('detects a binary file with a NUL byte', () => {
  const state = readFileState(tmpFile('a.bin', Buffer.from([0x00, 0x01, 0x02])));
  assert.equal(state.binary, true);
  assert.equal(state.content, '');
});

test('detects a binary file with no NUL but invalid UTF-8', () => {
  const state = readFileState(tmpFile('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x09])));
  assert.equal(state.binary, true);
  assert.equal(state.content, '');
});

test('strips a leading UTF-8 BOM from file content', () => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('hello\nworld\n')]);
  const state = readFileState(tmpFile('bom.txt', bytes));
  assert.equal(state.binary, false);
  assert.equal(state.content, 'hello\nworld\n');
});

test('reports a missing file', () => {
  const state = readFileState(join(tmpdir(), 'ailog-does-not-exist-xyz'));
  assert.equal(state.exists, false);
});

test('relPathOf keeps in-root paths (incl. names starting with ..) and rejects escapes', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-rel-'));
  assert.equal(relPathOf(root, join(root, 'src', 'a.js')), 'src/a.js');
  assert.equal(relPathOf(root, join(root, '..weird.txt')), '..weird.txt');
  assert.equal(relPathOf(root, join(root, '..', 'outside.js')), null);
});
