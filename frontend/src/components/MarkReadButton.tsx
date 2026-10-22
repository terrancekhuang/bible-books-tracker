import { CheckCircleIcon } from './Icons'
import { useTooltip } from '../lib/useTooltip'

interface MarkReadButtonProps {
  bookName: string
  chapter: number
  /** True while this book's mark is in flight, so a double tap logs one chapter. */
  disabled: boolean
  onMark: () => void
}

/** The round checkmark that logs a book's next chapter in one tap. */
export default function MarkReadButton({ bookName, chapter, disabled, onMark }: MarkReadButtonProps) {
  const label = `Mark ${bookName} ${chapter} as read`
  const tooltip = useTooltip(label)

  return (
    <>
      <button
        type="button"
        onClick={onMark}
        onMouseEnter={tooltip.onMouseEnter}
        onMouseLeave={tooltip.onMouseLeave}
        disabled={disabled}
        aria-label={label}
        className="flex items-center justify-center rounded-full transition-colors hover:opacity-80 disabled:opacity-40"
        style={{ width: 32, height: 32, flexShrink: 0, color: 'var(--color-ink)', border: '1px solid rgba(35,31,26,0.25)', background: 'transparent' }}
      >
        <CheckCircleIcon size={16} />
      </button>
      {tooltip.tooltip}
    </>
  )
}
