**⚠️ RULE: Do NOT commit code without user review. Always wait for explicit approval before running `git commit`.**

**⚠️ RULE: Before any code analysis, check if a project exists in `projects/`. If no project folder exists, ask the user to provide a repo path and project name first. Create `projects/{name}/project.json` with the repo path before proceeding.**

**⚠️ RULE: After finishing the user's ask (any map or trace update), always end the reply with the viewer link so the user can see the result.**
1. Check whether the Vite dev server is already running on port 5173:
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
   ```
   Note: `-State Listen` is essential — without it, TimeWait sockets show `OwningProcess=0` and `Stop-Process` fails.
2. If the port is **in use**, just tell the user: open **http://localhost:5173/** and (if relevant) which project / trace to pick.
3. If the port is **free**, launch the viewer in a detached background process from the **resolved skill directory**, then give the link:
   ```powershell
   # Resolve the skill folder to its physical path (in case it is a junction/symlink),
   # then cd into web/. $PSScriptRoot here is a placeholder — substitute the actual
   # skill folder path the agent was loaded from.
   $skillDir = '<PATH-TO-THIS-SKILL-FOLDER>'
   $item = Get-Item $skillDir
   if ($item.LinkType -in @('Junction','SymbolicLink')) { $skillDir = $item.Target[0] }
   cd (Join-Path $skillDir 'web')
   npm run dev
   ```
   **Why resolve the link?** On Windows the skill folder is often a junction (e.g., `<user>\.copilot\skills\code-insight` → some other drive). Vite/Rollup get confused by symlink resolution and may serve raw TSX. Always cd to the physical path.
   Use `mode="async"` + `detach: true` (so the server survives the session). Wait ~5 s, read the log file to confirm `Local: http://localhost:5173/`, then tell the user to open it.
4. Always include a one-line hint about which **project** to select and (for trace work) which **trace** name to pick from the dropdown.

**⚠️ RULE: Pinned dev dependencies.** `web/package.json` must use `vite ^5.4.21` + `@vitejs/plugin-react ^4.7.0`. Do NOT upgrade to Vite 6/7 or plugin-react 6 — they break the JSX transform pipeline (server returns raw TSX as `text/javascript`, browser throws `SyntaxError: missing ) after argument list`). If you see this symptom, downgrade and clear `web/node_modules/.vite/` then restart.

# Code Insight - Agent Instructions

## Graph Generation Rules

When generating `graph.json` for the React Flow viewer, follow these rules:

### Node Rules
1. **A class = a node.** Each class in the diagram is represented as one UML-style node.
2. **UML format.** Every node must include:
   - `className`: The class name
   - `stereotype`: e.g., `Controller`, `Abstract`, `Static`, `Interface`, `Service`, `Repository`
   - `attributes`: List of public properties/fields with types (e.g., `"EndpointName: string {abstract}"`)
   - `methods`: List of public methods with return types (e.g., `"GetVersionsAsync(): Task<IActionResult>"`)
   - `filePath`: Relative path to the source file from repo root. **Always use full paths, never abbreviate with `...`** (e.g., `"Components/ModelEndpoints/Microsoft.MachineLearning.ModelEndpoints/Controllers/MyController.cs"`)
   - `group`: Category for color coding (`controller`, `infrastructure`, `base`, `service`, `model`, `repository`)
3. **Only show public members.** Do not include private/protected/internal members.
4. **Keep method signatures concise.** Use short parameter names, omit attributes like `[HttpGet]` from the method list.

### Edge Rules (UML-Compliant)
1. **All edges have directional arrows** pointing from `source` to `target`.
2. **`type: "inherits"`** (Generalization) — solid green line + **open arrow** ——▷, child → parent
3. **`type: "implements"`** (Realization) — dashed blue line + **open arrow** --▷, class → interface
4. **`type: "uses"`** (Dependency) — dashed gray line + **open arrow** -->, dependent → dependency
5. **`type: "call"`** (Association) — solid amber line + **filled arrow** ——▶, caller → callee (animated)
6. **`type: "composition"`** — solid purple line + **filled arrow** ——▶, whole → part
7. **`type: "aggregation"`** — solid purple line + **open arrow** ——▷, whole → part
8. Always include a `label` describing the relationship.
9. **Direction convention**: `source` is the origin (child/caller/dependent/whole), `target` is the destination (parent/callee/dependency/part).
10. **Note**: Hollow triangles/diamonds are not yet supported. Using open/filled arrows as approximation for now.

### Scope Rules
1. **Question-driven.** Only show classes relevant to the user's question — not the entire repo.
2. **First layer first.** Start from the entry point (controller, handler, etc.) and expand only as deep as the question requires.
3. **Keep it focused.** Aim for 3-8 nodes per diagram. If more are needed, explain and ask.

---

## Project Configuration

Each project has a `projects/{repo-name}/project.json`:

```json
{
  "name": "workload-ml",
  "repoPath": "Q:\\Repos\\Mwc\\workload-ml",
  "description": "ML Workload Service"
}
```

- `name`: Project display name
- `repoPath`: Absolute path to the repo on disk (used by AI to analyze code)
- `description`: Short description

---

## Two Modes: Map & Trace

### Map Mode (`map.json`)
The **map** is a persistent, accumulative view of the repo's code structure.

**Rules:**
1. **Additive only.** Every time we explore a new class, add it to `map.json`. Never remove nodes unless the code itself is deleted.
2. **Updateable.** Existing nodes can be updated (e.g., new methods discovered, attributes changed).
3. **Complete over time.** The map grows gradually as we understand more of the repo. Over many sessions, it becomes a full architectural map.
4. **Structural relationships only.** Map edges show static relationships: `inherits`, `implements`, `uses`, `composition`, `aggregation`. Not runtime call flows.
5. **Folders as containers.** Group nodes by their folder/directory. Folders may be **nested** — see _Folder Nesting_ below.
6. **File**: `projects/{repo-name}/map.json`

### Trace Mode — superseded by the `code-flow` skill

This repo previously hosted a built-in "Trace Mode" that wrote
`projects/{repo}/traces/{name}.json` to overlay a numbered call flow on the
map. **That functionality now lives in the separate `code-flow` skill**
(also hosted in this repo under `skills/code-flow/`). When the user asks to
trace a call flow, invoke the `code-flow` skill; it produces a canonical
`flow.json` that any consumer (including this skill's viewer) can render.

Existing `projects/{repo}/traces/*.json` files continue to load in the
viewer using the legacy schema; new traces should be authored via
`code-flow`.

### Mode Switching
- When user asks about **structure** ("show me the classes in X", "what extends Y") → **Map mode** (this skill)
- When user asks about **call flow** ("what happens when X is called", "trace the call from A to B") → invoke the **`code-flow`** skill
- When user says "add to map" or "remember this" → **Map mode** (persist nodes)

### JSON Schema

```json
{
  "folders": [
    { "id": "components", "label": "Components" },
    { "id": "model-endpoints", "label": "ModelEndpoints", "parent": "components" },
    { "id": "controllers", "label": "Controllers", "parent": "model-endpoints" }
  ],
  "nodes": [
    {
      "id": "unique-id",
      "className": "ClassName",
      "stereotype": "Controller",
      "group": "controller",
      "filePath": "relative/path/to/File.cs",
      "folder": "controllers",
      "attributes": ["PropertyName: Type"],
      "methods": ["MethodName(params): ReturnType"]
    }
  ],
  "edges": [
    {
      "source": "from-id",
      "target": "to-id",
      "label": "relationship description",
      "type": "inherits|implements|call|uses"
    }
  ]
}
```

### Folder Nesting
- A folder may declare a `parent` referencing another folder's `id`. Omit `parent` for root folders.
- **Labels are leaf-only.** Write the short segment (`"Controllers"`), not the full path (`"Components/ModelEndpoints/Controllers"`). Nesting context comes from the parent chain.
- A class node always references the **deepest** folder it belongs to via its single `folder` field. The viewer walks up the `parent` chain automatically.
- Cycles and unknown parents are tolerated (treated as root) but should be avoided.

### Group Color Map
- `controller` → blue (#3b82f6)
- `service` → green (#10b981)
- `infrastructure` → amber (#f59e0b)
- `base` → gray (#6b7280)
- `model` → purple (#8b5cf6)
- `repository` → teal (#14b8a6)
