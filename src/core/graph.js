import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { writeFileAtomic } from './atomic.js';
import { aiLogPaths } from './paths.js';

const SOURCE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

const SPEC_RES = [
  /\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /(?:^|\n)\s*import\s+['"]([^'"\n]+)['"]/g,
];

function isSource(relPath) {
  return SOURCE_EXTS.some((ext) => relPath.endsWith(ext));
}

function isFile(root, relPath) {
  try {
    return statSync(join(root, ...relPath.split('/'))).isFile();
  } catch {
    return false;
  }
}

export function extractImports(content) {
  const specs = new Set();
  for (const re of SPEC_RES) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) specs.add(match[1]);
  }
  return [...specs];
}

function resolveSpec(root, fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const target = posix.normalize(posix.join(posix.dirname(fromRel), spec));
  if (target === '..' || target.startsWith('../')) return null;
  if (isFile(root, target)) return target;
  for (const ext of SOURCE_EXTS) if (isFile(root, target + ext)) return target + ext;
  for (const ext of SOURCE_EXTS) if (isFile(root, posix.join(target, `index${ext}`))) return posix.join(target, `index${ext}`);
  return null;
}

export function fileEdges(root, fromRel, content) {
  if (!isSource(fromRel)) return [];
  const out = new Set();
  for (const spec of extractImports(content)) {
    const resolved = resolveSpec(root, fromRel, spec);
    if (resolved && resolved !== fromRel) out.add(resolved);
  }
  return [...out];
}

export function updateNode(graph, root, relPath, content) {
  const edges = fileEdges(root, relPath, content);
  if (edges.length) graph[relPath] = edges;
  else delete graph[relPath];
}

export function removeNode(graph, relPath) {
  delete graph[relPath];
  for (const [from, edges] of Object.entries(graph)) {
    const at = edges.indexOf(relPath);
    if (at === -1) continue;
    edges.splice(at, 1);
    if (!edges.length) delete graph[from];
  }
}

export function neighborsOf(graph, file) {
  const importedBy = [];
  for (const [from, edges] of Object.entries(graph)) {
    if (from !== file && edges.includes(file)) importedBy.push(from);
  }
  return { imports: graph[file] ? [...graph[file]] : [], importedBy };
}

export function readGraph(root) {
  try {
    return JSON.parse(readFileSync(aiLogPaths(root).graph, 'utf8')) || {};
  } catch {
    return {};
  }
}

export function writeGraph(root, graph) {
  writeFileAtomic(aiLogPaths(root).graph, JSON.stringify(graph));
}
