**⚠️ RULE: Do NOT commit code without user review. Always wait for explicit approval before running `git commit`.**

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

## Two Modes: Map & Trace

### Map Mode (`map.json`)
The **map** is a persistent, accumulative view of the repo's code structure.

**Rules:**
1. **Additive only.** Every time we explore a new class, add it to `map.json`. Never remove nodes unless the code itself is deleted.
2. **Updateable.** Existing nodes can be updated (e.g., new methods discovered, attributes changed).
3. **Complete over time.** The map grows gradually as we understand more of the repo. Over many sessions, it becomes a full architectural map.
4. **Structural relationships only.** Map edges show static relationships: `inherits`, `implements`, `uses`, `composition`, `aggregation`. Not runtime call flows.
5. **Folders as containers.** Group nodes by their folder/directory.
6. **File**: `demo/public/map.json`

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
8. **File**: `demo/public/trace-{name}.json`

### Trace JSON Schema (`trace-{name}.json`)
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

### Mode Switching
- When user asks about **structure** ("show me the classes in X", "what extends Y") → **Map mode**
- When user asks about **flow** ("what happens when X is called", "trace the call from A to B") → **Trace mode**
- When user says "add to map" or "remember this" → **Map mode** (persist nodes)

### JSON Schema

```json
{
  "nodes": [
    {
      "id": "unique-id",
      "className": "ClassName",
      "stereotype": "Controller",
      "group": "controller",
      "filePath": "relative/path/to/File.cs",
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

### Group Color Map
- `controller` → blue (#3b82f6)
- `service` → green (#10b981)
- `infrastructure` → amber (#f59e0b)
- `base` → gray (#6b7280)
- `model` → purple (#8b5cf6)
- `repository` → teal (#14b8a6)
