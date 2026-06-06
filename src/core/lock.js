import { mkdirSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { aiLogPaths } from './paths.js';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function withLock(root, fn, { retries = 100, delayMs = 15, staleMs = 10000 } = {}) {
  const lockDir = join(aiLogPaths(root).base, '.lock');
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      mkdirSync(lockDir);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > staleMs) rmdirSync(lockDir);
      } catch {
        // the holder released it between our stat and rmdir; just retry
      }
      sleep(delayMs);
      continue;
    }
    try {
      return fn();
    } finally {
      try {
        rmdirSync(lockDir);
      } catch {
        // already gone (e.g. reclaimed as stale); nothing to do
      }
    }
  }
  // lock stayed contended past every retry; run anyway rather than hang the editor
  return fn();
}
