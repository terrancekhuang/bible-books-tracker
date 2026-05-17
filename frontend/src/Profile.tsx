import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "./lib/auth";
import { BookOpenIcon, TrophyIcon, StarIcon } from "./components/Icons";
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
    ]).then(([userData, cyclesData, statsData]) => {
      if (userData) setUser(userData);
      if (cyclesData) setCycles(cyclesData);
      if (statsData) setStats(statsData);
    });
  }, []);

  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null;
  const pastCycles = cycles.slice(0, -1);

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
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Best Streak" value={`${stats?.best_streak ?? 0}d`} icon={<TrophyIcon size={18} />} />
          <StatCard label="Total Chapters" value={stats?.total_chapters ?? 0} icon={<BookOpenIcon size={18} />} />
          <StatCard label="Reading Days" value={stats?.total_days ?? 0} icon={<StarIcon size={18} />} />
        </div>

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
            <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>
                {Math.round(
                  (currentCycle.chapters_read / TOTAL_CHAPTERS) * 100
                )}
                % complete
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
                const pct = Math.round(
                  (cycle.chapters_read / TOTAL_CHAPTERS) * 100
                );
                return (
                  <div
                    key={cycle.cycle_id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Cycle {cycle.cycle_number}
                    </span>
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
