<div align="center">

# ai-log

**A reliable change log for AI coding agents.**

AI writes code fast — then forgets what it did and breaks what it just fixed.
ai-log keeps an accurate, compact record of every change and feeds the relevant history back to the agent *before* its next edit.

[![npm version](https://img.shields.io/npm/v/@keepuni/ai-log.svg)](https://www.npmjs.com/package/@keepuni/ai-log)
[![node](https://img.shields.io/node/v/@keepuni/ai-log.svg)](https://nodejs.org)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![license](https://img.shields.io/npm/l/@keepuni/ai-log.svg)](LICENSE)

[Quick start](#quick-start) · [How it works](#how-it-works) · [Setup](#per-tool-setup) · [Storage](#storage-shared-vs-private) · [Commands](#commands) · [Changelog](CHANGELOG.md)

</div>

---

- **Zero runtime dependencies.** Installing ai-log pulls no other packages — it is plain Node.js.
- **Deterministic, not hopeful.** It hooks into the editor's edit events, so logging always happens — it does not rely on the model "remembering" to read a file.
- **Private by default.** Secrets and gitignored files are never recorded.

> ai-log does not solve the AI context problem. It makes one concrete part of it smaller: the agent gets an accurate, compact record of what changed recently, instead of guessing.

---

## Quick start

```bash
npm install -g @keepuni/ai-log
cd your-project
ai-log init          # pick shared or private history
```

Then **restart your AI editor**. That's it — every edit your agent makes is now logged, and it reads the recent history before touching your code.

---

## How it works

```
   agent edits a file
          │
          ▼
   ai-log hook  ──►  diffs it against the last snapshot, appends to history,
          │          and rewrites recent.md (with the actual changed lines)
          ▼
   before the next edit, ai-log hands the file's recent history back to the agent
```

When you run `ai-log init`, it does three things:

1. Creates `.ai-log/` in your project:
   ```
   your-project/
   └── .ai-log/
       ├── recent.md       ← compact, human- and AI-readable summary of recent changes
       ├── history.jsonl   ← append-only full history, one JSON object per edit
       ├── snapshots/      ← internal copies used to compute exact diffs
       └── config.json
   ```

2. Installs **hooks** and a **rule** in the AI tools you use (Claude Code, Cursor): the hooks call ai-log on every file edit; the rule tells the agent to read `.ai-log/recent.md` before it edits.

3. On each edit, the hook diffs the file against ai-log's last snapshot, classifies the change, appends it to `history.jsonl`, and rewrites `recent.md`. The agent is fed recent history before it edits: in Claude Code the hook injects the history of the specific file being edited; in Cursor it is provided at the start of a session. The installed rule reinforces this in both.

Diffs are computed from ai-log's own snapshots, not from the editor's payload — so it works identically across tools, survives editor updates, and **works even in projects without git**.

---

## Per-tool setup

You don't configure anything by hand. `ai-log init` writes both the hooks and the rule for you, and is safe to re-run — it merges into existing config without touching your other settings.

### Claude Code

`init` adds these hooks to `.claude/settings.json`:

| Hook | Matcher | What it does |
| :-- | :-- | :-- |
| `PostToolUse` | `Write\|Edit\|MultiEdit` | Records the edit after it happens |
| `PreToolUse` | `Write\|Edit\|MultiEdit` | Injects the recent history of the file about to be edited |
| `SessionStart` | — | Injects an overview of recent project changes at the start of a session |
| `Stop` | — | Reconciles the working tree at the end of a turn, catching edits made through the shell |

The `PreToolUse` injection is the key piece: right before Claude edits `src/auth.js`, it receives the recent ai-log history for `src/auth.js` specifically — relevant, and without flooding the context. `init` also writes a rule block to `CLAUDE.md` reinforcing that Claude should read `.ai-log/recent.md` before editing.

### Cursor

Requires **Cursor 1.7+** (the version that introduced hooks). `init` adds to `.cursor/hooks.json`:

| Hook | What it does |
| :-- | :-- |
| `afterFileEdit` | Records the edit after it happens |
| `sessionStart` | Injects an overview of recent project changes at the start of a session |
| `stop` | Reconciles the working tree at the end of a turn, catching edits made through the shell |

**Honest limitation:** Cursor has no hook that injects context *before each individual edit*, so the automatic injection happens once per session (`sessionStart`). To cover edits within a session, `init` also writes a rule to `.cursor/rules/ai-log.mdc` (`alwaysApply: true`) telling the agent to read `.ai-log/recent.md` before editing. Logging itself is deterministic on every edit.

---

## Storage: shared vs private

`init` lets you choose how the history is stored. Both are first-class — pick what fits your project.

| | **Shared** (`--shared`) | **Private** (`--private`, default) |
| :-- | :-- | :-- |
| `history.jsonl` | committed to git → team memory | gitignored → stays on your machine |
| `snapshots/`, `recent.md` | local only | local only |
| Best for | private repos, or history worth sharing | public repos, or anything sensitive |

With **shared**, every teammate and every future session starts from the same record of what changed. You can switch later by editing `.ai-log/.gitignore`.

---

## What gets logged — and what never does

**Recorded:** every edit an agent makes to a text file inside the project. Edits and deletions made through the shell (which the file-edit hooks never see) are caught by the end-of-turn reconcile pass, which compares the working tree against ai-log's snapshots.

**Never recorded:**
- Files matched by your project's `.gitignore` (including nested `.gitignore` files in subdirectories).
- Secret-looking files: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`, `id_rsa`/`id_ed25519`/…, `*.secret`.
- `node_modules/`, `.git/`, and `.ai-log/` itself.
- Binary files and files larger than 512 KB.

---

## The log format

`recent.md` — what the agent reads: a one-line summary per change plus the actual changed lines for the most recent ones.

````markdown
# ai-log - recent changes

- `src/auth.js` (minor +2/-1 [signature]) 2026-06-01 14:23Z claude

  ```diff
  -export function login(user) {
  +export function login(user, password) {
  +  if (!user) return null;
  ```

- `src/db.js` (major +120/-60 [imports]) 2026-06-01 15:10Z claude
````

`history.jsonl` — the full record, one JSON object per line:

```json
{"ts":"2026-06-01T14:23:00.000Z","tool":"claude","file":"src/auth.js","size":"minor","added":3,"removed":0,"kinds":["signature"],"patch":"@@ -10,3 +10,6 @@\n+  if (!user) return null;"}
```

Every entry is one append — the full file is never re-read to add a record.

- **Change size** is by total changed lines: `minor` (< 10), `medium` (10–100), `major` (> 100).
- **`kinds`** is a best-effort heuristic tag set (`dependency`, `imports`, `signature`, `config`, `docs`, `deletion`) — a hint, not a guarantee.

**Volume stays under control** so the agent's context never drowns as a project grows:
- A brand-new file is logged compactly as `created, N lines` — not as a giant diff.
- The agent always receives a bounded recent slice (last ~20 changes), regardless of total history.
- `history.jsonl` is rotated once it grows past a few MB, keeping the newest entries.

---

## Commands

```
ai-log init [--shared|--private] [--claude] [--cursor] [--yes]
ai-log status            Show what has been recorded so far
ai-log context [file]    Print recent history (all, or for one file)
ai-log uninstall         Remove the hooks ai-log installed (keeps the history)
```

`ai-log capture` exists too, but it is driven by the editor hooks — you never call it by hand.

---

## What ai-log is, and what it isn't

**It is** an accurate, low-noise memory of recent edits, delivered to the agent at the moment it matters.

**It is not** a guarantee that the agent won't make mistakes. The agent can still ignore the context. ai-log makes the right information *present and reliable*; it cannot force good judgment, and won't pretend to.

It overlaps with `git log` on purpose — the difference is that ai-log captures the dozens of edits an agent makes *between* commits, and hands them back in a form built for an AI to consume.

---

## Roadmap

- MCP server for Claude Code (query history on demand: "what changed in `auth.js` today?").
- More tools (Windsurf, Zed, others as their hook APIs land).
- A file-watcher fallback for editors without hooks.

---

## Credits

ai-log was designed and built by a solo developer, with AI assistance.

## License

[MIT](LICENSE)
