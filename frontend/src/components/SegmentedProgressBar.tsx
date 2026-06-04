import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../lib/ThemeContext'

export default function SegmentedProgressBar({ total, readChapters }: { total: number; readChapters: number[] }) {
  const { isDark } = useTheme()
  const readSet = new Set(readChapters);
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ chapter: number; x: number; y: number } | null>(null);

  const runs: { start: number; end: number; read: boolean }[] = [];
  for (let i = 1; i <= total; i++) {
    const read = readSet.has(i);
    if (runs.length === 0 || runs[runs.length - 1].read !== read) {
      runs.push({ start: i, end: i, read });
    } else {
      runs[runs.length - 1].end = i;
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const chapter = Math.max(1, Math.min(total, Math.ceil(((e.clientX - rect.left) / rect.width) * total)));
    setTooltip({ chapter, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="mt-2.5">
      <div
        ref={barRef}
        className="flex h-2 gap-0.5 cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {runs.map((run, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{
              flex: run.end - run.start + 1,
              background: run.read
                ? (isDark ? 'rgba(150,175,255,0.72)' : 'rgba(13,21,51,0.55)')
                : (isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.08)'),
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
            fontFamily: "'Raleway', sans-serif",
          }}
        >
          Ch. {tooltip.chapter} {readSet.has(tooltip.chapter) ? '· ✓' : ''}
        </div>,
        document.body
      )}
    </div>
  );
}
