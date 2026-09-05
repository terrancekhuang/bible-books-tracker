import { useLayoutEffect, useRef, useState } from 'react'
import type { TourController } from '../lib/useTour'
import { useTourTarget } from '../lib/useTourTarget'

const GAP = 14
const VIEWPORT_MARGIN = 16
const SPOTLIGHT_PADDING = 6

interface CardSize {
  width: number
  height: number
}

function computeCardPosition(rect: DOMRect, placement: string, size: CardSize) {
  let top: number
  let left: number

  switch (placement) {
    case 'top':
      top = rect.top - GAP - size.height
      left = rect.left + rect.width / 2 - size.width / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - size.height / 2
      left = rect.left - GAP - size.width
      break
    case 'right':
      top = rect.top + rect.height / 2 - size.height / 2
      left = rect.right + GAP
      break
    case 'bottom':
    default:
      top = rect.bottom + GAP
      left = rect.left + rect.width / 2 - size.width / 2
      break
  }

  top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - size.height - VIEWPORT_MARGIN)
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - size.width - VIEWPORT_MARGIN)
  return { top, left }
}

interface TourOverlayProps {
  tour: TourController
}

export default function TourOverlay({ tour }: TourOverlayProps) {
  const { currentStep, stepIndex, totalSteps, next, prev, finish } = tour
  const rect = useTourTarget(currentStep?.targetSelector ?? null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<CardSize | null>(null)

  useLayoutEffect(() => {
    if (!cardRef.current) return
    const { width, height } = cardRef.current.getBoundingClientRect()
    setSize({ width, height })
  }, [currentStep, rect])

  if (!currentStep) return null

  const position = rect && size ? computeCardPosition(rect, currentStep.placement, size) : null
  const isVisible = rect !== null && position !== null

  return (
    <>
      <div
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}
      >
        {rect && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
              // Position via transform, not top/left, so moving between targets animates on
              // the compositor instead of forcing a layout recalc on every frame — this
              // matters here since scroll/resize also update this box continuously while
              // useTourTarget settles a step's target into view.
              transform: `translate3d(${rect.left - SPOTLIGHT_PADDING}px, ${rect.top - SPOTLIGHT_PADDING}px, 0)`,
              borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
              outline: '2px solid var(--color-gilt)',
              outlineOffset: 2,
              animation: 'tour-pulse 1.8s ease-in-out infinite',
              transition: 'transform 0.2s ease',
            }}
          />
        )}
        {!rect && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)' }} />}
      </div>

      <div
        ref={cardRef}
        role="dialog"
        aria-label={currentStep.title}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl shadow-2xl p-5"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          // Position via transform (see the spotlight box above for why) rather than top/left.
          transform: `translate3d(${position?.left ?? -9999}px, ${position?.top ?? -9999}px, 0)`,
          visibility: isVisible ? 'visible' : 'hidden',
          zIndex: 1001,
          width: 'min(320px, calc(100vw - 32px))',
          background: 'var(--color-shelf)',
          border: '1px solid var(--color-shelf-lit)',
          transition: 'transform 0.2s ease',
        }}
      >
        <p className="vol-num" style={{ margin: 0, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,236,221,0.45)' }}>
          {stepIndex + 1} / {totalSteps}
        </p>
        <h2 className="slab text-base font-semibold mt-2" style={{ color: 'var(--color-gilt)' }}>
          {currentStep.title}
        </h2>
        <p className="text-sm mt-2" style={{ color: 'rgba(242,236,221,0.7)', lineHeight: 1.5 }}>
          {currentStep.body}
        </p>
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={finish}
            className="text-xs font-medium"
            style={{ color: 'rgba(242,236,221,0.45)' }}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={prev}
                className="text-xs font-semibold uppercase px-3 py-1.5 rounded-lg transition-colors"
                style={{ letterSpacing: '0.06em', color: 'rgba(242,236,221,0.75)', border: '1px solid rgba(242,236,221,0.2)' }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="text-xs font-semibold uppercase px-3 py-1.5 rounded-lg transition-colors"
              style={{ letterSpacing: '0.06em', background: 'var(--color-gilt)', color: 'var(--color-shelf)' }}
            >
              {stepIndex + 1 >= totalSteps ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 0 rgba(210,166,63,0.35); }
          50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.65), 0 0 18px 4px rgba(210,166,63,0.35); }
        }
      `}</style>
    </>
  )
}
