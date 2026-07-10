// Shows off Context Nugget on its own: sources -> chunk -> BM25 retrieve ->
// budgeted, cited, untrusted-boundary pack, plus manual/suggested memory
// lifecycle. No AI Nugget involved yet (see demo.ts and agent-demo.ts).
import { randomUUID } from 'node:crypto';
import {
  ContextEngine,
  packContext,
} from '@jxburros/context-nugget';
import type { MemoryPolicy } from '@jxburros/context-nugget';

function line(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  line('1. Ingest sources');
  const engine = new ContextEngine();

  await engine.addSource({
    id: 'readme',
    kind: 'markdown',
    title: 'Nugget Bench README',
    trust: 'trusted',
    content: `# Nugget Bench\n\nNugget Bench is a demo app pairing AI Nugget and Context Nugget. It ingests notes, retrieves the most relevant ones for a question, and hands packed, cited context to a model.`,
  });

  await engine.addSource({
    id: 'runbook',
    kind: 'markdown',
    title: 'On-call Runbook',
    trust: 'trusted',
    content: `# On-call\n\nIf the mock provider is unreachable, restart it with npm run mock-provider. Real providers are configured via env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, or a local Ollama baseUrl.`,
  });

  await engine.addSource({
    id: 'issue-142',
    kind: 'text',
    title: 'GitHub issue #142 (untrusted)',
    trust: 'untrusted',
    content: `A user reports that streaming replies stop mid-sentence when the network drops. Expected: AI Nugget's retry/backoff should recover automatically for retryable errors.`,
  });
  console.log('Added 3 sources: readme (trusted), runbook (trusted), issue-142 (untrusted).');

  line('2. BM25 retrieve + budgeted, cited pack (with untrusted boundary)');
  const query = 'what happens when the network drops during streaming?';
  const pack = await engine.retrieveAndPack(
    { query, strategy: 'bm25', budget: { maxTokens: 400, maxItemsPerSource: 2 } },
    { includeCitations: true, includeTrust: true, trustBoundary: 'untrusted-source-data', trustBoundaryNonce: randomUUID() },
  );
  console.log('packet diagnostics:', pack.packet.diagnostics);
  console.log('--- packed text ---');
  console.log(pack.text);
  console.log('--- citations ---');
  console.log(pack.citations);

  line('3. Degraded-strategy diagnostics (semantic requested, no embedder configured)');
  const degraded = await engine.retrieve({ query, strategy: 'semantic' });
  console.log('degraded:', degraded.degraded, '| reason:', degraded.degradedReason);

  line('4. Manual memory: store + retrieve + supersede');
  await engine.addMemory({
    id: 'pref-1',
    layer: 'user',
    scope: 'user:demo',
    text: 'The user wants terse answers with citations.',
    importance: 0.8,
    confidence: 1,
    createdAt: new Date(0).toISOString(),
  });
  const withMemory = await engine.retrieve({ query: 'how should answers be formatted', layers: ['user'], scope: 'user:demo', strategy: 'bm25' });
  console.log('memory chunk retrieved:', withMemory.items.map((item) => item.text));

  await engine.addMemory({
    id: 'pref-2',
    layer: 'user',
    scope: 'user:demo',
    text: 'The user wants terse answers with citations and no filler.',
    importance: 0.9,
    confidence: 1,
    createdAt: new Date(1).toISOString(),
    supersedes: ['pref-1'],
  });
  const afterSupersede = await engine.retrieve({ query: 'how should answers be formatted', layers: ['user'], scope: 'user:demo', strategy: 'bm25' });
  console.log('after supersede, retrieved:', afterSupersede.items.map((item) => item.text));
  console.log('(pref-1 no longer appears; its chunk was removed when pref-2 superseded it)');

  line('5. suggestMemory under a "suggested" policy (never auto-stores)');
  const suggestedPolicy: MemoryPolicy = {
    mode: 'suggested',
    shouldStore: () => ({ store: true, reason: 'looks durable' }),
  };
  const suggestingEngine = new ContextEngine({ memoryPolicy: suggestedPolicy });
  const suggestion = await suggestingEngine.suggestMemory({
    layer: 'user',
    scope: 'user:demo',
    text: 'The user is debugging on-call runbook gaps this week.',
    importance: 0.6,
    confidence: 0.7,
  });
  console.log('decision:', suggestion.decision, '| record stored directly?', Boolean(suggestion.record));
  console.log('(mode "suggested" means the app must call addMemory itself after human approval; the engine never does it automatically)');

  line('6. Opt-in redaction on pack output');
  await engine.addSource({
    id: 'leaky-note',
    kind: 'text',
    trust: 'trusted',
    content: 'Reminder: rotate the key sk-live-abc123examplenotreal before Friday.',
  });
  const unredacted = await engine.retrieveAndPack({ query: 'rotate key reminder', strategy: 'bm25' }, {});
  const redacted = await engine.retrieveAndPack({ query: 'rotate key reminder', strategy: 'bm25' }, { redact: true });
  console.log('unredacted contains secret:', unredacted.text.includes('sk-live'));
  console.log('redacted contains secret:', redacted.text.includes('sk-live'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
