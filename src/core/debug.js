import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let enabled = Boolean(process.env.AILOG_DEBUG);

export function setDebug(on) {
  enabled = enabled || Boolean(on);
}

export function debug(root, message) {
  if (!enabled) return;
  const file = root ? join(root, '.ai-log', 'debug.log') : join(tmpdir(), 'ai-log-debug.log');
  try {
    appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // debugging must never break the host tool either
  }
}
