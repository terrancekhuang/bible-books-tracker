import type { RefObject } from 'react'
import type { Book } from '../lib/trackerLogic'
import SegmentedProgressBar from './SegmentedProgressBar'

/** Amber used for "already read" hints — the offline banner's warning tone, at hint-text weight. */
const ALREADY_READ_COLOR = 'rgba(240,200,80,0.8)'
const dimText = 'rgba(35,31,26,0.55)'

interface ConfirmState {
  confirming: boolean
  request: () => void
  cancel: () => void
}

interface TrackerEntryLineProps {
  book: Book | null
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
  onUndo: () => void
  resetConfirm: ConfirmState
  onReset: () => void
  markAllConfirm: ConfirmState
  onMarkAllRead: () => void
}

export default function TrackerEntryLine({
  book, cloth, chaptersInput, onChaptersInputChange, inputRef, inputIsInvalid, invalidMessage,
  nothingNewToLog, alreadyReadMessage, newChapters, canSubmit, onSubmit, loggingChapters,
  isOnline, onUndo, resetConfirm, onReset, markAllConfirm, onMarkAllRead,
}: TrackerEntryLineProps) {
  const isComplete = book ? book.chapters_read >= book.num_chapters : false

  return (
    <div
      id="tour-tracker-entry"
      style={{
        maxWidth: 720, margin: '30px auto 0', paddingTop: 20,
        borderTop: '1px solid rgba(35,31,26,0.2)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '14px 18px' }}>
        <span className="slab" style={{ fontSize: 20, color: 'var(--color-ink)' }}>
          {book ? book.name : 'Choose an entry'}
        </span>

        {book && !isComplete && (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
              <span className="vol-num" style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.62)' }}>
                Chapters
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={chaptersInput}
                onChange={e => onChaptersInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit() } }}
                placeholder="1-4, 9"
                className="vol-num"
                style={{
                  width: 132, padding: '4px 2px', fontSize: 16,
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
                padding: '9px 22px', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
                fontWeight: 600,
                background: canSubmit ? cloth : 'transparent',
                color: canSubmit ? 'var(--color-leaf)' : 'rgba(35,31,26,0.42)',
                boxShadow: canSubmit ? '0 2px 0 rgba(0,0,0,0.35)' : 'inset 0 0 0 1px rgba(35,31,26,0.28)',
                borderRadius: '0.375rem',
              }}
            >
              Enter
            </button>
            <span
              className="vol-num"
              style={{ fontSize: 12, color: inputIsInvalid ? 'var(--color-leaf-red)' : nothingNewToLog ? ALREADY_READ_COLOR : 'rgba(35,31,26,0.62)' }}
            >
              {inputIsInvalid
                ? invalidMessage
                : nothingNewToLog
                  ? alreadyReadMessage
                  : newChapters.length > 0
                    ? `${newChapters.length} to enter`
                    : 'ranges and lists both read'}
            </span>
          </>
        )}

        {book && isComplete && (
          <p className="text-sm font-semibold" style={{ color: cloth }}>
            All {book.num_chapters} chapters read ✓
          </p>
        )}
      </div>

      {book && !isComplete && (
        <SegmentedProgressBar
          total={book.num_chapters}
          readChapters={book.chapters_read_list}
          pendingChapters={newChapters}
          loggingChapters={loggingChapters}
        />
      )}

      {book && (
        <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
          {book.chapters_read > 0 && (
            <button
              onClick={onUndo}
              disabled={!isOnline}
              className="text-xs px-3 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
            >
              Undo
            </button>
          )}
          <button
            onClick={() => { if (resetConfirm.confirming) onReset(); else resetConfirm.request() }}
            className="text-xs px-3 py-1.5 rounded-md"
            style={resetConfirm.confirming
              ? { border: '1px solid var(--color-leaf-red)', color: 'var(--color-leaf-red)' }
              : { border: '1px solid rgba(35,31,26,0.22)', color: dimText }
            }
          >
            {resetConfirm.confirming ? 'Confirm reset?' : 'Reset'}
          </button>
          {!isComplete && (
            markAllConfirm.confirming ? (
              <>
                <button
                  onClick={onMarkAllRead}
                  className="text-xs px-3 py-1.5 rounded-md font-semibold"
                  style={{ background: cloth, color: 'var(--color-leaf)' }}
                >
                  Confirm — all {book.num_chapters} chapters
                </button>
                <button
                  onClick={markAllConfirm.cancel}
                  className="text-xs px-3 py-1.5 rounded-md"
                  style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={markAllConfirm.request}
                className="text-xs px-3 py-1.5 rounded-md"
                style={{ border: '1px solid rgba(35,31,26,0.22)', color: dimText }}
              >
                Mark all as read
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
