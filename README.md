# AI Code Insight Toolkit

This repo hosts **two Copilot / Claude / OpenCode skills** that help you understand large codebases:

| Skill | What it does | Output |
|-------|--------------|--------|
| **`code-insight`** | UML-style class map + numbered call traces, rendered in an interactive [React Flow](https://reactflow.dev/) viewer. | `map.json` + `traces/{name}.json` + a Vite-served web viewer at `http://localhost:5173/` |
| **`code-flow`** | Structured code-walk producing a canonical `flow.json` artifact. Two modes: `base` (describe a code path) and `incident` (verify each step against logs for a specific failed run). | `flow.json` (+ a generic markdown render). Designed to be consumed and enriched by other skills (knowledge-base, code-insight, future). |

Both skills are registered together via a shared script. You can also register just one with `--skill=<name>`.

> Unlike tools that dump the entire repo as one giant diagram or trace, this toolkit is **question-driven** — you ask about a specific part of the code, and the skills build a focused, structured answer.

## 💡 Philosophy

Most code visualization tools draw the **entire** repo at once — producing an unreadable mess for large projects. Most "code trace" tools record only function-name hops, skipping the interesting things each function actually does. The skills in this repo take a different approach:

1. **Question-driven**: You ask "how does auth work?" or "why did this score request fail?" — not "show me everything"
2. **Incremental**: Maps grow as you explore; flows capture only the rows that matter
3. **Two layers separated**: Structure (code-insight map) and behavior (code-insight trace, code-flow walk) are distinct concerns
4. **Structured first, visual second**: Skills emit JSON artifacts that viewers and consumers render however they need

## 🗺️ `code-insight` — interactive code map

### Features

#### Map Mode — Code Structure
- **UML-style class nodes** with stereotype, public attributes, methods, and file path
- **Folder containers** group classes by directory
- **Structural edges** following UML conventions (inherits, implements, uses, composition, aggregation)
- **Additive** — the map grows gradually as you explore more of the codebase. Nodes are never removed unless the code is deleted.

#### Trace Mode — Call Flow
- **Numbered call stack** overlaid on the map, like drawing a route on a real map
- **Step numbers inline** with the target method inside each UML node
- **Left sidebar** lists all trace steps with method and description
- **Red trace lines** with arrows connecting each step
- **Multiple named traces** can coexist (e.g., `startup`, `get-versions`, `auth-flow`)

#### AI-Powered (via Copilot CLI / Claude / OpenCode)
- Ask a question about the repo → AI analyzes the code → generates `map.json` and `traces/{name}.json`
- The AI follows strict rules defined in `skills/code-insight/AGENTS.md` for consistent, UML-compliant output
- Question-driven scope: only shows relevant classes, not the entire repo

## 🔍 `code-flow` — structured code-walk

A separate skill that captures **what each step of a code path actually does** — every failure point, every external call, every meaningful inner step — and emits it as a canonical `flow.json` artifact.

### Two modes

| Mode | What it does | When to use |
|------|--------------|-------------|
| `base` | Walk the code path, list every step in `steps[]`. No log verification, no status stamps. | "Describe how this code path works" — for docs, shared understanding. |
| `incident` | Run `base` first. Then take user-supplied incident IDs, verify each step's `logAnchor` against actual logs, stamp every step (`success` / `failure` / `skipped` / `unknown`), and write the causal chain into `incident.rootCause`. | "Investigate this specific failed run." Requires the host agent to have log-query tools + domain knowledge; otherwise the skill stops and asks the user to provide them. |

### How it composes with `code-insight`

`flow.json` is **independent** — a generic markdown render of it is useful on its own. But it's also designed to be consumed by other skills:

- **`code-insight`** can convert `flow.json` → its native trace format and draw it on a map. This addresses the granularity gap in `code-insight`'s default tracing (function-name hops only) by letting the richer `code-flow` rules produce the trace first.
- **Knowledge-base skills** can take `flow.json` and add Kusto-flavored enrichment (cluster, database, query template) before rendering, without re-walking the code.

See [`skills/code-flow/SKILL.md`](skills/code-flow/SKILL.md), [`skills/code-flow/RULES.md`](skills/code-flow/RULES.md), [`skills/code-flow/schema/flow.schema.json`](skills/code-flow/schema/flow.schema.json), and the [`examples/`](skills/code-flow/examples/) folder.

## 🚀 Quick Start

1. **Clone this repo**
   ```bash
   git clone https://github.com/freedom-git/ai-code-map.git
   cd ai-code-map
   ```

2. **Open with an AI coding agent** (any of these):
   ```bash
   copilot          # GitHub Copilot CLI
   claude           # Claude Code
   opencode         # OpenCode
   ```

3. **Tell the agent which repo you want to understand**
   ```
   I want to understand the repo at C:\path\to\my-project
   ```

4. **Ask the agent to start the viewer**
   ```
   Start the web server
   ```
   Then open http://localhost:5173/

5. **Ask questions about the code**
   ```
   Show me the class structure for the auth module
   Trace the call flow when GET /api/users is called
   Walk the score request path and tell me where each step lives          (code-flow base)
   Why did score request RootActivityId 001f... fail?                     (code-flow incident)
   ```

## 🔌 Install as a Skill (optional)

Register this repo with Claude Code and/or GitHub Copilot CLI so they pick up **both** skills automatically:

```bash
# Register both skills — creates junctions/symlinks at:
#   ~/.claude/skills/code-insight   →  skills/code-insight
#   ~/.claude/skills/code-flow      →  skills/code-flow
#   ~/.copilot/skills/code-insight  →  skills/code-insight
#   ~/.copilot/skills/code-flow     →  skills/code-flow
node scripts/register.mjs

# Remove all registrations
node scripts/unregister.mjs
```

Both scripts are pure Node (no dependencies, no `npm install` required) and work on Windows, macOS, and Linux. On Windows they use directory junctions, so no admin / Developer Mode is needed.

Useful flags:

- `--skill=code-insight` or `--skill=code-flow` — register / unregister only one skill (default: both)
- `--target=claude|copilot|both` (default `both`) — register only one agent
- `--force` — replace a stale link that points elsewhere (`register.mjs` only)
- `--dry-run` — print the actions without making changes

The scripts refuse to delete real directories or symlinks pointing somewhere other than this repo, so they are safe to re-run.

## 📁 Project Structure

```
README.md                          # This file
scripts/                           # SHARED — registers both skills
  register.mjs
  unregister.mjs
skills/
  code-insight/                    # Skill 1: interactive code map
    SKILL.md                       # Manifest
    AGENTS.md                      # Rules for AI-generated diagrams
    web/                           # React Flow viewer app
      src/App.tsx                  # Main viewer with UML nodes
      vite.config.ts               # Dev server + projects/ file serving
    projects/                      # .gitignored — user data per repo
      {repo-name}/
        project.json               # Project config (repo path, name)
        map.json                   # Persistent code structure map
        traces/
          {name}.json              # Named call flow traces
  code-flow/                       # Skill 2: structured code-walk
    SKILL.md                       # Manifest (with two-mode summary)
    RULES.md                       # Operational ruleset for the walk
    schema/
      flow.schema.json             # JSON Schema for flow.json (v1.0.0)
    examples/
      score-flow.json              # base-mode example
      score-incident.json          # incident-mode example
      score-flow.md                # generic markdown render
```

## 📐 Data Formats

### code-insight: `project.json`

```json
{
  "name": "my-project",
  "repoPath": "C:\\path\\to\\repo",
  "description": "Short description of the project"
}
```

### code-insight: `map.json`

```json
{
  "folders": [
    { "id": "folder-controllers", "label": "src/Controllers" }
  ],
  "nodes": [
    {
      "id": "my-controller",
      "className": "MyController",
      "stereotype": "Controller",
      "group": "controller",
      "filePath": "src/Controllers/MyController.cs",
      "folder": "folder-controllers",
      "attributes": ["+ Route: api/items"],
      "methods": ["+ GetAll(): Task<IActionResult>"]
    }
  ],
  "edges": [
    { "source": "my-controller", "target": "base-controller", "label": "extends", "type": "inherits" }
  ]
}
```

### code-insight: `traces/{name}.json`

```json
{
  "name": "get-items",
  "description": "GET api/items call flow",
  "steps": [
    { "step": 1, "nodeId": "my-controller", "method": "GetAll()", "description": "Entry point" },
    { "step": 2, "nodeId": "item-service", "method": "FetchItems()", "description": "Business logic" }
  ]
}
```

### code-flow: `flow.json`

A richer artifact than `traces/{name}.json`. Every step has a `kind` (`failure-point` or `call-step`), a typed `entity` pointing at the code location, prose `action`, optional `codeLink` and `logAnchor`. Incident-mode flows add a top-level `incident` block (typed IDs, optional URL, free-text description, root cause) and stamp every step with `status`.

Full schema: [`skills/code-flow/schema/flow.schema.json`](skills/code-flow/schema/flow.schema.json). Examples: [`skills/code-flow/examples/`](skills/code-flow/examples/).

## 🎨 UML Edge Types (code-insight)

| Type | Style | Arrow | Direction |
|------|-------|-------|-----------|
| `inherits` | solid green | open ▷ | child → parent |
| `implements` | dashed blue | open ▷ | class → interface |
| `uses` | dashed gray | open → | dependent → dependency |
| `call` | solid amber (animated) | filled ▶ | caller → callee |
| `composition` | solid purple | filled ▶ | whole → part |
| `aggregation` | solid purple | open ▷ | whole → part |

## 🏗️ Tech Stack

- **React Flow** — interactive node graph rendering
- **Dagre** — automatic hierarchical layout
- **Vite + React + TypeScript** — fast dev experience
- **AI (Copilot CLI)** — code analysis and JSON generation

---

[中文文档](README.zh-CN.md)

## License

MIT


