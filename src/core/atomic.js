import { renameSync, writeFileSync } from 'node:fs';

export function writeFileAtomic(path, data) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}
