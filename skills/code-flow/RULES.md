# code-flow Rules

These are the operational rules the agent must follow when walking a code
path and producing a `flow.json` artifact. They are the rules we evolved
across many hand-written code-walk articles, generalized so they apply to
any repo and any flow.

Read [`SKILL.md`](./SKILL.md) for the high-level overview and mode
descriptions; read [`schema/flow.schema.json`](./schema/flow.schema.json)
for the artifact contract.

---

## 1. Row-selection rules (apply in both modes)

A line of code earns a row in `steps[]` when **any** of these is true:

1. **Failure-point** — the line throws, returns an error response,
   cancels, retries, or makes a "give up" decision.
2. **External call** — the line crosses a process / repo / network
   boundary (HTTP call, queue submission, callback target, DB write, RPC,
   side-process invocation, etc.).
3. **Branch decision** — a `switch`/`if`/`match` that chooses between
   materially different downstream paths (retry vs cleanup, different
   error class, fast-path vs slow-path).
4. **Side effect another DRI would need to know about** — emitting a
   metric, mutating shared state, sending an alert, evicting a cache key,
   writing audit/telemetry.
5. **Status transition** — any state-machine transition the user-visible
   API surfaces.
6. **Async hop** — enqueuing a background op, posting to a queue,
   scheduling a callback or timer.

**Skip:**

- Pure helpers that only transform data with no side effect.
- Trivial getters / property reads.
- Logging-only lines, **unless** that log line is the *only* observable
  evidence the step ran. In that case, do not give the log line its own
  row — promote it to a `logAnchor` on the nearest meaningful step.

### Worked example

```csharp
// Lines from a hypothetical controller:
var req = await DeserializeAsync(body);               // skip — pure transform
_metrics.Increment("score.requests");                 // ROW — side effect (rule 4)
if (req.Version == null) throw new BadRequest(...);   // ROW — failure-point (rule 1)
var route = router.PickRoute(req);                    // skip if PickRoute is trivial
var resp = await aca.PostAsync(route, req);           // ROW — external call (rule 2)
log.Info("forwarded request to ACA");                 // skip — promote to logAnchor on prior row
return resp;                                          // skip — implicit
```

Result: 3 rows for this snippet.

---

## 2. `kind` classification

Each row's `kind` is exactly one of:

- `failure-point` — chosen when rules (1), (3), or (6-on-failure) above
  are the reason the row exists.
- `call-step` — chosen for everything else.

When uncertain, prefer `failure-point`. DRIs reading an incident-mode
flow care most about the failure-points.

---

## 3. Descent rules

For each row that is an external call or async hop, **descend into the
called function** if its body is reachable in the same or a sibling repo
the user has open. Each meaningful inner step becomes its own row.

Stop descending when **any** of:

- The function leaves the user's accessible repos.
- The function is a thin wrapper — ≤2 substantive lines, no branching, no
  side effects. Fold it into the caller's row.
- Continuing descent would not add new failure-points or branches.

Link descent back to the parent row visually via the increasing `step`
number; the schema has no parent/child fields in v1.

---

## 4. `logAnchor` rules

A `logAnchor` ties a step to a specific log/trace line in production,
enabling incident-mode status inference.

- Use the **exact** log string emitted by the code — grep the source, do
  not paraphrase. If the code uses an interpolated string, capture the
  static prefix.
- Prefer a structured marker name (e.g. a `MarkerName` constant, an
  event-id, a span name) over the human-readable message when both
  exist. Markers are stable across log refactors.
- `source` points to the **emit site** of the log (the file/line where
  the log call is made), not the log table or query UI.
- Skip `logAnchor` entirely on steps where no observable log is emitted —
  do not invent one.

---

## 5. `action` rules

- Two-sentence max: **what it does**, then **how it fails** (when
  applicable).
- No code snippets in `action` — that's what `codeLink` is for.
- If the failure mode is "throws `X` on `Y`", say that exactly. DRIs grep
  `action` text.
- Avoid system-specific jargon when a generic verb works (`POST to
  service` over `submit to ACA container app`); reserve specifics for the
  `entity` field.

---

## 6. `entity` rules

`entity` is the code-location pointer — *where* the step lives.

- `repo` and `path` are required.
- `class`, `function`, and `line` are strongly encouraged. Include them
  whenever the language has the concept and you can determine the value.
- `line` is the line of the **step's own action**, not the file header.
- For non-OO languages, `class` may be omitted; use `function` (or
  `module` rolled into `path`).

`codeLink` is optional and only present when the repo is hosted somewhere
the link will resolve (ADO, GitHub, GitLab, etc.). Local-only repos omit
it.

---

## 7. Step ordering

- Chronological in the **normal-case** execution path.
- For async hops, the row for the enqueue is followed by the rows for
  the callback / completion handler (in the order they run).
- For state-machine branches, list the most-common branch first, then
  the alternates. (Document the alternates only if rule 1 says so — most
  alternates exist solely to handle errors.)
- `step` is a monotonically increasing integer starting at 1. Never
  reset, never skip.

---

## 8. Incident-mode additions

Run **base mode first**, unchanged. Then, for each step:

1. If the step has a `logAnchor`, query the log system using the
   user-supplied IDs (from `incident.ids[]`) and the marker/message
   string. Interpret the result:
   - Match found, no error → `status = "success"`
   - Match found, error / non-2xx / exception → `status = "failure"`
   - No match found, but an earlier step succeeded → `status = "skipped"`
     (the code path didn't reach here)
   - Match found but ambiguous → `status = "unknown"`
2. If the step has no `logAnchor`, infer status from neighbors:
   - Step succeeds if the next step that *does* have an anchor shows the
     code progressed past this point.
   - Otherwise → `status = "unknown"`.
3. After every step has a status, identify the **earliest** `failure`.
   That step is the proximate cause. Write the full causal chain into
   `incident.rootCause`: what triggered it, why it failed, what cascading
   effects followed.

The `incident.description` field is **free-text supplied by the user** —
quote it verbatim. It captures anything incident-related that isn't an
ID: failure scenario, symptoms, timing, environment, customer impact,
repro notes. Do not paraphrase or summarize.

---

## 9. Things NOT to put in `flow.json`

These belong to consumer skills, not this skill:

- ❌ Kusto / log-system database names, cluster URIs, table names, query
  strings.
- ❌ Docsify / mkdocs / sphinx-specific markdown directives.
- ❌ ADO or GitHub URL suffixes (e.g. `?_a=contents&line=...`) baked into
  the schema — `codeLink` is a plain URL; consumers may rewrite it.
- ❌ React Flow / Mermaid / Cytoscape rendering hints.
- ❌ Summary / TLDR fields (rolled into `incident.rootCause` in incident
  mode; omitted entirely in base mode).
- ❌ A `trigger` row — that's just step 1 of `steps[]`.
- ❌ Domain-specific row kinds (e.g. `cert-event`). Use `failure-point`
  or `call-step`.
