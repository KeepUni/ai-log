import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appendEntry } from '../src/core/store.js';
import { handle } from '../src/mcp.js';

function root() {
  const r = mkdtempSync(join(tmpdir(), 'ailog-mcp-'));
  mkdirSync(join(r, '.ai-log'), { recursive: true });
  appendEntry(r, {
    ts: '2026-06-02T10:00:00.000Z',
    tool: 'claude',
    file: 'src/auth.js',
    size: 'minor',
    added: 2,
    removed: 1,
    kinds: ['signature'],
    patch: '@@ -1 +1 @@\n-old\n+new login',
  });
  return r;
}

test('initialize advertises the ai-log server and tools capability', () => {
  const res = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, root());
  assert.equal(res.result.serverInfo.name, 'ai-log');
  assert.ok(res.result.capabilities.tools);
  assert.equal(res.result.protocolVersion, '2025-06-18');
});

test('tools/list returns the three history tools', () => {
  const res = handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, root());
  assert.deepEqual(res.result.tools.map((t) => t.name).sort(), ['file_history', 'recent_changes', 'search_changes']);
});

test('tools/call recent_changes returns recorded changes', () => {
  const res = handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'recent_changes', arguments: {} } }, root());
  assert.match(res.result.content[0].text, /src\/auth\.js/);
});

test('tools/call file_history returns history for a file', () => {
  const res = handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'file_history', arguments: { file: 'src/auth.js' } } }, root());
  assert.match(res.result.content[0].text, /src\/auth\.js/);
});

test('tools/call search_changes finds matches in diffs', () => {
  const res = handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'search_changes', arguments: { query: 'login' } } }, root());
  assert.match(res.result.content[0].text, /src\/auth\.js/);
});

test('an unknown tool returns a JSON-RPC error', () => {
  const res = handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope', arguments: {} } }, root());
  assert.equal(res.error.code, -32602);
});

test('a notification yields no response', () => {
  assert.equal(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, root()), null);
});
