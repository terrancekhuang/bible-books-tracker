import { useMemo } from 'react'
import { CATEGORY_ORDER, CLOTH, ROMAN, GILT, PAPER_EDGE } from '../lib/volumesTokens'
import type { Book } from '../lib/trackerLogic'

interface Volume {
  category: string
  books: Book[]
  read: number
  total: number
  pct: number
}

interface SpineProps {
  vol: Volume
  index: number
  selected: boolean
  dimmed: boolean
  onSelect: () => void
}

function Spine({ vol, index, selected, dimmed, onSelect }: SpineProps) {
  const cloth = CLOTH[vol.category]
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      title={`Volume ${ROMAN[index + 1]} — ${vol.category}, ${vol.read} of ${vol.total} chapters`}
      style={{
        position: 'relative', flex: `${vol.total} 1 0`, minWidth: 58, height: 240,
        alignSelf: 'flex-end',
        transform: selected ? 'translateY(-18px)' : 'none',
        transition: 'transform 260ms cubic-bezier(0.16,1,0.3,1), filter 200ms ease',
        filter: dimmed ? 'brightness(0.6)' : selected ? 'none' : 'brightness(0.86)',
      }}
    >
      {/* The head edge: gilt as far as the volume has been read, raw paper after. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 2, right: 2, top: -6, height: 7,
          background: `linear-gradient(90deg, ${GILT} 0 ${vol.pct}%, ${PAPER_EDGE} ${vol.pct}% 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.6)',
          transition: 'background 420ms cubic-bezier(0.16,1,0.3,1)',
        }}
      />
      {/* The cloth. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, rgba(0,0,0,0.55), ${cloth} 20%, ${cloth} 68%, rgba(255,255,255,0.16) 96%, rgba(0,0,0,0.4))`,
          boxShadow: selected
            ? `0 20px 30px -14px rgba(0,0,0,0.9), inset 0 0 0 1px ${GILT}88`
            : '0 14px 22px -14px rgba(0,0,0,0.9)',
        }}
      />
      {/* Raised bands across the spine. */}
      {[0.1, 0.9].map(t => (
        <span
          key={t}
          aria-hidden
          style={{
            position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 9,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(0,0,0,0.45))',
          }}
        />
      ))}
      {/* Blind-stamped rule panel. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 7, right: 7, top: '16%', bottom: '16%',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.42), inset 0 0 0 2px rgba(255,255,255,0.10)',
        }}
      />
      {/* The gilt label. */}
      <span
        className="slab"
        style={{
          position: 'absolute', left: 0, right: 0, top: '22%', bottom: '26%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontSize: 'clamp(10px, 1.05vw, 14px)', letterSpacing: '0.02em',
          color: GILT, textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,236,180,0.28)',
          whiteSpace: 'nowrap', overflow: 'hidden', padding: '4px 0',
        }}
      >
        {vol.category}
      </span>
      <span
        className="vol-num"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: '5.5%',
          textAlign: 'center', fontSize: 11, letterSpacing: '0.1em',
          color: GILT, fontWeight: 600,
        }}
      >
        {ROMAN[index + 1]}
      </span>
    </button>
  )
}

interface VolumeShelfProps {
  books: Book[]
  /** The category currently open on the leaf below, or null when nothing is open
   *  (either the initial landing state, or a flattened cross-category search/filter view). */
  openCategory: string | null
  /** True while a search or filter has flattened the leaf across all categories — every
   *  spine dims, since none of them are individually "open" in that state. */
  flattened: boolean
  onSelectCategory: (category: string) => void
}

export default function VolumeShelf({ books, openCategory, flattened, onSelectCategory }: VolumeShelfProps) {
  const volumes: Volume[] = useMemo(() => CATEGORY_ORDER.map(category => {
    const inCat = books.filter(b => b.category === category)
    const read = inCat.reduce((s, b) => s + b.chapters_read, 0)
    const total = inCat.reduce((s, b) => s + b.num_chapters, 0)
    return { category, books: inCat, read, total, pct: total ? Math.round((read / total) * 100) : 0 }
  }), [books])

  return (
    <section aria-label="The set of volumes">
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1.5 pt-8 px-1" style={{ minWidth: 'min-content' }}>
          {volumes.map((vol, i) => (
            <Spine
              key={vol.category}
              vol={vol}
              index={i}
              selected={!flattened && vol.category === openCategory}
              dimmed={flattened}
              onSelect={() => onSelectCategory(vol.category)}
            />
          ))}
        </div>
      </div>
      {/* The shelf the set stands on. */}
      <div
        aria-hidden
        style={{
          height: 13, borderRadius: '0 0 2px 2px',
          background: 'linear-gradient(180deg, var(--color-shelf-lit), #241C15 70%, #100C09)',
          boxShadow: '0 12px 22px -12px rgba(0,0,0,0.95)',
        }}
      />
    </section>
  )
}
