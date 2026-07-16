# Nugget Bench

A demo app that shows off [AI Nugget](https://github.com/jxburros/AI-Nugget) and
[Context Nugget](https://github.com/jxburros/AI-Context-Nugget) working
together — built directly against **the current source in those repos**, not
their published npm packages. Neither nugget's source was modified to make
this work.

```txt
Context Nugget -> finds, ranks, cites, budgets, and packs context
AI Nugget     -> talks to model providers (policy, retry, redaction, agent loop)
Nugget Bench  -> wires the two together and demonstrates both
```

## Layout expected

This repo is checked out as a **sibling** of `AI-Nugget` and `AI-Context-Nugget`:

```txt
some-folder/
  AI-Nugget/
  AI-Context-Nugget/
  Test-App/          <- this repo
```

`package.json` depends on both via `file:../AI-Nugget` and
`file:../AI-Context-Nugget`. `npm install` symlinks them in, so edits to
either sibling repo are picked up immediately without republishing anything.
See `docs/friction.md` for why this layout is required and what it costs.

## Setup

```bash
npm install
# Context Nugget has no committed dist/ (see docs/friction.md) — build it once:
(cd ../AI-Context-Nugget && npm run build)
# AI-Nugget ships a committed dist/, so no build step is required there.
```

## Run the demos

Each demo is a standalone script; run the mock provider first (a tiny local
OpenAI-compatible server, so the whole pipeline runs with no API keys and no
network access — see `src/mock-provider.ts`):

```bash
npm run mock-provider           # leave running in one terminal
npm run demo:context            # Context Nugget only: ingest, BM25 retrieve,
                                 # budgeted+cited+untrusted-boundary pack,
                                 # manual/suggested memory lifecycle, redaction
npm run demo:chat                # + AI Nugget: bridge packed context into chat
                                 # messages, call handler.stream with an
                                 # app-level policy, redacted telemetry
npm run demo:agent               # + agent tool loop: a `search_notes` tool
                                 # backed by Context Nugget retrieval, driven
                                 # by AI Nugget's runAgent in promptJson mode
```

### Using a real provider instead of the mock

`demo:chat` and `demo:agent` default to the bundled mock. To point at a real
provider:

```bash
MOCK=0 PROVIDER=openai MODEL=gpt-4o-mini KEY_ENV=OPENAI_API_KEY OPENAI_API_KEY=sk-... npm run demo:chat
```

Any provider AI Nugget supports works the same way — see the AI Nugget
README's provider table.

## What each demo shows

- **`demo:context`** — `ContextEngine.addSource`, BM25 retrieval, a degraded
  `strategy: 'semantic'` request (no embedder configured) surfacing a visible
  `degradedReason` instead of failing silently, manual memory add +
  supersede lifecycle, a `'suggested'` memory policy that never auto-stores,
  and opt-in `redact: true` on packed output.
- **`demo:chat`** — the AI Nugget ↔ Context Nugget bridge
  (`asAiNuggetContextMessages`/`asAiNuggetMetadata`), an app-level
  `blocklistPolicy` (the library ships no policy defaults by design),
  and redacted `TelemetrySink` output for a real `handler.stream` call.
- **`demo:agent`** — `runAgent` with a `search_notes` tool whose `execute`
  calls back into `ContextEngine.retrieveAndPack`, so tool results are
  themselves cited, budgeted context packets.

## Friction encountered developing against both nuggets

See [`docs/friction.md`](docs/friction.md) for the full list — the short
version: AI Nugget vendors a build-ready `dist/`/`nugget/`, Context Nugget
does not (needs one manual build), and consuming either "from the repo" only
works cleanly via `file:` deps to a sibling checkout, which is not something
a standalone clone of this repo can satisfy on its own.

<!-- GitHub Pages deployment is configured in .github/workflows/pages.yml. -->
