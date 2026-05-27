import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./lib/auth";
import { BookOpenIcon, TrophyIcon, StarIcon, TargetIcon } from "./components/Icons";
import StatCard from "./components/StatCard";
import NavBar from "./components/NavBar";

interface UserInfo {
  user_id: number;
  email: string;
  name: string | null;
  picture_url: string | null;
}

interface Cycle {
  cycle_id: number;
  cycle_number: number;
  chapters_read: number;
  total_chapters: number;
  books_complete: number;
}

interface Stats {
  total_chapters: number;
  total_days: number;
  best_streak: number;
  chapters_last_7_days: number;
}

interface FavoriteBook {
  book_id: number;
  book_name: string;
  cycle_count: number;
}

const TOTAL_BOOKS = 66;
const TOTAL_CHAPTERS = 1189;

export default function Profile({
  onLogout,
  theme,
  onToggleTheme,
}: {
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBook[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const headers = authHeaders();
    Promise.all([
      fetch("/auth/me", { headers }).then((r) => {
        if (r.status === 401) {
          onLogout();
          return null;
        }
        return r.json();
      }),
      fetch("/api/cycles", { headers }).then((r) => {
        if (r.status === 401) {
          onLogout();
          return null;
        }
        return r.json();
      }),
      fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, {
        headers,
      }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/favorites", { headers }).then((r) => {
        if (r.status === 401) {
          onLogout();
          return null;
        }
        return r.ok ? r.json() : null;
      }),
    ]).then(([userData, cyclesData, statsData, favoritesData]) => {
      if (userData) setUser(userData);
      if (cyclesData) setCycles(cyclesData);
      if (statsData) setStats(statsData);
      if (favoritesData !== null && favoritesData !== undefined) {
        setFavorites(favoritesData);
      } else {
        setFavoritesError(true);
      }
      setFavoritesLoading(false);
    });
  }, []);

  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null;
  const pastCycles = cycles.slice(0, -1);

  const avgPerDay = stats ? +(stats.chapters_last_7_days / 7).toFixed(1) : 0;
  const paceCardValue = avgPerDay > 0 ? `${avgPerDay} ch/day` : "No recent activity";
  const chaptersRemaining = currentCycle ? TOTAL_CHAPTERS - currentCycle.chapters_read : 0;
  const projectedDays = avgPerDay > 0 ? Math.round(chaptersRemaining / avgPerDay) : null;
  const projectionNote =
    projectedDays !== null
      ? projectedDays < 14
        ? `~${projectedDays} days to finish`
        : `~${Math.round(projectedDays / 7)} weeks to finish`
      : null;

  const currentCyclePct = currentCycle ? (currentCycle.chapters_read / TOTAL_CHAPTERS) * 100 : 0;
  const firstCompletedIdx = pastCycles.findIndex(
    (c) => Math.round((c.chapters_read / TOTAL_CHAPTERS) * 100) === 100
  );

  const hasAchievements =
    (stats?.best_streak ?? 0) >= 7 ||
    (stats?.total_chapters ?? 0) >= 100;

  const handleNewCycle = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) throw new Error("Failed to create cycle");
      dialogRef.current?.close();
      navigate("/tracker");
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 md:pb-0">
      <NavBar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        pictureUrl={user?.picture_url}
        userName={user?.name}
      />

      <div className="flex flex-col gap-4 px-5 py-5 max-w-3xl mx-auto w-full">
        {/* User info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
          {user?.picture_url ? (
            <img
              src={user.picture_url}
              alt="avatar"
              className="w-14 h-14 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {user?.name?.[0] ?? "?"}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {user?.name ?? "—"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {user?.email ?? "—"}
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Best Streak" value={`${stats?.best_streak ?? 0}d`} icon={<TrophyIcon size={18} />} />
          <StatCard label="Total Chapters" value={stats?.total_chapters ?? 0} icon={<BookOpenIcon size={18} />} />
          <StatCard label="Reading Days" value={stats?.total_days ?? 0} icon={<StarIcon size={18} />} />
          <StatCard label="Avg Pace" value={paceCardValue} icon={<TargetIcon size={18} />} />
        </div>

        {projectionNote && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center -mt-1">
            {projectionNote}
          </p>
        )}

        {hasAchievements && (
          <div className="flex flex-wrap gap-2">
            {(stats?.best_streak ?? 0) >= 7 && (
              <span className="badge badge-primary badge-sm">7-day streak</span>
            )}
            {(stats?.best_streak ?? 0) >= 30 && (
              <span className="badge badge-primary badge-sm">30-day streak</span>
            )}
            {(stats?.total_chapters ?? 0) >= 100 && (
              <span className="badge badge-secondary badge-sm">100 chapters</span>
            )}
            {(stats?.total_chapters ?? 0) >= 500 && (
              <span className="badge badge-secondary badge-sm">500 chapters</span>
            )}
            {(stats?.total_chapters ?? 0) >= 1189 && (
              <span className="badge badge-success badge-sm">Full Bible read</span>
            )}
          </div>
        )}

        {/* Current cycle */}
        {currentCycle && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Current Cycle — #{currentCycle.cycle_number}
            </h2>
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-1.5">
              <span>Chapters</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {currentCycle.chapters_read} / {TOTAL_CHAPTERS}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{
                  width: `${Math.round(
                    (currentCycle.chapters_read / TOTAL_CHAPTERS) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span>
                {Math.round(
                  (currentCycle.chapters_read / TOTAL_CHAPTERS) * 100
                )}
                % complete
              </span>
              <span>
                {currentCycle.books_complete} / {TOTAL_BOOKS} books
              </span>
              {currentCyclePct >= 50 && (
                <span className="badge badge-warning badge-sm">Halfway there!</span>
              )}
            </div>
          </div>
        )}

        {/* Start New Cycle */}
        <div>
          <button
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            onClick={() => dialogRef.current?.showModal()}
          >
            Start New Cycle
          </button>
        </div>

        {/* Past cycles */}
        {pastCycles.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Cycle History
            </h2>
            <div className="flex flex-col gap-2">
              {pastCycles.map((cycle, idx) => {
                const pct = Math.round(
                  (cycle.chapters_read / TOTAL_CHAPTERS) * 100
                );
                return (
                  <div
                    key={cycle.cycle_id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Cycle {cycle.cycle_number}
                      </span>
                      {firstCompletedIdx !== -1 && idx === firstCompletedIdx && (
                        <span className="badge badge-success badge-sm">First completion!</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      {pct}% · {cycle.chapters_read} chapters ·{" "}
                      {cycle.books_complete} books
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Favorite Books */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Favorite Books
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">
              — most-read across all cycles
            </span>
          </h2>

          {favoritesLoading && (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
          )}

          {!favoritesLoading && favoritesError && (
            <p className="text-sm text-red-400">Could not load favorites.</p>
          )}

          {!favoritesLoading && !favoritesError && favorites.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Start reading to see your favorites here.
            </p>
          )}

          {!favoritesLoading && !favoritesError && favorites.length > 0 && (() => {
            const maxCount = favorites[0].cycle_count;
            return (
              <div className="flex flex-col gap-3">
                {favorites.map((book) => (
                  <div key={book.book_id} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {book.book_name}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${(book.cycle_count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 w-14 text-right">
                      {book.cycle_count} {book.cycle_count === 1 ? "cycle" : "cycles"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Confirmation dialog */}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box rounded-2xl dark:bg-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
            Start a new cycle?
          </h3>
          <p className="py-4 text-sm text-slate-600 dark:text-slate-300">
            Starting a new cycle resets your reading progress. Your current
            cycle's progress is saved in history.
          </p>
          <div className="modal-action">
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
              onClick={handleNewCycle}
              disabled={creating}
            >
              {creating ? "Creating…" : "Start New Cycle"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
