import assert from 'node:assert/strict';
import test from 'node:test';
import { classify, sizeOf } from '../src/core/classify.js';

test('size thresholds follow minor/medium/major', () => {
  assert.equal(sizeOf(5), 'minor');
  assert.equal(sizeOf(10), 'medium');
  assert.equal(sizeOf(100), 'medium');
  assert.equal(sizeOf(101), 'major');
});

test('detects a dependency change in package.json', () => {
  const r = classify({ added: 1, removed: 0, patch: '+    "left-pad": "1.0.0"', file: 'package.json' });
  assert.ok(r.kinds.includes('dependency'));
});

test('detects imports and pure deletions', () => {
  const r = classify({ added: 0, removed: 2, patch: '-import x from "y"\n-const z = 1', file: 'src/a.js' });
  assert.ok(r.kinds.includes('imports'));
  assert.ok(r.kinds.includes('deletion'));
});

test('detects a changed function signature', () => {
  const r = classify({ added: 1, removed: 1, patch: '-function run(a)\n+function run(a, b)', file: 'src/a.js' });
  assert.ok(r.kinds.includes('signature'));
});
