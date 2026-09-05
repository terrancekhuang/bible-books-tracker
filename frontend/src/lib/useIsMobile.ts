import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/** Tracks the same mobile/desktop breakpoint as Tailwind's `md:` classes, including live changes. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
