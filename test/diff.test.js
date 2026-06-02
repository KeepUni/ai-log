import assert from 'node:assert/strict';
import test from 'node:test';
import { diffLines } from '../src/core/diff.js';

test('adds every line for brand-new content', () => {
  const d = diffLines('', 'a\nb\nc');
  assert.equal(d.added, 3);
  assert.equal(d.removed, 0);
  assert.equal(d.changed, 3);
});

test('removes every line when content is cleared', () => {
  const d = diffLines('a\nb', '');
  assert.equal(d.added, 0);
  assert.equal(d.removed, 2);
});

test('a single changed line counts as one add and one remove', () => {
  const d = diffLines('a\nb\nc', 'a\nB\nc');
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  assert.match(d.patch, /-b/);
  assert.match(d.patch, /\+B/);
});

test('identical content produces no diff', () => {
  const d = diffLines('x\ny', 'x\ny');
  assert.equal(d.changed, 0);
  assert.equal(d.patch, '');
});
