// Agent tool loop: a "search_notes" tool backed by Context Nugget retrieval,
// driven by AI Nugget's runAgent in promptJson mode (the mode `auto` picks
// for openai-compat, since native tool support there is model-dependent).
import { ContextEngine } from '@jxburros/context-nugget';
import { AIHandler, literalKeySource } from '@jxburros/ai-nugget';
import { defineTool, runAgent } from '@jxburros/ai-nugget/agent';
import type { Connection } from '@jxburros/ai-nugget';

async function main() {
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

  const searchNotes = defineTool({
    name: 'search_notes',
    description: 'Search the team notes for relevant snippets',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    sideEffects: false,
    async execute(args: { query: string }) {
      const pack = await engine.retrieveAndPack({ query: args.query, strategy: 'bm25', budget: { maxTokens: 300 } }, { includeCitations: true });
      return { text: pack.text, citations: pack.citations };
    },
  });

  const handler = new AIHandler({ keySource: literalKeySource() });
  const connection: Connection = { id: 'mock', provider: 'openai-compat', baseUrl: 'http://localhost:8934', keyRef: { kind: 'literal', value: 'mock-demo-key-not-real' } };

  const agent = runAgent({
    handler,
    connection,
    model: 'mock-model',
    tools: [searchNotes],
    toolMode: 'promptJson', // explicit: openai-compat's nativeTools:false makes `auto` resolve the same way
    messages: [{ role: 'user', content: 'What happens if the network drops while streaming?' }],
    budget: { maxSteps: 4 },
  });

  for await (const event of agent) {
    if (event.type === 'step_start') console.log(`\n--- step ${event.step} ---`);
    if (event.type === 'tool_start') console.log('[tool_start]', event.call.name, event.call.arguments);
    if (event.type === 'tool_result') console.log('[tool_result]', event.result);
    if (event.type === 'delta') process.stdout.write(event.text);
    if (event.type === 'error') console.error('[error]', event.error);
  }

  const result = await agent.result;
  console.log('\n\nstopReason:', result.stopReason, '| steps:', result.steps, '| usage:', result.usage);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
