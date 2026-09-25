import type { ReactNode, RefObject } from 'react'
import { chapterExamples, formatChapterRanges, type Book } from '../lib/trackerLogic'
import SegmentedProgressBar from './SegmentedProgressBar'
import { useTooltip } from '../lib/useTooltip'
import ShortcutHint from './ShortcutHint'

const dimText = 'rgba(35,31,26,0.55)'

// The iPhone numeric keypad is digits only, with no comma or hyphen for "1-3, 5".
// Android's numeric keypad has both, so only iPhones fall back to the text keyboard.
const isIPhone = /iPhone|iPod/.test(navigator.userAgent)

export type BookAction = 'undo' | 'reset' | 'markall'

interface TrackerEntryLineProps {
  book: Book
  cloth: string
  chaptersInput: string
  onChaptersInputChange: (v: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  inputIsInvalid: boolean
  invalidMessage: string
  nothingNewToLog: boolean
  alreadyReadMessage: string
  newChapters: number[]
  canSubmit: boolean
  onSubmit: () => void
  loggingChapters?: number[]
  isOnline: boolean
  /** The action waiting on its second press, shown as the confirm strip in place of the buttons. */
  armed: BookAction | null
  /** First press arms an action, a second press of the same one commits it. */
  onAction: (action: BookAction) => void
  onCancel: () => void
}

export default function TrackerEntryLine({
  book, cloth, chaptersInput, onChaptersInputChange, inputRef, inputIsInvalid, invalidMessage,
  nothingNewToLog, alreadyReadMessage, newChapters, canSubmit, onSubmit, loggingChapters,
  isOnline, armed, onAction, onCancel,
}: TrackerEntryLineProps) {
  const isComplete = book.chapters_read >= book.num_chapters
  const read = book.chapters_read
  const remaining = book.num_chapters - read
  const placeholder = `eg: ${chapterExamples(book.num_chapters).join(' or ')}`
  const chapters = (n: number) => `${n} chapter${n === 1 ? '' : 's'}`
  const CONFIRM: Record<BookAction, { question: ReactNode; label: string; hotkey: string; tint: string }> = {
    undo: {
      question: book.last_entry?.length
        ? <>Undo logging <strong>{book.name} {formatChapterRanges(book.last_entry)}</strong>?</>
        : <>Undo the last entry logged for {book.name}?</>,
      label: 'Undo', hotkey: 'U', tint: 'var(--color-leaf-red)',
    },
    reset: {
      question: <>Clear <strong>all {chapters(read)}</strong> read in {book.name}?</>,
      label: 'Reset', hotkey: 'R', tint: 'var(--color-leaf-red)',
    },
    markall: {
      question: <>Mark <strong>{chapters(remaining)}</strong> of {book.name} as read?</>,
      label: 'Mark all read', hotkey: 'A', tint: cloth,
    },
  }
  const kbd = (k: string) => (
    <kbd className="ml-1.5 rounded px-1 text-[10px]" style={{ border: '1px solid currentColor', opacity: 0.65, fontFamily: 'inherit' }}>{k}</kbd>
  )

  const inputStatus = inputIsInvalid
    ? invalidMessage
    : nothingNewToLog
      ? alreadyReadMessage
      : newChapters.length > 0
        ? `${newChapters.length} to enter`
        : null

  return (
    <div
      id="tour-tracker-entry"
      data-keep-selection
      style={{ padding: '14px 10px 16px', background: 'rgba(35,31,26,0.065)' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 14px' }}>
        {!isComplete && (
          <>
            {/* The field takes whatever the row leaves, so Enter always sits at the right edge. */}
            <label style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
              <span className="vol-num" style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.62)' }}>
                Chapters
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode={isIPhone ? 'text' : 'numeric'}
                value={chaptersInput}
                onChange={e => onChaptersInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit() } }}
                placeholder={placeholder}
                className="vol-num"
                style={{
                  flex: 1, width: 0, padding: '4px 2px', fontSize: 16,
                  background: 'transparent', color: 'var(--color-ink)',
                  border: 0, borderBottom: `2px solid ${inputIsInvalid ? 'var(--color-leaf-red)' : cloth}`,
                  borderRadius: 0, outline: 'none',
                }}
              />
            </label>
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="vol-num"
              style={{
                padding: '9px 16px', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
                fontWeight: 600,
                background: canSubmit ? cloth : 'transparent',
                color: canSubmit ? 'var(--color-leaf)' : 'rgba(35,31,26,0.42)',
                boxShadow: canSubmit ? '0 2px 0 rgba(0,0,0,0.35)' : 'inset 0 0 0 1px rgba(35,31,26,0.28)',
                borderRadius: '0.375rem',
              }}
            >
              Enter
            </button>
            {inputStatus && (
              <span
                className="vol-num"
                style={{ flexBasis: '100%', fontSize: 12, color: inputIsInvalid || nothingNewToLog ? 'var(--color-leaf-red)' : 'rgba(35,31,26,0.62)' }}
              >
                {inputStatus}
              </span>
            )}
          </>
        )}

        {isComplete && (
          <p className="text-sm font-semibold" style={{ color: cloth }}>
            All {book.num_chapters} chapters read ✓
          </p>
        )}
      </div>

      {!isComplete && (
        <SegmentedProgressBar
          total={book.num_chapters}
          readChapters={book.chapters_read_list}
          pendingChapters={newChapters}
          loggingChapters={loggingChapters}
        />
      )}

      {armed ? (
        <div
          role="alertdialog"
          aria-label={CONFIRM[armed].label}
          className="flex flex-wrap items-center justify-between rounded-md"
          style={{
            marginTop: 18, gap: '8px 16px', padding: '6px 6px 6px 12px',
            background: `color-mix(in srgb, ${CONFIRM[armed].tint} 8%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${CONFIRM[armed].tint} 30%, transparent)`,
          }}
        >
          <p className="text-[13px]" style={{ margin: 0, lineHeight: 1.4 }}>{CONFIRM[armed].question}</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => onAction(armed)}
              className="text-xs px-3 py-1.5 rounded-md font-semibold"
              style={{ background: CONFIRM[armed].tint, color: 'var(--color-leaf)' }}
            >
              {CONFIRM[armed].label}{kbd(CONFIRM[armed].hotkey)}
            </button>
            <button
              autoFocus
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-md"
              style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
            >
              Cancel{kbd('Esc')}
            </button>
          </div>
        </div>
      ) : (
        <ActionButtons book={book} isOnline={isOnline} onAction={onAction} />
      )}
    </div>
  )
}

/** Undo, Reset and Mark all. Its own component so the tooltips' state goes with it: arming an
 *  action swaps this row out from under the cursor, before any mouseleave can close them. */
function ActionButtons({ book, isOnline, onAction }: { book: Book; isOnline: boolean; onAction: (action: BookAction) => void }) {
  const undoTooltip = useTooltip(<ShortcutHint action="Undo" keys={['U']} />)
  const resetTooltip = useTooltip(<ShortcutHint action="Reset" keys={['R']} />)
  const markAllTooltip = useTooltip(<ShortcutHint action="Mark all as read" keys={['A']} />)

  return (
    <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
      {book.chapters_read > 0 && (
        <>
          <button
            onClick={() => onAction('undo')}
            onMouseEnter={undoTooltip.onMouseEnter}
            onMouseLeave={undoTooltip.onMouseLeave}
            disabled={!isOnline}
            className="text-xs px-3 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
          >
            Undo
          </button>
          <button
            onClick={() => onAction('reset')}
            onMouseEnter={resetTooltip.onMouseEnter}
            onMouseLeave={resetTooltip.onMouseLeave}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
          >
            Reset
          </button>
        </>
      )}
      {book.chapters_read < book.num_chapters && (
        <button
          onClick={() => onAction('markall')}
          onMouseEnter={markAllTooltip.onMouseEnter}
          onMouseLeave={markAllTooltip.onMouseLeave}
          className="text-xs px-3 py-1.5 rounded-md"
          style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
        >
          Mark all as read
        </button>
      )}
      {undoTooltip.tooltip}
      {resetTooltip.tooltip}
      {markAllTooltip.tooltip}
    </div>
  )
}
