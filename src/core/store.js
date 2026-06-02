import { appendFileSync, closeSync, fstatSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { writeFileAtomic } from './atomic.js';
import { aiLogPaths } from './paths.js';

const TAIL_BYTES = 512 * 1024;
const MAX_HISTORY_BYTES = 5 * 1024 * 1024;
const KEEP_HISTORY_BYTES = 2 * 1024 * 1024;

export function appendEntry(root, entry) {
  appendFileSync(aiLogPaths(root).history, `${JSON.stringify(entry)}\n`);
}

function parseLines(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // a corrupt line never blocks the rest of the history
    }
  }
  return entries;
}

export function readRecentEntries(root, maxBytes = TAIL_BYTES) {
  let fd;
  try {
    fd = openSync(aiLogPaths(root).history, 'r');
  } catch {
    return [];
  }
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - start);
    readSync(fd, buffer, 0, buffer.length, start);
    let text = buffer.toString('utf8');
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    return parseLines(text);
  } finally {
    closeSync(fd);
  }
}

export function readEntries(root) {
  try {
    return parseLines(readFileSync(aiLogPaths(root).history, 'utf8'));
  } catch {
    return [];
  }
}

export function rotateHistory(root, maxBytes = MAX_HISTORY_BYTES, keepBytes = KEEP_HISTORY_BYTES) {
  const path = aiLogPaths(root).history;
  let size;
  try {
    size = statSync(path).size;
  } catch {
    return;
  }
  if (size <= maxBytes) return;

  const fd = openSync(path, 'r');
  let text;
  try {
    const buffer = Buffer.alloc(keepBytes);
    readSync(fd, buffer, 0, keepBytes, size - keepBytes);
    text = buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
  writeFileAtomic(path, text.slice(text.indexOf('\n') + 1));
}
