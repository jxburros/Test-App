import type { AppData, Game, GameStatus, Session } from './types';

const KEY = 'game-vault-data-v1';
const now = new Date().toISOString();
const seed: AppData = {
  games: [
    { id: 'g1', title: 'Hades', platform: 'PC', genres: ['Roguelite', 'Action'], description: 'Escape the Underworld one run at a time.', status: 'playing', priority: 5, createdAt: now, updatedAt: now },
    { id: 'g2', title: 'Disco Elysium', platform: 'PC', genres: ['RPG', 'Narrative'], description: 'A detective RPG about identity, failure, and rebuilding.', status: 'backlog', priority: 4, createdAt: now, updatedAt: now }
  ],
  sessions: [],
  activeGameId: 'g1'
};

const statuses: GameStatus[] = ['backlog', 'playing', 'paused', 'completed', 'dropped'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string';
const isOptionalNumber = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value));

function isGame(value: unknown): value is Game {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.platform === 'string'
    && Array.isArray(value.genres)
    && value.genres.every((genre) => typeof genre === 'string')
    && typeof value.description === 'string'
    && statuses.includes(value.status as GameStatus)
    && typeof value.priority === 'number'
    && Number.isInteger(value.priority)
    && value.priority >= 1
    && value.priority <= 5
    && isDate(value.createdAt)
    && isDate(value.updatedAt)
    && (value.lastPlayedAt === undefined || isDate(value.lastPlayedAt))
    && isOptionalString(value.cover)
    && isOptionalNumber(value.rating);
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.gameId === 'string'
    && isDate(value.startedAt)
    && isDate(value.endedAt)
    && typeof value.durationSeconds === 'number'
    && Number.isFinite(value.durationSeconds)
    && value.durationSeconds > 0
    && typeof value.notes === 'string'
    && isOptionalString(value.mood);
}

export function isAppData(value: unknown): value is AppData {
  if (!isRecord(value) || !Array.isArray(value.games) || !value.games.every(isGame) || !Array.isArray(value.sessions) || !value.sessions.every(isSession)) return false;
  if (value.activeGameId !== undefined && typeof value.activeGameId !== 'string') return false;
  const gameIds = new Set(value.games.map((game) => game.id));
  return (!value.activeGameId || gameIds.has(value.activeGameId))
    && value.sessions.every((session) => gameIds.has(session.gameId));
}

export function loadData(): AppData {
  try {
    const value = localStorage.getItem(KEY);
    if (!value) return seed;
    const parsed: unknown = JSON.parse(value);
    return isAppData(parsed) ? parsed : seed;
  } catch {
    return seed;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function downloadBackup(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `game-vault-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
