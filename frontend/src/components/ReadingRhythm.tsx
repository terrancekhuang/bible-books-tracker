import { useState } from 'react'
import { useRhythmQuery } from '../lib/queries'
import {
  PART_LABELS,
  PART_ORDER,
  WEEKDAY_LABELS,
  emphasizedWeekdays,
  insightSentence,
  type RhythmWindow,
  type RhythmWindowKey,
} from '../lib/rhythmLogic'

// Default first, widening to the right — the section opens on Last 90 days.
const WINDOW_OPTIONS: { key: RhythmWindowKey; label: string }[] = [
  { key: 'last_90_days', label: 'Last 90 days' },
  { key: 'all_time', label: 'All time' },
]

const primaryText = 'var(--color-ink)'
const dimText = 'rgba(35,31,26,0.55)'
const bodyText = 'rgba(35,31,26,0.78)'
const trackBg = 'rgba(35,31,26,0.1)'

/**
 * When the reader reads: chapters by local weekday, a smaller part-of-day strip, and one
 * plain-language sentence so the charts never need interpreting.
 *
 * Card chrome and the section label come from `.rhythm-card` / `.rhythm-label` below,
 * the same look every other card section uses.
 */
export default function ReadingRhythm() {
  // Opens on the recent window: a rhythm the reader still has is more use than one averaged
  // over years they may have outgrown. All time is one click away, and costs no request.
  const [windowKey, setWindowKey] = useState<RhythmWindowKey>('last_90_days')
  const { data, isPending, isError } = useRhythmQuery()

  const strongBar = 'rgba(35,31,26,0.55)'
  const weakBar = 'rgba(35,31,26,0.22)'
  const partBar = 'rgba(210,166,63,0.72)'

  // The whole account is empty, not just the selected window — an invitation, not bars.
  const noDataAtAll = !!data && data.all_time.total_chapters === 0
  const active: RhythmWindow | null = data ? data[windowKey] : null

  const heading = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[10px] font-semibold uppercase mb-1" style={{ letterSpacing: '0.3em', color: dimText }}>Reading Rhythm</h2>
        <p className="italic" style={{ color: dimText, fontSize: 15 }}>when you read</p>
      </div>

      {/* Hidden while there is nothing to compare between the two windows. */}
      {data && !noDataAtAll && (
        <div
          className="flex shrink-0 rounded-lg p-0.5"
          style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(35,31,26,0.1)' }}
        >
          {WINDOW_OPTIONS.map(({ key, label }) => {
            const selected = key === windowKey
            return (
              <button
                key={key}
                onClick={() => setWindowKey(key)}
                aria-pressed={selected}
                className="text-xs px-2.5 py-1 rounded-md transition-all whitespace-nowrap"
                style={{
                  background: selected ? 'rgba(35,31,26,0.1)' : 'transparent',
                  color: selected ? primaryText : dimText,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(35,31,26,0.12)' }}>
      {heading}

      <div className="mt-3">
        {isPending && <p className="text-sm" style={{ color: dimText }}>Loading…</p>}

        {!isPending && isError && (
          <p className="text-sm" style={{ color: 'rgba(240,100,100,0.7)' }}>
            Could not load your reading rhythm.
          </p>
        )}

        {noDataAtAll && (
          <p className="text-sm" style={{ color: dimText }}>
            Start logging chapters to see when you read.
          </p>
        )}

        {/* All-time has data but this window doesn't — truthful, and clearer than seven zeros. */}
        {active && !noDataAtAll && active.total_chapters === 0 && (
          <p className="text-sm" style={{ color: dimText }}>
            Nothing logged in the last 90 days.
          </p>
        )}

        {active && active.total_chapters > 0 && (() => {
          const maxWeekday = Math.max(...active.by_weekday)
          const sentence = insightSentence(active)
          // The accent traces whatever the sentence claims — one day, the five weekdays, the
          // two weekend days, or all seven when it claims none. The bars must not assert a
          // pattern the prose won't.
          const emphasized = emphasizedWeekdays(active)

          return (
            <>
              <div className="flex flex-col gap-2">
                {active.by_weekday.map((count, i) => (
                  <div key={WEEKDAY_LABELS[i]} className="flex items-center gap-3">
                    <span className="w-9 shrink-0 text-sm" style={{ color: bodyText }}>
                      {WEEKDAY_LABELS[i]}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden min-w-0" style={{ background: trackBg }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / maxWeekday) * 100}%`,
                          background: emphasized.has(i) ? strongBar : weakBar,
                        }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-xs text-right" style={{ color: dimText }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="flex flex-col gap-1.5 mt-4 pt-4"
                style={{ borderTop: '1px solid rgba(35,31,26,0.08)' }}
              >
                {PART_ORDER.map(part => {
                  const count = active.by_part_of_day[part]
                  const pct = Math.round((count / active.total_chapters) * 100)
                  return (
                    <div key={part} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs" style={{ color: dimText }}>
                        {PART_LABELS[part]}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-0" style={{ background: trackBg }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: partBar }} />
                      </div>
                      <span className="w-9 shrink-0 text-xs text-right" style={{ color: dimText }}>
                        {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>

              {sentence && (
                <p className="italic mt-4" style={{ color: bodyText, fontSize: 15 }}>
                  {sentence}
                </p>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
