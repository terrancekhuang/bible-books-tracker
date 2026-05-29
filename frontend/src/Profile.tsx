import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./lib/auth";
import { getCache, setCache, invalidateCache } from "./lib/cache";
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

type BadgeTier = "bronze" | "silver" | "gold" | "rainbow";

const BADGE_CFG: Record<
  BadgeTier,
  { ring: string; inner: string; glow: string; label: string; shadow: string }
> = {
  bronze: {
    ring: "linear-gradient(145deg,#b87333 0%,#e8a87c 40%,#cd7f32 60%,#8b4513 100%)",
    inner: "linear-gradient(145deg,#2d1500,#4a2800)",
    glow: "rgba(205,127,50,0.7)",
    label: "#e8a060",
    shadow: "rgba(205,127,50,0.3)",
  },
  silver: {
    ring: "linear-gradient(145deg,#7a7a8a 0%,#e0e0ee 40%,#9a9aaa 60%,#505060 100%)",
    inner: "linear-gradient(145deg,#141420,#20202e)",
    glow: "rgba(180,180,210,0.6)",
    label: "#b8b8d0",
    shadow: "rgba(180,180,210,0.25)",
  },
  gold: {
    ring: "linear-gradient(145deg,#b8860b 0%,#ffe066 35%,#fff3a0 50%,#ffd700 65%,#a06400 100%)",
    inner: "linear-gradient(145deg,#1a1000,#2e1e00)",
    glow: "rgba(255,210,0,0.75)",
    label: "#ffd700",
    shadow: "rgba(255,210,0,0.3)",
  },
  rainbow: {
    ring: "linear-gradient(135deg,#ff6b6b,#ffd700,#4ecdc4,#a855f7,#ff6b6b)",
    inner: "linear-gradient(145deg,#0d0020,#150830)",
    glow: "rgba(168,85,247,0.85)",
    label: "#e879f9",
    shadow: "rgba(168,85,247,0.35)",
  },
};

function AchievementBadge({
  icon,
  label,
  tier,
  animDelay = 0,
}: {
  icon: string;
  label: string;
  tier: BadgeTier;
  animDelay?: number;
}) {
  const cfg = BADGE_CFG[tier];
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: 0, width: 80 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: cfg.ring,
          padding: 3,
          boxShadow: hovered
            ? `0 0 28px ${cfg.glow}, 0 0 8px ${cfg.glow}, 0 4px 20px ${cfg.shadow}`
            : `0 0 14px ${cfg.glow}, 0 2px 10px ${cfg.shadow}`,
          transform: hovered ? "scale(1.12) translateY(-2px)" : "scale(1)",
          transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s ease",
          cursor: "default",
          animationDelay: `${animDelay}ms`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: cfg.inner,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            userSelect: "none",
          }}
        >
          {icon}
        </div>
      </div>
      <span
        className="text-xs font-bold text-center leading-tight"
        style={{
          color: cfg.label,
          maxWidth: "100%",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          hyphens: "auto",
        }}
      >
        {label}
      </span>
    </div>
  );
}


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
    const cachedUser = getCache<UserInfo>('user')
    if (cachedUser) setUser(cachedUser)
    const cachedCycles = getCache<Cycle[]>('cycles')
    if (cachedCycles) setCycles(cachedCycles)
    const cachedStats = getCache<Stats>('stats')
    if (cachedStats) setStats(cachedStats)
    const cachedFavorites = getCache<FavoriteBook[]>('favorites')
    if (cachedFavorites) { setFavorites(cachedFavorites); setFavoritesLoading(false) }
    const hasCachedFavorites = cachedFavorites !== null

    const headers = authHeaders();
    Promise.all([
      fetch("/auth/me", { headers }).then((r) => {
        if (r.status === 401) { onLogout(); return null; }
        return r.json();
      }),
      fetch("/api/cycles", { headers }).then((r) => {
        if (r.status === 401) { onLogout(); return null; }
        return r.json();
      }),
      fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, { headers }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch("/api/favorites", { headers }).then((r) => {
        if (r.status === 401) { onLogout(); return null; }
        return r.ok ? r.json() : null;
      }),
    ]).then(([userData, cyclesData, statsData, favoritesData]) => {
      if (userData) { setUser(userData); setCache('user', userData) }
      if (cyclesData) { setCycles(cyclesData); setCache('cycles', cyclesData) }
      if (statsData) { setStats(statsData); setCache('stats', statsData) }
      if (favoritesData !== null && favoritesData !== undefined) {
        setFavorites(favoritesData);
        setCache('favorites', favoritesData)
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

  const completedCycles = cycles.filter((c) => c.books_complete === TOTAL_BOOKS).length;

  const earnedBadges = [
    // — Streak —
    (stats?.best_streak ?? 0) >= 7 && {
      icon: "🔥", label: "7-Day Streak", tier: "bronze" as BadgeTier,
    },
    (stats?.best_streak ?? 0) >= 30 && {
      icon: "🏅", label: "30-Day Streak", tier: "silver" as BadgeTier,
    },
    (stats?.best_streak ?? 0) >= 100 && {
      icon: "⚡", label: "100-Day Streak", tier: "gold" as BadgeTier,
    },
    (stats?.best_streak ?? 0) >= 365 && {
      icon: "👑", label: "Year-Long Streak", tier: "rainbow" as BadgeTier,
    },
    // — Volume —
    (stats?.total_chapters ?? 0) >= 100 && {
      icon: "📖", label: "100 Chapters", tier: "bronze" as BadgeTier,
    },
    (stats?.total_chapters ?? 0) >= 500 && {
      icon: "📚", label: "500 Chapters", tier: "silver" as BadgeTier,
    },
    (stats?.total_chapters ?? 0) >= 1000 && {
      icon: "🌟", label: "1,000 Chapters", tier: "gold" as BadgeTier,
    },
    // — Consistency —
    (stats?.total_days ?? 0) >= 30 && {
      icon: "🗓️", label: "30 Reading Days", tier: "bronze" as BadgeTier,
    },
    (stats?.total_days ?? 0) >= 100 && {
      icon: "📅", label: "100 Reading Days", tier: "silver" as BadgeTier,
    },
    (stats?.total_days ?? 0) >= 365 && {
      icon: "🏛️", label: "365 Reading Days", tier: "gold" as BadgeTier,
    },
    // — Dedication —
    cycles.length >= 2 && {
      icon: "🔄", label: "Second Journey", tier: "silver" as BadgeTier,
    },
    completedCycles >= 1 && {
      icon: "✝️", label: "Bible Complete", tier: "rainbow" as BadgeTier,
    },
    completedCycles >= 2 && {
      icon: "🎖️", label: "Twice Blessed", tier: "rainbow" as BadgeTier,
    },
  ].filter(Boolean) as { icon: string; label: string; tier: BadgeTier }[];

  const handleNewCycle = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error("Failed to create cycle");
      invalidateCache('cycles', 'stats', 'books', 'activity')
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4 min-w-0">
          {user?.picture_url ? (
            <img
              src={user.picture_url}
              alt="avatar"
              className="w-14 h-14 rounded-full shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
              {user?.name?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user?.name ?? "—"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 truncate">
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

        {/* Achievements */}
        {earnedBadges.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-5">
              Achievements
            </h2>
            <div className="flex flex-wrap gap-5">
              {earnedBadges.map((badge, i) => (
                <AchievementBadge
                  key={badge.label}
                  icon={badge.icon}
                  label={badge.label}
                  tier={badge.tier}
                  animDelay={i * 80}
                />
              ))}
            </div>
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
                  width: `${Math.round((currentCycle.chapters_read / TOTAL_CHAPTERS) * 100)}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-400">
              <span>
                {Math.round((currentCycle.chapters_read / TOTAL_CHAPTERS) * 100)}% complete
              </span>
              <span>
                {currentCycle.books_complete} / {TOTAL_BOOKS} books
              </span>
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
              {pastCycles.map((cycle) => {
                const pct = Math.round((cycle.chapters_read / TOTAL_CHAPTERS) * 100);
                return (
                  <div
                    key={cycle.cycle_id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 shrink-0">
                        Cycle {cycle.cycle_number}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400 dark:text-slate-500 sm:text-right shrink-0">
                      {pct}% · {cycle.chapters_read} ch · {cycle.books_complete} bks
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
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden min-w-0">
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
