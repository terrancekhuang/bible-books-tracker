import { BookCard } from 'bible-books-tracker'

const genesis = { book_id: 1, book_name: 'Genesis', testament: 'OT', category: 'Pentateuch', num_chapters: 50, chapters_read: 18, chapters_read_list: Array.from({ length: 18 }, (_, i) => i + 1) }
const psalms = { book_id: 19, book_name: 'Psalms', testament: 'OT', category: 'Poetry', num_chapters: 150, chapters_read: 73, chapters_read_list: Array.from({ length: 73 }, (_, i) => i + 1) }
const john = { book_id: 43, book_name: 'John', testament: 'NT', category: 'Gospels', num_chapters: 21, chapters_read: 21, chapters_read_list: Array.from({ length: 21 }, (_, i) => i + 1) }
const rev = { book_id: 66, book_name: 'Revelation', testament: 'NT', category: 'Prophecy', num_chapters: 22, chapters_read: 0, chapters_read_list: [] }

const grid = (children: React.ReactNode) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, padding: 24, background: '#0d1533', borderRadius: 10, maxWidth: 520 }}>
    {children}
  </div>
)

export function Unselected() {
  return grid(
    <>
      <BookCard book={genesis} isSelected={false} onClick={() => {}} />
      <BookCard book={psalms} isSelected={false} onClick={() => {}} />
      <BookCard book={john} isSelected={false} onClick={() => {}} />
      <BookCard book={rev} isSelected={false} onClick={() => {}} />
    </>,
  )
}

export function Selected() {
  return grid(
    <>
      <BookCard book={genesis} isSelected={false} onClick={() => {}} />
      <BookCard book={psalms} isSelected={true} onClick={() => {}} />
      <BookCard book={john} isSelected={false} onClick={() => {}} />
      <BookCard book={rev} isSelected={false} onClick={() => {}} />
    </>,
  )
}
