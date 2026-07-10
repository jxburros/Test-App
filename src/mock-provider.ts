// A tiny OpenAI-Chat-Completions-compatible server, so the demo can exercise
// AI Nugget's real wire pipeline (SSE parsing, retries, redaction, telemetry,
// agent tool loop) with no external network access and no API keys.
//
// It is a fixture, not a model: replies are scripted from the request
// content. Point a real provider's connection at this instead (see
// README.md) to swap in an actual model without touching the app code.
import http from 'node:http';

interface OpenAiMessage {
  role: string;
  content?: string | null;
  name?: string;
}

const PORT = Number(process.env.MOCK_PROVIDER_PORT ?? 8934);

function sseChunk(id: string, model: string, delta: Record<string, unknown>, finishReason: string | null) {
  return `data: ${JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

function scriptedReply(messages: OpenAiMessage[]): string {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const isPromptJsonAgent = system.includes('When you need tools, respond only with JSON');
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  if (isPromptJsonAgent) {
    const toolReturn = [...messages].reverse().find((m) => m.role === 'user' && /^Tool .* returned:/.test(m.content ?? ''));
    if (toolReturn) {
      const payload = toolReturn.content!.slice(toolReturn.content!.indexOf('returned:') + 'returned:'.length).trim();
      const snippet = extractToolText(payload);
      return `Based on the notes I looked up, here's the answer: ${summarize(snippet)}`;
    }
    return JSON.stringify({ tool: 'search_notes', input: { query: lastUser.replace(/["]/g, '') } });
  }

  // Plain chat: if context was injected (Context Nugget bridge messages), echo
  // that we saw it, so the demo can show the packed context actually reached
  // the model prompt.
  const contextMsg = messages.find((m) => m.role === 'system' && /relevant context|untrusted source data/i.test(m.content ?? ''));
  if (contextMsg) {
    return `I found relevant context (${(contextMsg.content ?? '').length} chars) and answered using it: ${summarize(lastUser)}`;
  }
  return `Mock reply to: ${lastUser}`;
}

function extractToolText(payload: string): string {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed.text === 'string') return parsed.text.replace(/\s+/g, ' ');
  } catch {
    // not JSON-shaped, fall through to the raw payload
  }
  return payload;
}

function summarize(text: string): string {
  const words = text.split(/\s+/).slice(0, 18).join(' ');
  return words.length < text.length ? `${words}...` : words;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let parsed: { model?: string; messages?: OpenAiMessage[]; stream?: boolean };
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    const model = parsed.model ?? 'mock-model';
    const text = scriptedReply(parsed.messages ?? []);
    const id = `chatcmpl-mock-${Date.now()}`;

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(sseChunk(id, model, { role: 'assistant' }, null));
    for (const word of text.split(' ')) {
      res.write(sseChunk(id, model, { content: word + ' ' }, null));
    }
    res.write(sseChunk(id, model, {}, 'stop'));
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

server.listen(PORT, () => {
  console.log(`[mock-provider] listening on http://localhost:${PORT}/chat/completions`);
});
