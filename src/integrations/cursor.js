import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from '../core/jsonfile.js';

const MARKER = 'capture --tool';
const EVENTS = ['afterFileEdit', 'sessionStart', 'stop'];

function hooksPath(root) {
  return join(root, '.cursor', 'hooks.json');
}

function command(binPath, debug) {
  const node = process.execPath.replace(/\\/g, '/');
  const bin = binPath.replace(/\\/g, '/');
  return `"${node}" "${bin}" capture --tool cursor${debug ? ' --debug' : ''}`;
}

function withoutOurs(entries) {
  return (entries || []).filter((h) => !(typeof h.command === 'string' && h.command.includes(MARKER)));
}

export function installCursor(root, binPath, debug) {
  const path = hooksPath(root);
  const config = readJson(path) || { version: 1, hooks: {} };
  config.version = config.version || 1;
  config.hooks = config.hooks || {};
  const entry = { type: 'command', command: command(binPath, debug) };

  for (const event of EVENTS) {
    config.hooks[event] = [...withoutOurs(config.hooks[event]), entry];
  }

  writeJson(path, config);
  return path;
}

export function uninstallCursor(root) {
  const path = hooksPath(root);
  const config = readJson(path);
  if (!config?.hooks) return null;
  for (const event of EVENTS) {
    if (!config.hooks[event]) continue;
    const kept = withoutOurs(config.hooks[event]);
    if (kept.length) config.hooks[event] = kept;
    else delete config.hooks[event];
  }
  if (Object.keys(config.hooks).length === 0) delete config.hooks;
  const keys = Object.keys(config);
  if (keys.length === 0 || (keys.length === 1 && keys[0] === 'version')) rmSync(path);
  else writeJson(path, config);
  return path;
}
