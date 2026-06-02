import { capture } from './commands/capture.js';
import { context } from './commands/context.js';
import { init } from './commands/init.js';
import { status } from './commands/status.js';
import { uninstall } from './commands/uninstall.js';
import { VERSION } from './index.js';

const HELP = `ai-log ${VERSION} — a reliable change log for AI coding agents

Usage:
  ai-log init [--shared|--private] [--claude] [--cursor] [--yes]
  ai-log status
  ai-log context [file]
  ai-log uninstall
  ai-log capture --tool <claude|cursor>   (called by editor hooks)

Commands:
  init        Set up .ai-log and install hooks for your AI tools
  status      Show what has been recorded so far
  context     Print the recent history (optionally for one file)
  uninstall   Remove the hooks ai-log installed (keeps the history)
  capture     Record an edit or inject context; driven by hooks, not by hand`;

function parse(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

export async function run(argv) {
  const { positionals, flags } = parse(argv);

  if (flags.version || flags.v || positionals[0] === 'version') {
    console.log(VERSION);
    return;
  }

  switch (positionals[0]) {
    case 'init':
      return init(flags);
    case 'capture':
      return capture({ tool: flags.tool, debug: flags.debug });
    case 'status':
      return status();
    case 'context':
      return context(positionals[1]);
    case 'uninstall':
      return uninstall();
    default:
      console.log(HELP);
  }
}
