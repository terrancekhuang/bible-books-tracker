const TOUR_SEEN_KEY = 'bible-tracker-tour-seen'

/** Whether the first-login "want a tour?" prompt has been shown and resolved yet
 *  (Start or Maybe-later both count) — mirrors `pwa_install_seen`'s asked-once semantics. */
export function shouldShowTourPrompt(): boolean {
  return localStorage.getItem(TOUR_SEEN_KEY) !== 'true'
}

export function markTourSeen(): void {
  localStorage.setItem(TOUR_SEEN_KEY, 'true')
}
