// Shared source of truth for the Volumes design system's JS-side values — the ones
// that have to exist as real values (inline styles, category lookups), not just CSS.
// CSS-side system tokens (shelf/leaf/ink family) live in index.css's `@theme` block instead.

export const CATEGORY_ORDER = [
  'Law',
  'History',
  'Poetry',
  'Major Prophets',
  'Minor Prophets',
  'Gospels',
  'Church History',
  "Paul's Epistles",
  'General Epistles',
] as const

export const CLOTH: Record<string, string> = {
  'Law': '#0E7245',
  'History': '#9E1B2F',
  'Poetry': '#0F6E78',
  'Major Prophets': '#1B4B9E',
  'Minor Prophets': '#6B2A57',
  'Gospels': '#B8840F',
  'Church History': '#B04A24',
  "Paul's Epistles": '#3C5A70',
  'General Epistles': '#5E6B1E',
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

export const GILT = '#D2A63F'
export const PAPER_EDGE = '#EAE5D6'
