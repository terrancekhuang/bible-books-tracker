import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./lib/ThemeContext";
import { useCurrentUserQuery, useCyclesQuery, useStatsQuery } from "./lib/queries";
import { useCreateCycle } from "./lib/useCycleMutations";
import { TOTAL_BOOKS, TOTAL_CHAPTERS } from "./lib/trackerLogic";
import { BookOpenIcon, TrophyIcon, StarIcon, TargetIcon } from "./components/Icons";
import StatCard from "./components/StatCard";
import NavBar from "./components/NavBar";

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

function AchievementBadge({ icon, label, tier, animDelay = 0 }: { icon: string; label: string; tier: BadgeTier; animDelay?: number }) {
  const cfg = BADGE_CFG[tier];
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2" style={{ minWidth: 0, width: 80 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 68, height: 68, borderRadius: "50%",
          background: cfg.ring, padding: 3,
          boxShadow: hovered
            ? `0 0 28px ${cfg.glow}, 0 0 8px ${cfg.glow}, 0 4px 20px ${cfg.shadow}`
            : `0 0 14px ${cfg.glow}, 0 2px 10px ${cfg.shadow}`,
          transform: hovered ? "scale(1.12) translateY(-2px)" : "scale(1)",
          transition: "transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s ease",
          cursor: "default",
          animationDelay: `${animDelay}ms`,
          flexShrink: 0,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: cfg.inner, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, userSelect: "none" }}>
          {icon}
        </div>
      </div>
      <span
        className="text-xs font-bold text-center leading-tight"
        style={{ color: cfg.label, maxWidth: "100%", wordBreak: "break-word", overflowWrap: "anywhere", hyphens: "auto", fontFamily: "'Raleway', sans-serif" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function Profile() {
  const { isDark, colors } = useTheme()
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { create: createCycle, isCreating } = useCreateCycle();

  const { primaryText, dimText, bodyText, trackBg } = colors

  // Matches Dashboard's card-section label exactly, so the same role reads identically on both pages.
  const sectionHeadStyle = {
    fontFamily: "'Raleway', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.3em',
    textTransform: 'uppercase' as const,
    color: isDark ? 'rgba(150,175,255,0.65)' : 'rgba(13,21,51,0.5)',
  }

  const glassCard = {
    background: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: isDark ? '1px solid rgba(150,175,255,0.22)' : '1px solid rgba(100,130,255,0.14)',
    borderRadius: '1rem',
  }

  const { data: user } = useCurrentUserQuery()
  const { data: rawCycles } = useCyclesQuery()
  const { data: stats } = useStatsQuery()

  const cycles = rawCycles ?? []
  const currentCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null;
  const pastCycles = cycles.slice(0, -1);

  const avgPerDay = stats ? +(stats.chapters_last_7_days / 7).toFixed(1) : 0;
  const paceCardValue = avgPerDay > 0 ? `${avgPerDay} ch/day` : "No recent activity";
  const chaptersRemaining = currentCycle ? TOTAL_CHAPTERS - currentCycle.chapters_read : 0;
  const projectedDays = avgPerDay > 0 ? Math.round(chaptersRemaining / avgPerDay) : null;
  const projectionNote = projectedDays !== null
    ? projectedDays < 14 ? `~${projectedDays} days to finish` : `~${Math.round(projectedDays / 7)} weeks to finish`
    : null;

  const completedCycles = cycles.filter(c => c.books_complete === TOTAL_BOOKS).length;

  const earnedBadges = [
    (stats?.best_streak ?? 0) >= 7   && { icon: "🔥", label: "7-Day Streak",    tier: "bronze"  as BadgeTier },
    (stats?.best_streak ?? 0) >= 30  && { icon: "🏅", label: "30-Day Streak",   tier: "silver"  as BadgeTier },
    (stats?.best_streak ?? 0) >= 100 && { icon: "⚡", label: "100-Day Streak",  tier: "gold"    as BadgeTier },
    (stats?.best_streak ?? 0) >= 365 && { icon: "👑", label: "Year-Long Streak",tier: "rainbow" as BadgeTier },
    (stats?.total_chapters ?? 0) >= 100  && { icon: "📖", label: "100 Chapters",    tier: "bronze"  as BadgeTier },
    (stats?.total_chapters ?? 0) >= 500  && { icon: "📚", label: "500 Chapters",    tier: "silver"  as BadgeTier },
    (stats?.total_chapters ?? 0) >= 1000 && { icon: "🌟", label: "1,000 Chapters",  tier: "gold"    as BadgeTier },
    (stats?.total_days ?? 0) >= 30  && { icon: "🗓️", label: "30 Reading Days",  tier: "bronze"  as BadgeTier },
    (stats?.total_days ?? 0) >= 100 && { icon: "📅", label: "100 Reading Days", tier: "silver"  as BadgeTier },
    (stats?.total_days ?? 0) >= 365 && { icon: "🏛️", label: "365 Reading Days", tier: "gold"    as BadgeTier },
    cycles.length >= 2     && { icon: "🔄", label: "Second Journey",  tier: "silver"  as BadgeTier },
    completedCycles >= 1   && { icon: "✝️", label: "Bible Complete",  tier: "rainbow" as BadgeTier },
    completedCycles >= 2   && { icon: "🎖️", label: "Twice Blessed",   tier: "rainbow" as BadgeTier },
  ].filter(Boolean) as { icon: string; label: string; tier: BadgeTier }[];

  // createCycle only resolves once the book grid has been refetched, so Tracker paints
  // the new empty cycle rather than the one that was just finished.
  const handleNewCycle = async () => {
    if (!await createCycle()) return;
    dialogRef.current?.close();
    navigate("/tracker");
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      <div className="flex flex-col gap-5 px-4 py-6 max-w-4xl mx-auto w-full">

        {/* User info */}
        <div className="p-5 flex items-center gap-4 min-w-0" style={glassCard}>
          {user?.picture_url ? (
            <img src={user.picture_url} alt="avatar" className="w-14 h-14 rounded-full shrink-0" referrerPolicy="no-referrer" style={{ boxShadow: isDark ? '0 0 0 2px rgba(150,175,255,0.2)' : '0 0 0 2px rgba(13,21,51,0.12)' }} />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
              style={{ background: isDark ? 'rgba(150,175,255,0.15)' : 'rgba(13,21,51,0.08)', color: isDark ? '#aabfff' : '#0d1533', fontFamily: "'Raleway', sans-serif" }}
            >
              {user?.name?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold truncate" style={{ fontFamily: "'Raleway', sans-serif", color: primaryText }}>
              {user?.name ?? "—"}
            </p>
            <p className="text-sm truncate" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
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
          <p className="text-center -mt-1" style={{ color: isDark ? 'rgba(170,195,255,0.65)' : 'rgba(13,21,51,0.55)', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15 }}>
            {projectionNote}
          </p>
        )}

        {/* Achievements */}
        {earnedBadges.length > 0 && (
          <div className="p-5" style={glassCard}>
            <h2 className="mb-5" style={sectionHeadStyle}>Achievements</h2>
            <div className="flex flex-wrap gap-5">
              {earnedBadges.map((badge, i) => (
                <AchievementBadge key={badge.label} icon={badge.icon} label={badge.label} tier={badge.tier} animDelay={i * 80} />
              ))}
            </div>
          </div>
        )}

        {/* Current cycle */}
        {currentCycle && (() => {
          const cyclePct = Math.round((currentCycle.chapters_read / TOTAL_CHAPTERS) * 100);
          return (
          <div className="p-5" style={glassCard}>
            <h2 className="mb-3" style={sectionHeadStyle}>
              Current Cycle — <span style={{ color: isDark ? 'rgba(200,185,100,0.85)' : 'rgba(140,100,20,0.7)' }}>#{currentCycle.cycle_number}</span>
            </h2>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>Chapters</span>
              <span className="font-medium" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>
                {currentCycle.chapters_read} / {TOTAL_CHAPTERS}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: trackBg }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${cyclePct}%`,
                  background: isDark ? 'rgba(150,175,255,0.72)' : 'rgba(13,21,51,0.55)',
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                {cyclePct}% complete
              </span>
              <span style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                {currentCycle.books_complete} / {TOTAL_BOOKS} books
              </span>
            </div>
          </div>
          );
        })()}

        {/* Start New Cycle */}
        <div>
          <button
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isDark ? 'rgba(150,175,255,0.16)' : 'rgba(13,21,51,0.1)',
              border: isDark ? '1px solid rgba(150,175,255,0.25)' : '1px solid rgba(13,21,51,0.18)',
              color: primaryText,
              fontFamily: "'Raleway', sans-serif",
              letterSpacing: '0.06em',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={() => dialogRef.current?.showModal()}
          >
            Start New Cycle
          </button>
        </div>

        {/* Past cycles */}
        {pastCycles.length > 0 && (
          <div className="p-5" style={glassCard}>
            <h2 className="mb-3" style={sectionHeadStyle}>Cycle History</h2>
            <div className="flex flex-col gap-2">
              {pastCycles.map((cycle) => {
                const pct = Math.round((cycle.chapters_read / TOTAL_CHAPTERS) * 100);
                return (
                  <div key={cycle.cycle_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2" style={{ borderBottom: isDark ? '1px solid rgba(150,175,255,0.06)' : '1px solid rgba(13,21,51,0.06)' }}>
                    <span className="text-sm font-medium shrink-0" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>
                      Cycle {cycle.cycle_number}
                    </span>
                    <span className="text-sm sm:text-right shrink-0" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                      {pct}% · {cycle.chapters_read} ch · {cycle.books_complete} bks
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
        <div
          className="modal-box rounded-2xl"
          style={{
            background: isDark ? 'rgba(10,18,50,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: isDark ? '1px solid rgba(150,175,255,0.22)' : '1px solid rgba(100,130,255,0.18)',
          }}
        >
          <h3 className="font-bold text-lg" style={{ fontFamily: "'Cinzel', serif", color: primaryText, letterSpacing: '0.05em' }}>
            Start a new cycle?
          </h3>
          <p className="py-4 text-sm" style={{ color: bodyText, fontFamily: "'Raleway', sans-serif" }}>
            Starting a new cycle resets your reading progress. Your current cycle's progress is saved in history.
          </p>
          <div className="modal-action">
            <button
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ border: isDark ? '1px solid rgba(150,175,255,0.14)' : '1px solid rgba(13,21,51,0.12)', color: dimText, fontFamily: "'Raleway', sans-serif" }}
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{
                background: isDark ? 'rgba(150,175,255,0.2)' : 'rgba(13,21,51,0.1)',
                border: isDark ? '1px solid rgba(150,175,255,0.28)' : '1px solid rgba(13,21,51,0.2)',
                color: primaryText,
                fontFamily: "'Raleway', sans-serif",
                letterSpacing: '0.05em',
              }}
              onClick={handleNewCycle}
              disabled={isCreating}
            >
              {isCreating ? "Creating…" : "Start New Cycle"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop"><button>close</button></form>
      </dialog>

      <footer className="text-center text-sm py-3" style={{ color: dimText }}>
        Made by Terrance Huang
      </footer>
    </div>
  );
}
