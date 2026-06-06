import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createIgnore } from '../src/core/ignore.js';

test('ignores defaults, secrets, and .gitignore patterns', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-'));
  writeFileSync(join(root, '.gitignore'), '*.log\nbuild/\n');
  const ignore = createIgnore(root);

  assert.equal(ignore.isIgnored('node_modules/x.js'), true);
  assert.equal(ignore.isIgnored('.git/config'), true);
  assert.equal(ignore.isIgnored('.ai-log/recent.md'), true);
  assert.equal(ignore.isIgnored('.env'), true);
  assert.equal(ignore.isIgnored('secrets/server.key'), true);
  assert.equal(ignore.isIgnored('src/app.log'), true);
  assert.equal(ignore.isIgnored('build/out.js'), true);

  assert.equal(ignore.isIgnored('src/app.js'), false);
});

test('respects gitignore negation', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-'));
  writeFileSync(join(root, '.gitignore'), 'dist/\n!dist/keep.js\n');
  const ignore = createIgnore(root);
  assert.equal(ignore.isIgnored('dist/bundle.js'), true);
  assert.equal(ignore.isIgnored('dist/keep.js'), false);
});

test('respects nested .gitignore files', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-'));
  writeFileSync(join(root, '.gitignore'), '*.log\n');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', '.gitignore'), 'tmp/\n');
  const ignore = createIgnore(root);

  assert.equal(ignore.isIgnored('src/app.log'), true, 'root rule applies to subpaths');
  assert.equal(ignore.isIgnored('src/tmp/x.js'), true, 'nested rule applies under its dir');
  assert.equal(ignore.isIgnored('tmp/x.js'), false, 'nested rule is scoped to its dir');
  assert.equal(ignore.isIgnored('src/keep.js'), false);
});
