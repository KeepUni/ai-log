import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { writeFileAtomic } from './atomic.js';
import { aiLogPaths } from './paths.js';

export const MAX_FILE_BYTES = 512 * 1024;

export function relPathOf(root, absPath) {
  const rel = relative(root, absPath);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

function isBinary(buffer) {
  const limit = Math.min(buffer.length, 8000);
  for (let i = 0; i < limit; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export function readFileState(absPath) {
  if (!existsSync(absPath)) return { exists: false, content: '', binary: false, tooLarge: false };
  const buffer = readFileSync(absPath);
  if (buffer.length > MAX_FILE_BYTES) return { exists: true, content: '', binary: false, tooLarge: true };
  if (isBinary(buffer)) return { exists: true, content: '', binary: true, tooLarge: false };
  const decoded = buffer.toString('utf8');
  if (decoded.includes('�')) return { exists: true, content: '', binary: true, tooLarge: false };
  const content = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;
  return { exists: true, content, binary: false, tooLarge: false };
}

function snapshotPath(root, relPath) {
  return join(aiLogPaths(root).snapshots, ...relPath.split('/'));
}

export function walkFiles(root, ignore, onFile) {
  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const abs = join(dir, entry.name);
      const rel = relPathOf(root, abs);
      if (!rel || ignore.isIgnored(rel)) continue;
      if (entry.isDirectory()) visit(abs);
      else if (entry.isFile()) onFile(abs, rel);
    }
  };
  visit(root);
}

export function readSnapshot(root, relPath) {
  const path = snapshotPath(root, relPath);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function writeSnapshot(root, relPath, content) {
  const path = snapshotPath(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, content);
}

export function removeSnapshot(root, relPath) {
  try {
    rmSync(snapshotPath(root, relPath));
  } catch {
    // already gone
  }
}

export function listSnapshots(root) {
  const base = aiLogPaths(root).snapshots;
  const out = [];
  const visit = (dir, prefix) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(dir, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  visit(base, '');
  return out;
}
