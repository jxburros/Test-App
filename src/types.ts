export type GameStatus = 'backlog' | 'playing' | 'paused' | 'completed' | 'dropped';

export interface Game {
  id: string;
  title: string;
  platform: string;
  genres: string[];
  description: string;
  status: GameStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt?: string;
  cover?: string;
  rating?: number;
}

export interface Session {
  id: string;
  gameId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  notes: string;
  mood?: string;
}

export interface AppData {
  games: Game[];
  sessions: Session[];
  activeGameId?: string;
}
