import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { createIgnore } from '../core/ignore.js';
import { writeJson } from '../core/jsonfile.js';
import { aiLogPaths } from '../core/paths.js';
import { renderRecentMd } from '../core/recent.js';
import { updateNode, writeGraph } from '../core/graph.js';
import { readFileState, relPathOf, walkFiles, writeSnapshot } from '../core/snapshots.js';
import { readRecentEntries } from '../core/store.js';
import { installClaude, installClaudeMcp } from '../integrations/claude.js';
import { installCursor } from '../integrations/cursor.js';
import { installClaudeRule, installCursorRule } from '../integrations/rules.js';
import { VERSION } from '../index.js';

const binPath = fileURLToPath(new URL('../../bin/ai-log.js', import.meta.url));

const GITIGNORE = {
  private: '*\n',
  shared: 'snapshots/\nrecent.md\ndebug.log\n.lock/\n.reconcile\ngraph.json\n',
};

function snapshotTree(root) {
  let count = 0;
  const graph = {};
  walkFiles(root, createIgnore(root), (abs, rel) => {
    const state = readFileState(abs);
    if (state.exists && !state.binary && !state.tooLarge) {
      writeSnapshot(root, rel, state.content);
      updateNode(graph, root, rel, state.content);
      count++;
    }
  });
  writeGraph(root, graph);
  return count;
}

function baselineInstalled(root, files) {
  for (const abs of files) {
    const rel = relPathOf(root, abs);
    if (!rel) continue;
    const state = readFileState(abs);
    if (state.exists && !state.binary && !state.tooLarge) writeSnapshot(root, rel, state.content);
  }
}

async function resolveStorage(options) {
  if (options.private) return 'private';
  if (options.shared) return 'shared';
  if (options.yes || !process.stdin.isTTY) return 'private';
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    'Track the change history in git?\n  shared  — commit it so your team and future sessions share the memory\n  private — keep it on this machine only (.ai-log is gitignored)\nChoice [private]: ',
  );
  rl.close();
  return answer.trim().toLowerCase().startsWith('s') ? 'shared' : 'private';
}

function resolveTools(options) {
  const picked = ['claude', 'cursor'].filter((tool) => options[tool]);
  return picked.length ? picked : ['claude', 'cursor'];
}

export async function init(options) {
  const root = process.cwd();
  const paths = aiLogPaths(root);
  const reinit = existsSync(paths.base);

  const storage = await resolveStorage(options);
  const tools = resolveTools(options);

  mkdirSync(paths.snapshots, { recursive: true });
  if (!existsSync(paths.history)) writeFileSync(paths.history, '');
  writeFileSync(paths.recent, renderRecentMd(readRecentEntries(root)));
  writeFileSync(paths.gitignore, GITIGNORE[storage]);
  writeJson(paths.config, {
    version: VERSION,
    createdAt: new Date().toISOString(),
    storage,
    tools,
  });

  const snapshots = snapshotTree(root);

  const installed = [];
  if (tools.includes('claude')) {
    installed.push(['Claude Code hooks', installClaude(root, binPath, options.debug)]);
    installed.push(['Claude Code rule', installClaudeRule(root)]);
    installed.push(['Claude Code MCP', installClaudeMcp(root, binPath)]);
  }
  if (tools.includes('cursor')) {
    installed.push(['Cursor hooks', installCursor(root, binPath, options.debug)]);
    installed.push(['Cursor rule', installCursorRule(root)]);
  }

  baselineInstalled(root, installed.map(([, file]) => file));

  const out = [];
  out.push(`${reinit ? 'Re-initialized' : 'Initialized'} ai-log in ${paths.base}`);
  out.push(`  history:   ${storage} (${storage === 'shared' ? 'committed to git' : 'gitignored, local only'})`);
  out.push(`  baseline:  ${snapshots} file${snapshots === 1 ? '' : 's'} snapshotted`);
  for (const [name, file] of installed) out.push(`  ${name}: ${file}`);
  out.push('');
  out.push('Hooks log every edit your agent makes; the rule tells it to read .ai-log/recent.md before editing.');
  out.push('Restart your agent session to load both.');
  console.log(out.join('\n'));
}
