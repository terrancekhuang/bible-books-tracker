import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_STEPS, type TourStep } from './tourSteps'
import { markTourSeen } from './tour'
import { useIsMobile } from './useIsMobile'

export interface TourController {
  active: boolean
  currentStep: TourStep | null
  stepIndex: number
  totalSteps: number
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
  finish: () => void
}

/** Drives the guided tour: which step is showing, and navigating across routes as it advances. */
export function useTour(): TourController {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  // Distinguishes the tour's own navigate() calls from the user wandering off on their own.
  const isTourNavRef = useRef(false)

  const steps = useMemo(() => TOUR_STEPS.filter(s => !s.desktopOnly || !isMobile), [isMobile])
  const currentStep = active ? steps[stepIndex] ?? null : null

  const goTo = useCallback((index: number) => {
    const step = steps[index]
    if (!step) return
    setStepIndex(index)
    if (location.pathname !== step.route) {
      isTourNavRef.current = true
      navigate(step.route, { state: step.navigateState })
    }
  }, [steps, location.pathname, navigate])

  const finish = useCallback(() => {
    setActive(false)
    markTourSeen()
    // Land back on the Dashboard, scrolled to the top — wherever the tour ended.
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate('/')
    }
  }, [location.pathname, navigate])

  const stop = useCallback(() => setActive(false), [])

  const start = useCallback(() => {
    setStepIndex(0)
    setActive(true)
    goTo(0)
  }, [goTo])

  const next = useCallback(() => {
    if (stepIndex + 1 >= steps.length) {
      finish()
      return
    }
    goTo(stepIndex + 1)
  }, [stepIndex, steps.length, goTo, finish])

  const prev = useCallback(() => {
    if (stepIndex > 0) goTo(stepIndex - 1)
  }, [stepIndex, goTo])

  // If the user navigates away from the tour's current route on their own (a NavBar click,
  // browser back, etc.) rather than via the tour's own navigate() call, end the tour quietly
  // instead of leaving it pointed at a step that's no longer on screen.
  useEffect(() => {
    if (!active || !currentStep) return
    if (isTourNavRef.current) {
      isTourNavRef.current = false
      return
    }
    if (location.pathname !== currentStep.route) {
      // Deferred so the update runs from a microtask callback rather than synchronously
      // inside the effect body.
      queueMicrotask(() => setActive(false))
    }
  }, [location.pathname, active, currentStep])

  return { active, currentStep, stepIndex, totalSteps: steps.length, start, stop, next, prev, finish }
}
