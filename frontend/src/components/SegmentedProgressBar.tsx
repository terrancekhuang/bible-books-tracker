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
}

const EMPTY: number[] = [];

export default function SegmentedProgressBar({
  total,
  readChapters,
  pendingChapters = EMPTY,
}: SegmentedProgressBarProps) {
  const { isDark } = useTheme()
  const reducedMotion = usePrefersReducedMotion()
  const readSet = useMemo(() => new Set(readChapters), [readChapters]);
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ chapter: number; x: number; y: number } | null>(null);

  // Not memoised: Tracker rebuilds the pending list on every keystroke, so a reference-keyed
  // memo would miss anyway, and this is one pass over at most 150 chapters.
  const runs = buildChapterRuns(total, readChapters, pendingChapters);

  // One hue throughout — pending is the read fill at roughly half strength, so it reads as
  // "this much, not yet committed" rather than as a separate kind of thing.
  const background: Record<SegmentState, string> = {
    read: isDark ? 'rgba(150,175,255,0.85)' : 'rgba(13,21,51,0.65)',
    pending: isDark ? 'rgba(150,175,255,0.38)' : 'rgba(13,21,51,0.28)',
    unread: isDark ? 'rgba(150,175,255,0.1)' : 'rgba(13,21,51,0.08)',
  };

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
        {runs.map((run, i) => (
          <div
            key={i}
            className="rounded-[3px]"
            style={{
              flex: run.end - run.start + 1,
              background: background[run.state],
              // Colour only — transitioning `flex` too would make the segments slither
              // sideways on every keystroke.
              transition: reducedMotion ? undefined : 'background-color 150ms ease',
            }}
          />
        ))}
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
