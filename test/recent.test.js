import assert from 'node:assert/strict';
import test from 'node:test';
import { renderFileContext, renderRecentMd } from '../src/core/recent.js';

const entry = (file) => ({
  ts: '2026-06-02T10:00:00.000Z',
  tool: 'claude',
  file,
  size: 'minor',
  added: 1,
  removed: 0,
  kinds: [],
  patch: '@@ -0,0 +1,1 @@\n+x',
});

test('global recent lists changed files', () => {
  const md = renderRecentMd([entry('a.js'), entry('b.js')]);
  assert.match(md, /a\.js/);
  assert.match(md, /b\.js/);
});

test('global recent shows what actually changed, not just counts', () => {
  const md = renderRecentMd([entry('a.js')]);
  assert.match(md, /```diff/);
  assert.match(md, /\+x/);
});

test('global recent handles an empty history', () => {
  assert.match(renderRecentMd([]), /No changes recorded yet/);
});

test('file context returns only the requested file', () => {
  const ctx = renderFileContext([entry('a.js'), entry('b.js')], 'a.js');
  assert.match(ctx, /a\.js/);
  assert.doesNotMatch(ctx, /b\.js/);
});

test('file context is empty when the file has no history', () => {
  assert.equal(renderFileContext([entry('a.js')], 'zzz.js'), '');
});
