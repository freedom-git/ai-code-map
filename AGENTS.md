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

### Trace Mode (`trace-{name}.json`)
A **trace** overlays a numbered call flow path on top of the map — like drawing a route on a real map.

**Rules:**
1. **Based on the map.** Trace references nodes that exist in `map.json`. If a node needed for the trace doesn't exist in the map yet, add it to the map first.
2. **One call stack per trace.** Each trace represents exactly one execution flow (e.g., "what happens when GET /endpoint/versions is called").
3. **Named traces.** Every trace has a dedicated name. File: `trace-{name}.json` (e.g., `trace-get-versions.json`, `trace-startup.json`). Multiple traces can coexist.
4. **Numbered steps.** Each step in the trace has a number indicating execution order.
5. **Start point marked.** The first node in the trace is marked as `start: true`.
6. **Step limit.** User can specify how many steps to trace. When reached, stop and wait for feedback before continuing deeper.
7. **Trace edges are separate from map edges.** Trace uses `type: "trace"` edges with step numbers, rendered as a distinct style (e.g., bold red/orange numbered line) overlaid on the map's structural edges.
7. **File**: `projects/{repo-name}/traces/{name}.json`

### Trace JSON Schema (`traces/{name}.json`)
```json
{
  "name": "get-versions",
  "description": "GET workspaces/{wid}/mlmodels/{mid}/endpoint/versions call flow",
  "steps": [
    {
      "step": 1,
      "nodeId": "program",
      "method": "Main(args)",
      "description": "Entry point — creates WorkloadApp and calls RunAsync"
    },
    {
      "step": 2,
      "nodeId": "workload-app",
      "method": "RunAsync()",
      "description": "Registers endpoints and initializes workload context"
    }
  ]
}
```

### Trace Display Rules
1. **Step number on method row.** In trace mode, the step number appears as a red number inline before the target method inside the UML node — no background highlight, no color change on the method text.
2. **Trace edges show method.** Edge labels show `{step}. {method}` (e.g., `2. RunAsync()`).
3. **Left sidebar.** Trace steps are listed in a left sidebar panel with step number, method, and description on separate lines.
4. **Node border.** Traced nodes get a red border and glow, but no other styling changes inside.

### Mode Switching
- When user asks about **structure** ("show me the classes in X", "what extends Y") → **Map mode**
- When user asks about **flow** ("what happens when X is called", "trace the call from A to B") → **Trace mode**
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
