import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ALWAYS_IGNORE = ['.git', 'node_modules', '.ai-log'];

const SECRET_PATTERNS = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.keystore',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '*.secret',
];

function toPosix(relPath) {
  return relPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function compile(pattern) {
  let p = pattern.trim();
  let anchored = false;
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (p.startsWith('/')) {
    anchored = true;
    p = p.slice(1);
  }
  let body = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        body += '.*';
        i++;
        if (p[i + 1] === '/') i++;
      } else {
        body += '[^/]*';
      }
    } else if (c === '?') {
      body += '[^/]';
    } else {
      body += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  const prefix = anchored || p.includes('/') ? '^' : '(^|.*/)';
  return new RegExp(`${prefix}${body}(/.*)?$`);
}

function parseGitignore(root) {
  let raw;
  try {
    raw = readFileSync(join(root, '.gitignore'), 'utf8');
  } catch {
    return [];
  }
  const rules = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const negate = trimmed.startsWith('!');
    const pattern = negate ? trimmed.slice(1) : trimmed;
    rules.push({ regex: compile(pattern), negate });
  }
  return rules;
}

export function createIgnore(root) {
  const hard = [...ALWAYS_IGNORE, ...SECRET_PATTERNS].map((p) => compile(p));
  const cache = new Map();

  function rulesFor(dirRel) {
    let rules = cache.get(dirRel);
    if (!rules) {
      rules = parseGitignore(dirRel ? join(root, ...dirRel.split('/')) : root);
      cache.set(dirRel, rules);
    }
    return rules;
  }

  function isIgnored(relPath) {
    const path = toPosix(relPath);
    if (hard.some((re) => re.test(path))) return true;

    const parts = path.split('/');
    const dirs = [''];
    for (let i = 0; i < parts.length - 1; i++) dirs.push(parts.slice(0, i + 1).join('/'));

    let ignored = false;
    for (const dir of dirs) {
      const sub = dir === '' ? path : path.slice(dir.length + 1);
      for (const rule of rulesFor(dir)) {
        if (rule.regex.test(sub)) ignored = !rule.negate;
      }
    }
    return ignored;
  }

  return { isIgnored };
}
