import { ContextEngine, markdownChunker, bm25Retriever } from '@jxburros/context-nugget';
import { asAiNuggetContextMessages } from '@jxburros/context-nugget/ai-nugget';
import type { AppData } from './types';

export async function buildGameContext(data: AppData, query: string) {
  const engine = new ContextEngine({
    chunker: markdownChunker({ maxWords: 220, overlapWords: 25 }),
    retriever: bm25Retriever()
  });

  const gameText = data.games.map((game) => `## ${game.title}\nPlatform: ${game.platform}\nGenres: ${game.genres.join(', ')}\nStatus: ${game.status}\nPriority: ${game.priority}\nDescription: ${game.description}`).join('\n\n');
  const sessionText = data.sessions.map((session) => {
    const game = data.games.find((candidate) => candidate.id === session.gameId);
    return `## ${game?.title ?? 'Unknown'} — ${session.startedAt}\nMinutes: ${Math.round(session.durationSeconds / 60)}\nNotes: ${session.notes || 'None'}`;
  }).join('\n\n');

  await engine.addSource({ id: 'game-library', kind: 'markdown', title: 'Game Library', content: gameText || 'No games yet.', trust: 'trusted' });
  await engine.addSource({ id: 'play-sessions', kind: 'markdown', title: 'Play Sessions', content: sessionText || 'No sessions yet.', trust: 'trusted' });

  const packet = await engine.retrieveAndPack({
    query,
    layers: ['documents'],
    budget: { maxTokens: 1600, maxItems: 8, maxItemsPerSource: 5 },
    pack: { includeCitations: true }
  });

  return { packet, messages: asAiNuggetContextMessages(packet) };
}
