import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { extractImports, fileEdges, neighborsOf } from '../src/core/graph.js';

test('extractImports finds import/require/dynamic/side-effect specifiers', () => {
  const src = [
    "import { a } from './a';",
    "export { b } from './b.js';",
    "const c = require('../c');",
    "const d = await import('./d');",
    "import './side-effect';",
    "import x from 'react';",
  ].join('\n');
  const specs = extractImports(src);
  for (const s of ['./a', './b.js', '../c', './d', './side-effect', 'react']) {
    assert.ok(specs.includes(s), `expected to find ${s}`);
  }
});

test('fileEdges resolves relative imports to project files and skips bare ones', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-graph-'));
  mkdirSync(join(root, 'src', 'util'), { recursive: true });
  writeFileSync(join(root, 'src', 'b.ts'), 'export const y = 1;\n');
  writeFileSync(join(root, 'src', 'util', 'index.js'), 'export const x = 1;\n');

  const content = "import { x } from './util';\nimport y from './b';\nimport 'react';\n";
  writeFileSync(join(root, 'src', 'a.js'), content);

  assert.deepEqual(fileEdges(root, 'src/a.js', content).sort(), ['src/b.ts', 'src/util/index.js']);
});

test('fileEdges ignores non-source files and out-of-root specifiers', () => {
  const root = mkdtempSync(join(tmpdir(), 'ailog-graph-'));
  assert.deepEqual(fileEdges(root, 'a.js', "import '../../escape';\n"), []);
  assert.deepEqual(fileEdges(root, 'notes.md', "import './a';\n"), []);
});

test('neighborsOf returns a file\'s imports and its reverse importers', () => {
  const graph = { 'src/a.js': ['src/b.js'], 'src/c.js': ['src/b.js'], 'src/b.js': ['src/d.js'] };
  const n = neighborsOf(graph, 'src/b.js');
  assert.deepEqual(n.imports, ['src/d.js']);
  assert.deepEqual(n.importedBy.sort(), ['src/a.js', 'src/c.js']);
});
