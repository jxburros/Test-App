# Nugget Bench

A Game Vault demo app that shows [AI Nugget](https://github.com/jxburros/AI-Nugget)
and [Context Nugget](https://github.com/jxburros/AI-Context-Nugget) working
together. The browser app uses the published packages and remains local-first.

```txt
Context Nugget -> finds, ranks, cites, budgets, and packs context
AI Nugget     -> talks to model providers (policy, retry, redaction, agent loop)
Nugget Bench  -> wires the two together and demonstrates both
```

## Naming

`Nugget Bench` is the repository and integration-demo name. `Game Vault` is the
browser app currently hosted by the bench, so the private package name is
intentionally `game-vault`.

## Install and run

```console
npm ci
npm run dev
```

Open the local address printed by Vite. A production build is available with
`npm run build`, and `npm run preview` serves that build locally.

## Run the demos

Each command-line demo is a standalone script. Run the tiny local,
OpenAI-compatible mock provider first so the pipeline needs no API key and no
external network access:

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

## Configuration

The browser app does not call a model provider and does not read API keys.
`demo:chat` and `demo:agent` default to the bundled mock. For an explicitly
configured command-line test, set these environment variables before running a
demo:

- `MOCK=0` opts out of the bundled mock provider.
- `PROVIDER` selects an AI Nugget provider profile.
- `MODEL` selects a model supported by that configured provider.
- `KEY_ENV` names the environment variable holding the provider key; it
  defaults to `OPENAI_API_KEY`.

Keep raw keys in the shell environment. Do not put them in source, browser
storage, backups, screenshots, or logs. See AI Nugget's provider documentation
for supported connections and models.

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

See [`docs/friction.md`](docs/friction.md) for the historical notes from the
original sibling-source integration. The current app uses published package
versions and installs from a standalone clone.

## Troubleshooting

- If `npm ci` reports a lockfile mismatch, confirm both `package.json` and
  `package-lock.json` came from the same commit.
- If the app server is not reachable, run `npm ci`, then `npm run dev`, and use
  the exact local URL printed by Vite.
- If a command-line demo cannot reach the mock, start `npm run mock-provider`
  in a separate terminal and leave it running.
- If a real-provider demo reports a missing key, confirm `KEY_ENV` names an
  environment variable that is set in the same shell. Never paste the key into
  the source file.
- Browser data that fails validation is safely replaced with the built-in demo
  library. Download a backup before manually editing browser storage.

<!-- GitHub Pages deployment is configured in .github/workflows/pages.yml. -->
