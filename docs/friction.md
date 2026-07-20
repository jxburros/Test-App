# Friction log: building an app against both nuggets from source

Written while building Nugget Bench against `AI-Nugget` and
`AI-Context-Nugget` **as checked out**, not as npm packages, without
modifying either repo's source. Ordered roughly by how much it slowed things
down.

## 1. Sibling-checkout `file:` dependencies are not portable

Neither repo publishes a way to depend on "whatever's on disk right now"
other than a filesystem path. `npm install` with
`"@jxburros/ai-nugget": "file:../AI-Nugget"` works well *inside this
environment* — npm symlinks the whole target directory in, so edits to the
nugget are picked up immediately with no rebuild-and-republish cycle — but it
hard-codes an assumption that both nugget repos are cloned as siblings of
this one. A fresh `git clone` of just `Test-App` cannot `npm install`
successfully on its own; the two sibling repos have to exist alongside it
first. That's fine for a same-machine demo/dev workflow, but it means this
app cannot be the thing someone `npm install`s standalone. The nuggets'
own examples (`examples/*/package.json` using `file:../..`) make the same
tradeoff internally, so this isn't a new problem introduced here — it's just
inherent to "depend on repo source, not registry package," and worth naming
explicitly since it shaped every setup decision below.

A vendoring approach (copy `dist/`, as AI Nugget's own README documents as
the fallback for consumers who can't take a package dependency) would make
Test-App clonable standalone, at the cost of a manual re-copy step whenever
either nugget changes. We chose the `file:` route since it matches "current
form in the repo" most literally and keeps one source of truth, but a team
shipping this for real should pick vendoring instead once the demo settles.

## 2. AI Nugget and Context Nugget are asymmetric in how build-ready they are

- **AI Nugget** commits both `dist/` (real build output) and `nugget/` (a
  vendorable copy of `src/` stamped with a version+hash) to git. Nothing had
  to be built; `npm install` + import just worked.
- **Context Nugget** `.gitignore`s `dist/` entirely and has no vendor-folder
  equivalent. Before anything could import from it, `dist/` had to be
  generated locally with `npm run build` (or, as done here, straight `tsc -p
  tsconfig.json` — see below). This isn't documented anywhere as a
  prerequisite for consuming the repo directly (the README's "Install / use"
  section assumes the npm package, which ships a pre-built `dist/`).

Net effect: onboarding a second nugget into an app takes a different first
step than the first one, for no reason visible from either README — you find
out by trying to import and hitting a missing-module error.

## 3. Building either nugget doesn't actually need `npm install`

Both repos have zero runtime dependencies, and `tsc` was available globally
in this environment, so `tsc -p tsconfig.json` built each repo's `dist/`
correctly without ever running `npm install` inside either nugget repo (no
`node_modules/` was created in either). This is a nice property, not a
complaint — flagging it because it's easy to assume a build requires the
full devDependency install, and here it didn't.

## 4. The `openai-compat` URL convention was source-only

To point AI Nugget at a local mock server (needed so this demo runs without
real API keys or network access), the `openai-compat` profile has no
`urlTemplate`, so the wire URL is `${baseUrl}/chat/completions` — that's only
visible by reading `src/adapters/engines/openaiChat.ts`'s `urlFor()`, not
from the README's provider table or the `ProviderProfile` type docs. Every
other local-runtime provider profile in the table (llama.cpp, LM Studio,
vLLM) shares this default silently. A one-line note next to the provider
table ("`openai-compat`/local runtimes: `POST {baseUrl}/chat/completions`")
would have saved the trip into `adapters/profiles.ts` + `engines/openaiChat.ts`.

## 5. `promptJson` tool-calling's exact wire contract only lives in `agent/loop.ts`

Building a scripted mock model that participates correctly in the
`promptJson` tool loop (used because `openai-compat`'s capability profile
sets `nativeTools: false`, so `toolMode: 'auto'` resolves to `promptJson`)
required reading `withPromptJsonInstruction`/`callsFromPromptJson` in
`src/agent/loop.ts` directly: the system-prompt wording
(`When you need tools, respond only with JSON. For one tool:
{"tool":"name","input":{...}}...`), how tool results come back as a
synthetic user turn (`Tool <name> returned: <content>`), and the accepted
reply shapes (single object, `{"tools":[...]}`, or a bare array) are not
summarized anywhere in the `build-agent-loop` skill or README beyond "it
parses a JSON directive out of plain text." That's an accurate one-line
description for an app using a *real* model (which infers the format from
the system prompt itself), but insufficient for scripting a fixture model
that has to match the parser exactly.

## 6. Two return-shape mismatches surfaced only by running the code

Both were caught immediately by actually executing the demos (not from
reading types carefully enough the first time), which argues for the
`verify`-style habit of running before declaring done rather than for a
nugget defect:

- `ContextEngine.retrieve()` returns a `ContextPacket` with `.items`, not
  `.results` — `.results` doesn't exist. Easy to guess wrong coming from the
  `RetrievalResult`/`rankResults` naming used one layer down in
  `retrieval/*.ts`, which does use `.results`-shaped arrays internally.
- The Context Nugget → AI Nugget bridge signals "context was injected" via a
  system message whose body is the packed text (headed `## Relevant
  context` / wrapped in `== BEGIN UNTRUSTED SOURCE DATA ==`), not via any
  literal marker string like "Context". A consumer trying to detect "did
  this call include packed context" by string-matching the system message
  has to match the pack's actual heading/boundary text, which is pack-option
  dependent (`trustBoundary`, `heading`), rather than a stable sentinel.

## What went smoothly

- Both packages' public APIs matched their README examples exactly —
  `ContextEngine`, `packContext`, `asAiNuggetContextMessages`/
  `asAiNuggetMetadata`, `AIHandler`, `runAgent`/`defineTool` all worked on
  the first import with no surprises once the two issues above were fixed.
- The untrusted-source-data boundary, budget diagnostics
  (`degradedReason`, `excludedItems`, etc.), memory supersede lifecycle, and
  opt-in redaction all behaved exactly as documented — no gap between the
  README's description and the runtime behavior in `demo:context`.
- AI Nugget's policy/telemetry/redaction seam (`blocklistPolicy` at the app
  level, `TelemetrySink` receiving redacted `CallRecord`s) is exactly the
  "apps configure policy, library doesn't default it" contract the CLAUDE.md
  in that repo describes, and it worked without any library changes.
