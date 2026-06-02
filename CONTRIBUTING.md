# Contributing to ai-log

Thanks for helping improve ai-log. It is a small, dependency-free Node.js CLI, so getting started is quick.

## Setup

```bash
git clone https://github.com/KeepUni/ai-log
cd ai-log
npm link   # exposes the `ai-log` command for local testing
```

There is nothing to install — ai-log has **zero runtime dependencies**.

## Running tests

```bash
node --test
```

Tests use the built-in `node:test` runner (no framework). CI runs them on Linux, macOS, and Windows across Node 18, 20, and 22.

## Project layout

```
bin/            CLI entry point
src/cli.js      command routing
src/commands/   init, capture, status, context, uninstall
src/core/       diff, classify, ignore, snapshots, store, recent, lock, atomic, paths
src/integrations/  claude, cursor, rules
test/           node:test suites
```

`capture` is the hook-driven workhorse: editors call it on every edit (record), before edits (inject context), and at end of turn (reconcile the working tree). Diffs are computed against ai-log's own snapshots in `.ai-log/snapshots/`.

## Code style

- No runtime dependencies. Keep it that way unless there is a compelling reason.
- Clean, self-documenting code. Comments only where the code genuinely needs them.
- Add a test for any behavior change.

## Submitting changes

1. Branch from `main`.
2. Make the change with a test.
3. Ensure `node --test` is green.
4. Open a pull request describing the what and the why.
