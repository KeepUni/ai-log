import { join } from 'node:path';
import { readJson, writeJson } from '../core/jsonfile.js';

const MARKER = 'capture --tool';
const MATCHER = 'Write|Edit|MultiEdit';
const EVENTS = ['PreToolUse', 'PostToolUse', 'SessionStart', 'Stop'];

function settingsPath(root) {
  return join(root, '.claude', 'settings.json');
}

function command(binPath, debug) {
  const node = process.execPath.replace(/\\/g, '/');
  const bin = binPath.replace(/\\/g, '/');
  return `"${node}" "${bin}" capture --tool claude${debug ? ' --debug' : ''}`;
}

function withoutOurs(groups) {
  return (groups || []).filter(
    (group) => !(group.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes(MARKER)),
  );
}

export function installClaude(root, binPath, debug) {
  const path = settingsPath(root);
  const settings = readJson(path) || {};
  settings.hooks = settings.hooks || {};
  const cmd = command(binPath, debug);
  const group = (matcher) => ({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command: cmd }] });

  settings.hooks.PreToolUse = [...withoutOurs(settings.hooks.PreToolUse), group(MATCHER)];
  settings.hooks.PostToolUse = [...withoutOurs(settings.hooks.PostToolUse), group(MATCHER)];
  settings.hooks.SessionStart = [...withoutOurs(settings.hooks.SessionStart), group(null)];
  settings.hooks.Stop = [...withoutOurs(settings.hooks.Stop), group(null)];

  writeJson(path, settings);
  return path;
}

export function uninstallClaude(root) {
  const path = settingsPath(root);
  const settings = readJson(path);
  if (!settings?.hooks) return null;
  for (const event of EVENTS) {
    if (!settings.hooks[event]) continue;
    const kept = withoutOurs(settings.hooks[event]);
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }
  writeJson(path, settings);
  return path;
}

export function installClaudeMcp(root, binPath) {
  const path = join(root, '.mcp.json');
  const config = readJson(path) || {};
  config.mcpServers = config.mcpServers || {};
  config.mcpServers['ai-log'] = {
    type: 'stdio',
    command: process.execPath.replace(/\\/g, '/'),
    args: [binPath.replace(/\\/g, '/'), 'mcp'],
  };
  writeJson(path, config);
  return path;
}

export function uninstallClaudeMcp(root) {
  const path = join(root, '.mcp.json');
  const config = readJson(path);
  if (!config?.mcpServers?.['ai-log']) return null;
  delete config.mcpServers['ai-log'];
  writeJson(path, config);
  return path;
}
