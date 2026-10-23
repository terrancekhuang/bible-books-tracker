/** One local day from `/api/history`: its books in logged order, chapters ascending. */
export interface HistoryDay {
  date: string
  chapters: number
  books: { book: string; chapters: number[] }[]
}

export interface HistoryPage {
  days: HistoryDay[]
  /** Pass back as `before` for the next page; null once the first chapter is loaded. */
  next_before: string | null
}

export interface HistoryMonth {
  key: string
  label: string
  chapters: number
  days: HistoryDay[]
}

/** Consecutive runs become ranges, the rest a list: [4, 5] → "4–5", [1, 23] → "1, 23". */
export function formatChapters(chapters: number[]): string {
  const runs: string[] = []
  for (let i = 0; i < chapters.length; i++) {
    const start = chapters[i]
    while (chapters[i + 1] === chapters[i] + 1) i++
    runs.push(start === chapters[i] ? `${start}` : `${start}–${chapters[i]}`)
  }
  return runs.join(', ')
}

/** A `YYYY-MM-DD` as that local calendar day — `new Date(iso)` would read it as UTC midnight. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Newest-first days under their month. Pages are whole months, so no month splits across two. */
export function groupByMonth(days: HistoryDay[]): HistoryMonth[] {
  const months: HistoryMonth[] = []
  for (const day of days) {
    const key = day.date.slice(0, 7)
    let month = months.at(-1)
    if (month?.key !== key) {
      month = {
        key,
        label: parseLocalDate(day.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        chapters: 0,
        days: [],
      }
      months.push(month)
    }
    month.chapters += day.chapters
    month.days.push(day)
  }
  return months
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
