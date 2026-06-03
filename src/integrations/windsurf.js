import { join } from 'node:path';
import { readJson, writeJson } from '../core/jsonfile.js';

const MARKER = 'capture --tool';
const EVENTS = ['post_write_code'];

function hooksPath(root) {
  return join(root, '.windsurf', 'hooks.json');
}

function command(binPath) {
  const node = process.execPath.replace(/\\/g, '/');
  return `"${node}" "${binPath.replace(/\\/g, '/')}" capture --tool windsurf`;
}

function withoutOurs(entries) {
  return (entries || []).filter(
    (h) => ![h.command, h.powershell].some((c) => typeof c === 'string' && c.includes(MARKER)),
  );
}

export function installWindsurf(root, binPath) {
  const path = hooksPath(root);
  const config = readJson(path) || { hooks: {} };
  config.hooks = config.hooks || {};
  const cmd = command(binPath);
  const entry = { command: cmd, powershell: cmd };
  for (const event of EVENTS) {
    config.hooks[event] = [...withoutOurs(config.hooks[event]), entry];
  }
  writeJson(path, config);
  return path;
}

export function uninstallWindsurf(root) {
  const path = hooksPath(root);
  const config = readJson(path);
  if (!config?.hooks) return null;
  for (const event of EVENTS) {
    if (!config.hooks[event]) continue;
    const kept = withoutOurs(config.hooks[event]);
    if (kept.length) config.hooks[event] = kept;
    else delete config.hooks[event];
  }
  writeJson(path, config);
  return path;
}
