// Shows AI Nugget and Context Nugget working together: retrieve+pack context,
// bridge it into chat messages, then run it through the full AIHandler
// pipeline (policy -> key resolution -> retry -> provider adapter ->
// redacted telemetry) against the local mock provider.
//
// Swap providers without touching this file: set MOCK=0 and export
// OPENAI_API_KEY (or point PROVIDER/MODEL/BASE_URL at another connection).
// See README.md.
import { ContextEngine } from '@jxburros/context-nugget';
import { asAiNuggetContextMessages, asAiNuggetMetadata } from '@jxburros/context-nugget/ai-nugget';
import { AIHandler, blocklistPolicy, literalKeySource, envKeySource } from '@jxburros/ai-nugget';
import type { Connection, ChatMessage } from '@jxburros/ai-nugget';

const useMock = process.env.MOCK !== '0';

async function main() {
  console.log(`\n=== Context Nugget: ingest + retrieve + pack ===`);
  const engine = new ContextEngine();
  await engine.addSource({
    id: 'runbook',
    kind: 'markdown',
    title: 'On-call Runbook',
    trust: 'trusted',
    content: `# On-call\n\nIf the mock provider is unreachable, restart it with npm run mock-provider. AI Nugget retries retryable errors with backoff automatically.`,
  });
  await engine.addSource({
    id: 'issue-142',
    kind: 'text',
    title: 'GitHub issue #142',
    trust: 'untrusted',
    content: `Streaming replies reportedly stop mid-sentence when the network drops.`,
  });

  const question = 'What happens if the network drops while streaming a reply?';
  const context = await engine.retrieveAndPack(
    { query: question, strategy: 'bm25', budget: { maxTokens: 500 } },
    { includeCitations: true, trustBoundary: 'untrusted-source-data' },
  );
  console.log('packed context text:\n', context.text);

  console.log(`\n=== AI Nugget: bridge context into chat messages ===`);
  const messages: ChatMessage[] = [
    { role: 'system', content: 'Use provided context when relevant. Do not invent sources.' },
    ...asAiNuggetContextMessages(context),
    { role: 'user', content: question },
  ];
  const metadata = asAiNuggetMetadata(context);
  console.log('metadata from bridge:', metadata);

  console.log(`\n=== AI Nugget: policy + telemetry + redacted call ===`);
  const telemetryLog: unknown[] = [];
  const handler = new AIHandler({
    keySource: useMock ? literalKeySource() : envKeySource(),
    policy: blocklistPolicy([/openai\/gpt-3\.5.*/]), // app-level policy; the library ships no defaults
    telemetry: { record: (r) => void telemetryLog.push(r) },
  });

  const connection: Connection = useMock
    ? { id: 'mock', provider: 'openai-compat', baseUrl: 'http://localhost:8934', keyRef: { kind: 'literal', value: 'mock-demo-key-not-real' } }
    : {
        id: process.env.PROVIDER ?? 'openai',
        provider: process.env.PROVIDER ?? 'openai',
        keyRef: { kind: 'env', name: process.env.KEY_ENV ?? 'OPENAI_API_KEY' },
      };
  const model = process.env.MODEL ?? (useMock ? 'mock-model' : 'gpt-4o-mini');

  process.stdout.write('assistant: ');
  for await (const event of handler.stream(connection, { model, messages, metadata })) {
    if (event.type === 'delta') process.stdout.write(event.text);
    if (event.type === 'error') console.error('\n[error]', event.error);
    if (event.type === 'done') console.log('\n\nusage:', event.result.usage, '| finishReason:', event.result.finishReason);
  }

  console.log('\n=== Telemetry (redacted) recorded for this call ===');
  console.log(telemetryLog);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
