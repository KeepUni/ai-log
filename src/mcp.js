import { neighborsOf, readGraph } from './core/graph.js';
import { findRoot } from './core/paths.js';
import { renderFileContext, renderRecentMd } from './core/recent.js';
import { readEntries, readRecentEntries } from './core/store.js';
import { VERSION } from './index.js';

const PROTOCOL_VERSION = '2025-06-18';
const SEARCH_LIMIT = 30;

const TOOLS = [
  {
    name: 'recent_changes',
    description:
      'Recent changes coding agents made in this project, most recent first, with diffs. Read before editing to avoid undoing or breaking recent work.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'file_history',
    description:
      'Recent ai-log history for one file (with diffs), plus files often changed alongside it. Call before editing that file.',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'Project-relative path, e.g. src/auth.js' } },
      required: ['file'],
    },
  },
  {
    name: 'search_changes',
    description: 'Search the change history for a keyword. Matches file paths and diff contents.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Keyword to look for' } },
      required: ['query'],
    },
  },
];

function line(entry) {
  const kinds = entry.kinds.length ? ` [${entry.kinds.join(', ')}]` : '';
  return `${entry.file} | ${entry.size} +${entry.added}/-${entry.removed}${kinds} @ ${entry.ts}`;
}

function callTool(root, name, args) {
  if (!root) return 'ai-log is not initialized in this project (no .ai-log directory found).';
  if (name === 'recent_changes') return renderRecentMd(readRecentEntries(root));
  if (name === 'file_history') {
    const file = String(args.file || '').replace(/\\/g, '/');
    if (!file) return 'Provide a "file" argument.';
    const neighbors = neighborsOf(readGraph(root), file);
    return renderFileContext(readRecentEntries(root), file, neighbors) || `No recorded changes for ${file}.`;
  }
  if (name === 'search_changes') {
    const query = String(args.query || '').toLowerCase();
    if (!query) return 'Provide a "query" argument.';
    const hits = readEntries(root).filter(
      (e) => e.file.toLowerCase().includes(query) || (e.patch || '').toLowerCase().includes(query),
    );
    if (!hits.length) return `No changes match "${args.query}".`;
    return hits.slice(-SEARCH_LIMIT).reverse().map(line).join('\n');
  }
  return null;
}

function reply(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function fail(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export function handle(request, root) {
  const { id, method, params } = request;
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'ai-log', version: VERSION },
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS });
    case 'tools/call': {
      try {
        const text = callTool(root, params?.name, params?.arguments || {});
        if (text === null) return fail(id, -32602, `Unknown tool: ${params?.name}`);
        return reply(id, { content: [{ type: 'text', text }] });
      } catch (error) {
        return reply(id, { content: [{ type: 'text', text: `ai-log error: ${error.message}` }], isError: true });
      }
    }
    default:
      if (id === undefined) return null;
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

export function serve() {
  const root = findRoot(process.cwd());
  let buffer = '';
  process.stdin.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const raw = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!raw) continue;
      let request;
      try {
        request = JSON.parse(raw);
      } catch {
        continue;
      }
      const response = handle(request, root);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}
