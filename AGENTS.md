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
