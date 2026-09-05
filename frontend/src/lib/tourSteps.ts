export interface TourStep {
  id: string
  route: '/' | '/tracker' | '/profile'
  targetSelector: string
  title: string
  body: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  /** Skipped on mobile — for content that only applies with a keyboard. */
  desktopOnly?: boolean
  /** react-router location.state to navigate with, for steps that need the page in a
   *  particular state (e.g. a book already selected) before their target exists. */
  navigateState?: Record<string, unknown>
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'dash-header',
    route: '/',
    targetSelector: '#tour-dash-header',
    placement: 'bottom',
    title: 'Welcome to your Dashboard',
    body: "This is your daily record — today's stats, your streak, and where you left off.",
  },
  {
    id: 'dash-weekly-goal',
    route: '/',
    targetSelector: '#tour-dash-weekly-goal',
    placement: 'bottom',
    title: 'Set a weekly goal',
    body: 'Tap the pencil to set how many chapters you want to read each week.',
  },
  {
    id: 'dash-continue',
    route: '/',
    targetSelector: '#tour-dash-continue',
    placement: 'top',
    title: 'Continue reading',
    body: 'Your most recent unfinished books live here — tap one to jump straight into the Tracker.',
  },
  {
    id: 'tracker-shelf',
    route: '/tracker',
    targetSelector: 'section[aria-label="The set of volumes"]',
    placement: 'bottom',
    navigateState: { selectBook: 'Genesis' },
    title: 'The shelf of volumes',
    body: 'Each spine is a category of Scripture. Click one to open it, like pulling a volume off the shelf.',
  },
  {
    id: 'tracker-book-row',
    route: '/tracker',
    targetSelector: '[data-book="Genesis"]',
    placement: 'right',
    navigateState: { selectBook: 'Genesis' },
    title: 'Pick a book',
    body: 'Every book in the open volume lists here with its progress. Click one to select it.',
  },
  {
    id: 'tracker-entry',
    route: '/tracker',
    targetSelector: '#tour-tracker-entry',
    placement: 'top',
    navigateState: { selectBook: 'Genesis' },
    title: 'Log your reading',
    body: 'Type a chapter or range — like "1-4, 9" — and press Enter to mark it read.',
  },
  {
    id: 'tracker-shortcuts',
    route: '/tracker',
    targetSelector: '#tour-tracker-shelf-area',
    placement: 'bottom',
    desktopOnly: true,
    navigateState: { selectBook: 'Genesis' },
    title: 'Faster with the keyboard',
    body: 'On desktop: / to search, h/l to change volume, j/k to move between books, Tab/i for the chapter field. Press ? anytime for the full list.',
  },
  {
    id: 'profile-new-cycle',
    route: '/profile',
    targetSelector: '#tour-profile-new-cycle',
    placement: 'top',
    title: 'Starting over',
    body: "Finished the whole Bible? Start a new cycle — your finished one stays in your history below.",
  },
]
