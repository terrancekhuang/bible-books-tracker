import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../lib/ThemeContext'

export default function SegmentedProgressBar({ total, readChapters }: { total: number; readChapters: number[] }) {
  const { isDark } = useTheme()
  const readSet = useMemo(() => new Set(readChapters), [readChapters]);
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ chapter: number; x: number; y: number } | null>(null);

  const runs = useMemo(() => {
    const result: { start: number; end: number; read: boolean }[] = [];
    for (let i = 1; i <= total; i++) {
      const read = readSet.has(i);
      if (result.length === 0 || result[result.length - 1].read !== read) {
        result.push({ start: i, end: i, read });
      } else {
        result[result.length - 1].end = i;
      }
    }
    return result;
  }, [total, readSet]);

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
              background: run.read
                ? (isDark ? 'rgba(150,175,255,0.85)' : 'rgba(13,21,51,0.65)')
                : (isDark ? 'rgba(150,175,255,0.1)' : 'rgba(13,21,51,0.08)'),
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
