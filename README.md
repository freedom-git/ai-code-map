# AI Code Map

An interactive code visualization tool that helps you **understand large codebases** through UML-style diagrams and call flow tracing — powered by AI and [React Flow](https://reactflow.dev/).

> Unlike tools that dump the entire repo as one giant diagram, AI Code Map is **question-driven** — you ask about a specific part of the code, and it builds a focused, interactive visual answer.

## 💡 Philosophy

Most code visualization tools draw the **entire** repo at once — producing an unreadable mess for large projects. AI Code Map takes a different approach:

1. **Question-driven**: You ask "how does auth work?" — not "show me everything"
2. **Incremental**: The map grows as you explore, building understanding step by step
3. **Two layers**: Structure (map) and behavior (trace) are separate concerns
4. **Visual**: Output is interactive images, not walls of text

## ✨ Features

### 🗺️ Map Mode — Code Structure
- **UML-style class nodes** with stereotype, public attributes, methods, and file path
- **Folder containers** group classes by directory
- **Structural edges** following UML conventions (inherits, implements, uses, composition, aggregation)
- **Additive** — the map grows gradually as you explore more of the codebase. Nodes are never removed unless the code is deleted.

### 🔍 Trace Mode — Call Flow
- **Numbered call stack** overlaid on the map, like drawing a route on a real map
- **Step numbers inline** with the target method inside each UML node
- **Left sidebar** lists all trace steps with method and description
- **Red trace lines** with arrows connecting each step
- **Multiple named traces** can coexist (e.g., `startup`, `get-versions`, `auth-flow`)

### 🤖 AI-Powered (via Copilot CLI / LLM)
- Ask a question about the repo → AI analyzes the code → generates `map.json` and `traces/{name}.json`
- The AI follows strict rules defined in `AGENTS.md` for consistent, UML-compliant output
- Question-driven scope: only shows relevant classes, not the entire repo

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
   ```

## 📁 Project Structure

```
web/                             # React Flow viewer app
  src/
    App.tsx                      # Main viewer with UML nodes
  vite.config.ts                 # Dev server + projects/ file serving
projects/                        # .gitignored — user data per repo
  {repo-name}/
    project.json                 # Project config (repo path, name)
    map.json                     # Persistent code structure map
    traces/
      {name}.json                # Named call flow traces
AGENTS.md                        # Rules for AI-generated diagrams
```

## 📐 Data Format

### project.json

```json
{
  "name": "my-project",
  "repoPath": "C:\\path\\to\\repo",
  "description": "Short description of the project"
}
```

### map.json

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

### traces/{name}.json

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

## 🎨 UML Edge Types

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


