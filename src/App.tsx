import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, BookOpen, Clock3, Download, Gamepad2, Library, Pause, Play, Plus, RotateCcw, Sparkles, Square, Timer, Trash2, Trophy } from 'lucide-react';
import type { AppData, Game, GameStatus, Session } from './types';
import { downloadBackup, loadData, saveData } from './storage';
import { buildGameContext } from './ai';

const uid = () => crypto.randomUUID();
const fmt = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
const day = (iso: string) => iso.slice(0, 10);

type TimerState = { gameId: string; startedAt: string; elapsed: number; running: boolean };

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [view, setView] = useState('dashboard');
  const [showGame, setShowGame] = useState(false);
  const [query, setQuery] = useState('');
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [aiText, setAiText] = useState('');
  const interval = useRef<number | undefined>(undefined);

  useEffect(() => saveData(data), [data]);
  useEffect(() => {
    if (timer?.running) interval.current = window.setInterval(() => setTimer((current) => current ? { ...current, elapsed: Math.floor((Date.now() - new Date(current.startedAt).getTime()) / 1000) } : current), 1000);
    return () => clearInterval(interval.current);
  }, [timer?.running]);

  const active = data.games.find((game) => game.id === data.activeGameId) ?? data.games.find((game) => game.status === 'playing');
  const total = data.sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), seconds: data.sessions.filter((session) => day(session.startedAt) === key).reduce((sum, session) => sum + session.durationSeconds, 0) };
  }), [data.sessions]);
  const suggestion = useMemo(() => data.games.filter((game) => ['backlog', 'playing', 'paused'].includes(game.status)).sort((a, b) => (b.priority * 10 + (b.status === 'playing' ? 5 : 0)) - (a.priority * 10 + (a.status === 'playing' ? 5 : 0)))[0], [data.games]);

  function saveGame(game: Game) {
    setData((current) => ({ ...current, games: [game, ...current.games.filter((item) => item.id !== game.id)], activeGameId: current.activeGameId ?? game.id }));
  }
  function removeGame(id: string) {
    setData((current) => ({ ...current, games: current.games.filter((game) => game.id !== id), sessions: current.sessions.filter((session) => session.gameId !== id), activeGameId: current.activeGameId === id ? undefined : current.activeGameId }));
  }
  function start(gameId: string) {
    const startedAt = new Date().toISOString();
    setTimer({ gameId, startedAt, elapsed: 0, running: true });
    setData((current) => ({ ...current, activeGameId: gameId, games: current.games.map((game) => game.id === gameId ? { ...game, status: 'playing', lastPlayedAt: startedAt } : game) }));
  }
  function stop(notes = '') {
    if (!timer) return;
    const endedAt = new Date().toISOString();
    const session: Session = { id: uid(), gameId: timer.gameId, startedAt: timer.startedAt, endedAt, durationSeconds: Math.max(1, timer.elapsed), notes };
    setData((current) => ({ ...current, sessions: [session, ...current.sessions] }));
    setTimer(null);
  }
  async function prepareAI() {
    const { packet } = await buildGameContext(data, 'Suggest what I should play next based on priority, status, recency, and session notes.');
    setAiText(`AI context ready: ${packet.packet.items.length} cited items and about ${packet.packet.diagnostics?.estimatedTokens ?? packet.tokensEstimated ?? 0} tokens. A secure AI Nugget server route can now turn it into a live assistant.`);
  }

  const navigation = [
    ['dashboard', Gamepad2, 'Home'],
    ['library', Library, 'Library'],
    ['sessions', Clock3, 'Sessions'],
    ['insights', BarChart3, 'Insights']
  ] as const;

  return <div className="app-shell">
    <aside>
      <div className="brand"><span className="brand-icon"><Gamepad2 /></span><div><b>GAME VAULT</b><small>PLAYER ONE</small></div></div>
      <nav>{navigation.map(([id, Icon, label]) => <button className={view === id ? 'active' : ''} onClick={() => setView(id)} key={id}><Icon size={18} />{label}</button>)}</nav>
      <div className="side-stats"><span>VAULT LEVEL</span><strong>{Math.floor(total / 3600) + 1}</strong><div className="xp"><i style={{ width: `${Math.min(100, (total % 3600) / 36)}%` }} /></div><small>{fmt(total)} logged</small></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">LOCAL-FIRST PLAY JOURNAL</p><h1>{view === 'dashboard' ? 'Ready, Player One' : view[0].toUpperCase() + view.slice(1)}</h1></div><button className="primary" onClick={() => setShowGame(true)}><Plus size={18} />Add game</button></header>

      {view === 'dashboard' && <>
        <section className="hero"><div className="hero-copy"><span className="status-chip">NOW PLAYING</span><h2>{active?.title ?? 'Choose your next adventure'}</h2><p>{active?.description ?? 'Add a game to begin building your personal play history.'}</p><div className="tag-row">{active?.genres.map((genre) => <span key={genre}>{genre}</span>)}</div><div className="hero-actions">{active && (!timer ? <button className="cta" onClick={() => start(active.id)}><Play />Start session</button> : timer.gameId === active.id ? <button className="danger" onClick={() => stop()}><Square />End {fmt(timer.elapsed)}</button> : null)}<button className="ghost" onClick={() => setView('library')}><BookOpen />View library</button></div></div><div className="hero-art"><div className="orb"><Gamepad2 size={82} /></div></div></section>
        <section className="metrics"><Metric icon={Clock3} label="Total playtime" value={fmt(total)} /><Metric icon={Trophy} label="Completed" value={String(data.games.filter((game) => game.status === 'completed').length)} /><Metric icon={Activity} label="Sessions" value={String(data.sessions.length)} /><Metric icon={Library} label="Backlog" value={String(data.games.filter((game) => game.status === 'backlog').length)} /></section>
        <div className="grid-2"><section className="panel"><div className="panel-title"><div><span>WEEKLY SIGNAL</span><h3>Play rhythm</h3></div><BarChart3 /></div><Bars values={last7} /></section><section className="panel suggestion"><div className="panel-title"><div><span>QUEST RECOMMENDATION</span><h3>What next?</h3></div><Sparkles /></div>{suggestion ? <><h2>{suggestion.title}</h2><p>{suggestion.description}</p><button className="secondary" onClick={() => start(suggestion.id)}>Accept quest</button></> : <p>Add more games to receive suggestions.</p>}<button className="ai-link" onClick={prepareAI}>Prepare AI context</button>{aiText && <small className="ai-note">{aiText}</small>}</section></div>
      </>}

      {view === 'library' && <section className="panel"><div className="toolbar"><input placeholder="Search games, platforms, genres…" value={query} onChange={(event) => setQuery(event.target.value)} /><span>{data.games.length} games</span></div><div className="game-grid">{data.games.filter((game) => `${game.title} ${game.platform} ${game.genres.join(' ')}`.toLowerCase().includes(query.toLowerCase())).map((game) => <article className="game-card" key={game.id}><div className="cover"><Gamepad2 size={42} /><b>{game.platform}</b></div><div><span className={`pill ${game.status}`}>{game.status}</span><h3>{game.title}</h3><p>{game.description}</p><div className="tag-row">{game.genres.map((genre) => <span key={genre}>{genre}</span>)}</div><footer><button onClick={() => setData((current) => ({ ...current, activeGameId: game.id }))}>Make active</button><button onClick={() => start(game.id)}><Timer size={15} />Play</button><button className="icon-btn" onClick={() => removeGame(game.id)}><Trash2 size={15} /></button></footer></div></article>)}</div></section>}
      {view === 'sessions' && <Sessions data={data} setData={setData} />}
      {view === 'insights' && <Insights data={data} last7={last7} />}
    </main>

    {timer && <div className="timer-dock"><div><span>SESSION ACTIVE</span><b>{data.games.find((game) => game.id === timer.gameId)?.title}</b></div><strong>{new Date(timer.elapsed * 1000).toISOString().slice(11, 19)}</strong><button onClick={() => setTimer((current) => current ? { ...current, running: !current.running } : current)}>{timer.running ? <Pause /> : <Play />}</button><button onClick={() => stop()}><Square /></button></div>}
    {showGame && <GameModal close={() => setShowGame(false)} save={(game: Game) => { saveGame(game); setShowGame(false); }} />}
    <button className="backup" title="Download backup" onClick={() => downloadBackup(data)}><Download /></button>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="metric"><Icon /><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function Bars({ values }: { values: { label: string; seconds: number }[] }) {
  const max = Math.max(...values.map((value) => value.seconds), 1);
  return <div className="bars">{values.map((value) => <div key={value.label}><i style={{ height: `${Math.max(5, value.seconds / max * 100)}%` }} /><span>{value.label}</span></div>)}</div>;
}

function GameModal({ close, save }: { close: () => void; save: (game: Game) => void }) {
  const [form, setForm] = useState({ title: '', platform: 'PC', genres: '', description: '', status: 'backlog' as GameStatus, priority: 3 });
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    save({ id: uid(), title: form.title.trim(), platform: form.platform.trim(), genres: form.genres.split(',').map((genre) => genre.trim()).filter(Boolean), description: form.description.trim(), status: form.status, priority: form.priority as Game['priority'], createdAt: now, updatedAt: now });
  }
  return <div className="modal-bg" onMouseDown={close}><form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">NEW QUEST</span><h2>Add a game</h2><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="form-row"><label>Platform<input value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} /></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as GameStatus })}>{['backlog', 'playing', 'paused', 'completed', 'dropped'].map((status) => <option key={status}>{status}</option>)}</select></label></div><label>Genres, comma separated<input value={form.genres} onChange={(event) => setForm({ ...form, genres: event.target.value })} /></label><label>Description<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Priority: {form.priority}<input type="range" min="1" max="5" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label><div className="modal-actions"><button type="button" onClick={close}>Cancel</button><button className="primary">Add to vault</button></div></form></div>;
}

function Sessions({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const [gameId, setGameId] = useState(data.games[0]?.id ?? '');
  const [minutes, setMinutes] = useState(60);
  const [notes, setNotes] = useState('');
  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!gameId) return;
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60000);
    setData((current) => ({ ...current, sessions: [{ id: uid(), gameId, startedAt: start.toISOString(), endedAt: end.toISOString(), durationSeconds: minutes * 60, notes }, ...current.sessions] }));
    setNotes('');
  }
  return <div className="grid-2"><section className="panel"><span className="eyebrow">MANUAL ENTRY</span><h2>Log a session</h2><form className="session-form" onSubmit={add}><label>Game<select value={gameId} onChange={(event) => setGameId(event.target.value)}>{data.games.map((game) => <option value={game.id} key={game.id}>{game.title}</option>)}</select></label><label>Minutes<input type="number" min="1" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label><label>What happened? How did it feel?<textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Beat the first boss. The soundtrack was incredible…" /></label><button className="primary">Save session</button></form></section><section className="panel"><span className="eyebrow">ACTIVITY LOG</span><h2>Recent sessions</h2><div className="session-list">{data.sessions.map((session) => { const game = data.games.find((candidate) => candidate.id === session.gameId); return <article key={session.id}><div><b>{game?.title ?? 'Deleted game'}</b><span>{new Date(session.startedAt).toLocaleString()} · {fmt(session.durationSeconds)}</span></div><p>{session.notes || 'No notes.'}</p></article>; })}</div></section></div>;
}

function Insights({ data, last7 }: { data: AppData; last7: { label: string; seconds: number }[] }) {
  const byGenre = new Map<string, number>();
  data.sessions.forEach((session) => data.games.find((game) => game.id === session.gameId)?.genres.forEach((genre) => byGenre.set(genre, (byGenre.get(genre) || 0) + session.durationSeconds)));
  const top = [...byGenre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return <><section className="metrics"><Metric icon={Clock3} label="Average session" value={fmt(data.sessions.length ? data.sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / data.sessions.length : 0)} /><Metric icon={RotateCcw} label="Games revisited" value={String(new Set(data.sessions.map((session) => session.gameId)).size)} /><Metric icon={Trophy} label="Completion rate" value={`${data.games.length ? Math.round(data.games.filter((game) => game.status === 'completed').length / data.games.length * 100) : 0}%`} /></section><div className="grid-2"><section className="panel"><span className="eyebrow">LAST 7 DAYS</span><h2>Playtime trend</h2><Bars values={last7} /></section><section className="panel"><span className="eyebrow">GENRE GRAVITY</span><h2>Where time goes</h2><div className="genre-list">{top.map(([genre, seconds]) => <div key={genre}><span>{genre}</span><b>{fmt(seconds)}</b><i style={{ width: `${seconds / (top[0]?.[1] || 1) * 100}%` }} /></div>)}</div></section></div></>;
}
