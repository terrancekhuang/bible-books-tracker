import { useTheme } from '../lib/ThemeContext'
import { CategoryIcon } from './Icons'
import { getCategoryPalette } from '../lib/categoryColors'
import ArcProgress from './ArcProgress'

export interface BookCardData {
  name: string
  testament: string
  category: string
  num_chapters: number
  chapters_read: number
  chapters_read_list: number[]
}

interface BookCardProps {
  book: BookCardData
  isSelected?: boolean
  onClick: () => void
  // "grid" (default): compact, for narrow multi-column grids
  // "row": full-width, for single-column lists like Dashboard continue reading
  variant?: 'grid' | 'row'
}

export default function BookCard({ book, isSelected = false, onClick, variant = 'grid' }: BookCardProps) {
  const { isDark, colors } = useTheme()
  const { primaryText, dimText } = colors
  const cat = getCategoryPalette(book.category)

  const isComplete = book.chapters_read >= book.num_chapters
  const inProgress = book.chapters_read > 0 && !isComplete
  const pct = Math.round((book.chapters_read / book.num_chapters) * 100)

  const cardBg = isDark
    ? `radial-gradient(ellipse at 90% 5%, ${cat.glow} 0%, transparent 62%), rgba(8,13,34,0.72)`
    : `radial-gradient(ellipse at 90% 5%, ${cat.glow} 0%, transparent 62%), rgba(245,248,255,0.82)`

  const cardBorder = isSelected
    ? `2px solid ${cat.color.replace(',1)', ',0.8)')}`
    : isComplete
      ? `1px solid ${cat.color.replace(',1)', ',0.35)')}`
      : inProgress
        ? `1px solid ${cat.color.replace(',1)', ',0.22)')}`
        : isDark
          ? '1px solid rgba(150,175,255,0.12)'
          : '1px solid rgba(100,130,255,0.15)'

  const cardShadow = isSelected
    ? `0 0 0 1px ${cat.color.replace(',1)', ',0.18)')}, 0 8px 32px ${cat.glow}`
    : isComplete
      ? `0 4px 20px ${cat.color.replace(',1)', ',0.12)')}`
      : 'none'

  const arcColor = isComplete || inProgress
    ? cat.color
    : isDark ? 'rgba(150,175,255,0.4)' : 'rgba(100,130,255,0.4)'

  return (
    <div
      data-book={book.name}
      onClick={onClick}
      className="relative rounded-xl cursor-pointer flex items-center transition-all duration-150"
      style={{
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        padding: variant === 'row' ? '0.75rem 1rem' : '0.9rem 0.85rem',
        gap: variant === 'row' ? '1rem' : '0.5rem',
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
    >
      {/* Text section */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: variant === 'row' ? '0.2rem' : '0.125rem' }}>
        <div className="flex items-start gap-1" style={{ color: cat.dim }}>
          <span style={{ flexShrink: 0, marginTop: variant === 'row' ? 2 : 1 }}>
            <CategoryIcon category={book.category} size={variant === 'row' ? 11 : 9} />
          </span>
          <p style={{
            fontFamily: "'Raleway', sans-serif",
            fontSize: variant === 'row' ? 10 : 8,
            opacity: 0.9,
            lineHeight: 1.3,
          }}>
            {book.category}
          </p>
        </div>
        <p
          className="font-semibold leading-snug"
          style={{
            fontFamily: "'Cinzel', serif",
            color: primaryText,
            fontSize: variant === 'row' ? 15 : 11,
            letterSpacing: variant === 'row' ? '0.02em' : 0,
          }}
        >
          {book.name}
        </p>
        {variant === 'row' && (
          <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: 11, color: dimText, marginTop: 2 }}>
            {book.chapters_read} of {book.num_chapters} chapters · {pct}%
          </p>
        )}
      </div>

      {/* Arc ring */}
      <div style={{ color: arcColor, flexShrink: 0 }}>
        <ArcProgress
          total={book.num_chapters}
          read={book.chapters_read}
          size={variant === 'row' ? 48 : 40}
          strokeWidth={variant === 'row' ? 3.5 : 3}
          isDark={isDark}
        />
      </div>
    </div>
  )
}
