# Changelog

All notable changes to ai-log are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[semantic versioning](https://semver.org/).

## [0.2.0] - 2026-06-02

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
