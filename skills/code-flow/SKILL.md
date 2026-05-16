---
name: code-flow
description: >
  Walk a code path and produce a structured flow.json artifact that any
  consumer can render — capturing every failure-point, branch, external
  call, side effect, and async hop along the way. Use this skill when the
  user asks to "walk", "trace", "diagram", or "anatomize" a code path; to
  document how a request flows through a system; or to investigate a
  specific incident by mapping it onto a code-walk.
---

# code-flow Skill

Walks a code path and emits a single canonical artifact, `flow.json`, that
downstream consumers (knowledge-base writeups, code-insight maps, custom
viewers, future tools) each enrich independently. The skill is generic —
it does not know about any particular log system, ticket tracker, or
markdown flavor; consumers add those.

## Two modes

| Mode | What it produces | When to use |
|------|------------------|-------------|
| `base` | A code-walk only: `steps[]` with no `status`, no `incident` block. | "Explain how this code path works." Documentation, onboarding, design review. |
| `incident` | A code-walk plus per-step `status` (✅/❌/skipped/unknown) and a `rootCause` derived from real log evidence for a specific failed run. | "Investigate failure `<id>`." Produces an incident postmortem artifact. |

## Critical preflight for `incident` mode

Before any log query, verify the host agent has **both**:

1. A log-query tool registered (e.g. Kusto MCP, log-search API, or equivalent
   the agent can call).
2. Domain knowledge of which log table / cluster / markers apply to the
   target repo — either as part of its general knowledge or via another
   skill the user has registered.

**If either is missing, STOP and ask the user to provide it.** Do **not**
produce an "incident-mode" artifact with unverified `status` values; the
whole point of incident mode is grounding the walk in real evidence.

`base` mode has no such requirement.

## Where to look next

- **[`RULES.md`](./RULES.md)** — the full operational ruleset (row selection,
  classification, descent, anchors, ordering, incident-mode status
  inference). Read this before authoring any flow.
- **[`schema/flow.schema.json`](./schema/flow.schema.json)** — the canonical
  JSON Schema for `flow.json`. Consumers should validate against this before
  enrichment.
- **[`examples/`](./examples/)** — `score-flow.json` (base mode),
  `score-incident.json` (incident mode), and `score-flow.md` (a generic
  markdown render). Use them as templates.

## What this skill does NOT do

- Does not query logs or other telemetry in `base` mode.
- Does not emit Kusto queries, ADO/GitHub-specific URL tricks, docsify
  markdown, or React Flow JSON. Those belong to consumer skills.
- Does not render the flow itself — it stops at producing `flow.json` (and
  optionally a generic markdown table). Visualization is a consumer's job.

## Output convention

A flow named `<name>` produces `<name>.json` (always) and optionally
`<name>.md` (the generic markdown table render). Place them where the
user requests; if unspecified, drop them next to any related source files
the user pointed you at, or ask.
