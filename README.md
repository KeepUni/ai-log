# ai-log

**A reliable change log for AI coding agents.** ai-log records every edit your agent makes and feeds the relevant recent history back to it before its next edit — so it stops forgetting what it already did and stops breaking what it just fixed.

- **Zero runtime dependencies.** `npm install` pulls nothing. The whole tool is plain Node.js.
- **Deterministic, not hopeful.** It hooks into the editor's edit events, so logging always happens — it does not rely on the model "remembering" to read a rules file.
- **Private by default.** Secrets and gitignored files are never recorded.

> ai-log does not solve the AI context problem. It makes one concrete part of it smaller: the agent now has an accurate, compact record of what changed recently, instead of guessing.

---

## How it works

When you run `ai-log init`, it does three things:

1. Creates `.ai-log/` in your project:
   ```
   your-project/
   ├── src/
   └── .ai-log/
       ├── recent.md       ← compact, human- and AI-readable summary of recent changes
       ├── history.jsonl   ← append-only full history, one JSON object per edit
       ├── snapshots/       ← internal copies used to compute exact diffs
       └── config.json
   ```

2. Installs **hooks** and a **rule** in the AI tools you use (Claude Code, Cursor): the hooks call ai-log on every file edit; the rule tells the agent to read `.ai-log/recent.md` before it edits.

3. On each edit, the hook:
   - reads the file, diffs it against ai-log's last snapshot,
   - classifies the change and appends an entry to `history.jsonl`,
   - rewrites `recent.md` (with the actual changed lines, not just counts).

   The agent is also fed recent history before it edits: in Claude Code the hook injects the history of the specific file before each edit; in Cursor it is provided when a session starts. The installed rule reinforces this in both.

Diffs are computed from ai-log's own snapshots, not from the editor's payload. That means it works identically across tools, survives editor version changes, and **works even in projects without git**.

---

## Install

ai-log is a Node.js CLI and requires **Node 18.17+**.

**From source (current):**
```bash
git clone https://github.com/KeepUni/ai-log
cd ai-log
npm link        # exposes the `ai-log` command globally
```

Once published to npm this becomes `npm install -g @keepuni/ai-log` (the command stays `ai-log`).

Then, in **your project**:
```bash
cd your-project
ai-log init
```

`init` asks one question: should the change history be **shared** (committed to git) or **private** (local only). Pass `--shared` or `--private` to skip the prompt.

After `init`, **restart your agent session** so the editor loads the new hooks and rule.

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

### Shared (`--shared`)

The change history (`history.jsonl`) is committed to git, so it becomes **team memory**: every teammate and every future session starts with the same record of what changed. Internal artifacts (`snapshots/`, `recent.md`) stay local.

ai-log writes `.ai-log/.gitignore`:
```
snapshots/
recent.md
```

Choose this when the history is useful to share and your repo is private or the history contains nothing sensitive.

### Private (`--private`)

Nothing in `.ai-log/` is committed. The history stays on your machine.

ai-log writes `.ai-log/.gitignore`:
```
*
```

Choose this for public repos, or whenever you'd rather not put your edit history in version control. This is the default if you don't choose.

You can switch later by editing `.ai-log/.gitignore`.

---

## What gets logged — and what never does

**Recorded:** every edit an agent makes to a text file inside the project. Edits and deletions made through the shell (so the file-edit hooks never see them) are caught by the end-of-turn reconcile pass, which compares the working tree against ai-log's snapshots.

**Never recorded:**
- Files matched by your project's `.gitignore` (including nested `.gitignore` files in subdirectories).
- Secret-looking files: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`, `id_rsa`/`id_ed25519`/…, `*.secret`.
- `node_modules/`, `.git/`, and `.ai-log/` itself.
- Binary files.
- Files larger than 512 KB.

---

## The log format

`recent.md` (what the agent reads) — a one-line summary per change plus the actual changed lines for the most recent ones:
```markdown
# ai-log - recent changes

Read this before editing. ...

- `src/auth.js` (minor +2/-1 [signature]) 2026-06-01 14:23Z claude

  ```diff
  -export function login(user) {
  +export function login(user, password) {
  +  if (!user) return null;
  ```

- `src/db.js` (major +120/-60 [imports]) 2026-06-01 15:10Z claude
```

`history.jsonl` (the full record, one object per line):
```json
{"ts":"2026-06-01T14:23:00.000Z","tool":"claude","file":"src/auth.js","size":"minor","added":3,"removed":0,"kinds":["signature"],"patch":"@@ -10,3 +10,6 @@\n+  if (!user) return null;"}
```

Every entry is one `appendFileSync` — the full file is never re-read to add a record.

**Change size** is by total changed lines: `minor` (< 10), `medium` (10–100), `major` (> 100).
**`kinds`** is a best-effort heuristic tag set (`dependency`, `imports`, `signature`, `config`, `docs`, `deletion`) — a hint, not a guarantee.

**Volume is kept under control** so the agent's context never drowns as a project grows:
- A brand-new file is logged compactly as `created, N lines` — not as a giant diff.
- What the agent receives is always a bounded recent slice (last ~20 changes), regardless of total history.
- `history.jsonl` is rotated when it grows past a few MB, keeping the newest entries.

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

**It is not** a guarantee that the agent won't make mistakes. The agent can still ignore the context. ai-log makes the right information *present and reliable*; it cannot force good judgment. We won't pretend otherwise.

It also overlaps with `git log` on purpose — the difference is that ai-log captures the dozens of edits an agent makes *between* commits, and hands them back in a form built for an AI to consume.

---

## Roadmap

- MCP server for Claude Code (query history on demand: "what changed in `auth.js` today?").
- More tools (Windsurf, Zed, others as their hook APIs land).
- A file-watcher fallback for editors without hooks.

---

## License

MIT
