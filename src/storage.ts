import type { AppData } from './types';

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

export function loadData(): AppData {
  try {
    const value = localStorage.getItem(KEY);
    return value ? JSON.parse(value) : seed;
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
  URL.revokeObjectURL(url);
}
