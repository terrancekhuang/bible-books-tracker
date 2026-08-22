import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../lib/ThemeContext'
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion'
import { buildChapterRuns, type SegmentState } from '../lib/trackerLogic'

interface SegmentedProgressBarProps {
  total: number
  readChapters: number[]
  /** Chapters about to be submitted — drawn as a ghost fill between unread and read. */
  pendingChapters?: number[]
  /** Chapters whose write just landed — the read fill wipes in across these. */
  loggingChapters?: number[]
}

const EMPTY: number[] = [];

/** How long the fill takes to cross a just-logged run. Tracker holds `logging` for this long. */
export const FILL_MS = 520;

/** One pass of the waiting light across the bar. */
const SWEEP_MS = 2200;

export default function SegmentedProgressBar({
  total,
  readChapters,
  pendingChapters = EMPTY,
  loggingChapters = EMPTY,
}: SegmentedProgressBarProps) {
  const { isDark } = useTheme()
  const reducedMotion = usePrefersReducedMotion()
  const readSet = useMemo(() => new Set(readChapters), [readChapters]);
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ chapter: number; x: number; y: number } | null>(null);

  // Not memoised: Tracker rebuilds the pending list on every keystroke, so a reference-keyed
  // memo would miss anyway, and this is one pass over at most 150 chapters.
  const runs = buildChapterRuns(total, readChapters, pendingChapters, loggingChapters);

  // One hue throughout — pending is the read fill at roughly half strength, so it reads as
  // "this much, not yet committed" rather than as a separate kind of thing. A logging run
  // starts from the pending shade and has the read fill wiped over it.
  const READ = isDark ? 'rgba(150,175,255,0.85)' : 'rgba(13,21,51,0.65)';
  const PENDING = isDark ? 'rgba(150,175,255,0.38)' : 'rgba(13,21,51,0.28)';
  const background: Record<SegmentState, string> = {
    read: READ,
    // Mid-wipe the run is painted entirely by its two clipped children, so it stays bare.
    logging: reducedMotion ? READ : 'transparent',
    pending: PENDING,
    unread: isDark ? 'rgba(150,175,255,0.1)' : 'rgba(13,21,51,0.08)',
  };
  // The travelling light leans toward `read`, which means brighter on dark and darker on
  // light. A white sheen is invisible on the light theme, where the read fill is navy.
  const sheen = isDark ? 'rgba(215,230,255,0.55)' : 'rgba(13,21,51,0.42)';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const chapter = Math.max(1, Math.min(total, Math.ceil(((e.clientX - rect.left) / rect.width) * total)));
    setTooltip({ chapter, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="mt-2">
      <div
        ref={barRef}
        className="flex h-3.5 gap-[3px] cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {runs.map((run) => {
          const filling = !reducedMotion && run.state === 'logging';
          return (
          // Keyed by first chapter, not index: when a run merges away, index keys hand its
          // colour transition to whichever run slid into that slot, so the segment after it
          // visibly cross-fades from the wrong shade.
          <div
            key={run.start}
            className="rounded-[3px] relative overflow-hidden"
            style={{
              flex: run.end - run.start + 1,
              background: background[run.state],
              // Colour only — transitioning `flex` too would make the segments slither
              // sideways on every keystroke.
              transition: reducedMotion ? undefined : 'background-color 150ms ease',
              // The bloom rides the run itself: a child's shadow would be cut off by the
              // overflow clip that keeps the sweep inside its segment.
              ...(filling
                ? { '--chapter-bloom': sheen, animation: `chapter-bloom ${FILL_MS}ms ease-out forwards` } as React.CSSProperties
                : null),
            }}
          >
            {!reducedMotion && run.state === 'pending' && (
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, transparent, ${sheen}, transparent)`,
                  animation: `chapter-sweep ${SWEEP_MS}ms ease-in-out infinite`,
                  // Phase each run to where it sits in the bar, so separate pending runs read
                  // as one light crossing rather than several blinking in lockstep.
                  animationDelay: `-${((run.start - 1) / total) * SWEEP_MS}ms`,
                }}
              />
            )}
            {filling && (
              <>
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: PENDING,
                    animation: `chapter-drain ${FILL_MS}ms cubic-bezier(0.16,1,0.3,1) forwards`,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: READ,
                    animation: `chapter-fill ${FILL_MS}ms cubic-bezier(0.16,1,0.3,1) forwards`,
                  }}
                />
              </>
            )}
          </div>
          );
        })}
      </div>
      {tooltip && createPortal(
        <div
          className="fixed text-xs px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-50"
          style={{
            left: tooltip.x, top: tooltip.y - 28, transform: 'translateX(-50%)',
            background: 'rgba(13,21,51,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(150,175,255,0.18)',
            color: 'rgba(195,210,255,0.9)',
          }}
        >
          Ch. {tooltip.chapter} {readSet.has(tooltip.chapter) ? '· ✓' : ''}
        </div>,
        document.body
      )}
    </div>
  );
}
