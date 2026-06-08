# Changelog

All notable changes to ai-log are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[semantic versioning](https://semver.org/).

## [0.4.1] - 2026-06-08

### Added
- `ai-log uninstall --purge` also deletes the `.ai-log` directory, for a clean, complete removal. (To remove the CLI itself, run `npm rm -g @keepuni/ai-log`.)

### Fixed
- `uninstall` no longer leaves empty config husks behind: a settings file, `.mcp.json`, hooks file, or rule file left holding only ai-log's entries is deleted rather than kept as an empty stub.
- The import graph no longer keeps a deleted or renamed file in the import lists of files that referenced it, so the injected context and the MCP `file_history` tool stop pointing at a path that no longer exists.
- `uninstall` now also removes ai-log's leftover Windsurf hook and rule (`.windsurf/hooks.json`, `.windsurfrules`) written by an older version, so upgrading from 0.3 and uninstalling no longer leaves orphaned entries behind.
- The MCP `file_history` tool description now mentions the import-graph neighbors it returns.

### Changed
- The import graph also recognizes `.mts` and `.cts` files.

## [0.4.0] - 2026-06-06

### Added
- Import-graph context. ai-log now builds a lightweight import graph of your JavaScript/TypeScript files (`.ai-log/graph.json`, built at `init` and kept up to date on every edit). Before an agent edits a file, it is shown that file's neighbors — what it imports and what imports it — through the Claude Code injection and the MCP `file_history` tool. This works from the very first edit, before any change history exists.

### Removed
- Windsurf support. Windsurf has been folded into Cognition's Devin and its hook surface is in flux, so the integration is removed for now; it may return once it stabilizes. ai-log continues to support Claude Code and Cursor.

### Fixed
- Runs on all Node >= 18.17: the version is read via `fs` instead of a `with { type: 'json' }` import attribute, which only parses on Node 18.20+.
- The MCP server returns a tool error result instead of crashing if a tool call throws.
- Files whose name starts with `..` are no longer skipped (precise path-escape check).
- The end-of-turn reconcile no longer misses a shell edit made while the previous reconcile was still running: its change cutoff is taken from the scan's start time, not the marker file's modification time.
- `uninstall` no longer leaves an empty `hooks` object behind in the editor's settings; it removes only what ai-log added.
- `init` now baselines the hook, rule, and MCP files it creates, so the first end-of-turn reconcile no longer logs ai-log's own setup as project changes.
- MCP `search_changes` output is ASCII (was a stray em-dash).
- Removed an unused internal export (`isSecretPath`); secret filtering is unchanged.
- `ai-log --help` lists the `mcp` subcommand, and dropped a non-working `-v` check.
- Documentation consistency fixes.

## [0.3.0] - 2026-06-03

### Added
- Windsurf support via Cascade Hooks. `init` installs a `post_write_code` hook (`.windsurf/hooks.json`) for deterministic recording, plus a `.windsurfrules` rule for context. Windsurf hooks cannot inject context back to the agent, so on Windsurf context delivery is rule-based while recording stays deterministic.

## [0.2.0] - 2026-06-03

### Added
- Co-change context: before an agent edits a file, it now also sees the files most often changed alongside it (derived from the change history), so it checks related code first.
- Built-in MCP server for Claude Code (`ai-log mcp`, registered via `.mcp.json`). The agent can query history on demand with three tools: `recent_changes`, `file_history`, and `search_changes`. Hand-written JSON-RPC over stdio — still zero dependencies.

## [0.1.1] - 2026-06-02

### Fixed
- The diff engine no longer allocates a quadratic table for large files, which could exhaust memory and crash the hook. Files above ~3000 lines now use a bounded, linear comparison.
- Re-running `ai-log init` no longer blanks `recent.md` when a history already exists; it is rebuilt from the existing entries.

### Changed
- Clearer install and usage documentation.

## [0.1.0] - 2026-06-02

### Added
- Initial release. Hook-driven change logging for Claude Code and Cursor: records every edit, summarizes recent changes with real diffs in `recent.md`, and feeds the relevant history back to the agent before it edits.
- End-of-turn reconcile pass that catches edits (and deletions) made through the shell.
- Shared or private history storage, secret- and `.gitignore`-aware filtering (including nested `.gitignore`), cross-process locking, atomic writes, and bounded/rotated history.
- Zero runtime dependencies.
