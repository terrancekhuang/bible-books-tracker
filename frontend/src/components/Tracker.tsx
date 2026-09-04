import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useBooksQuery, useCurrentUserQuery } from '../lib/queries'
import { useTrackerMutations } from '../lib/useTrackerMutations'
import { useConfirm } from '../lib/useConfirm'
import {
  parseChapters, splitAlreadyRead, formatChapterList, filterBooks, invalidChaptersMessage,
  defaultBookForCategory,
} from '../lib/trackerLogic'
import { CATEGORY_ORDER, CLOTH, ROMAN } from '../lib/volumesTokens'
import NavBar from './NavBar'
import VolumeShelf from './VolumeShelf'
import ContentsLeaf from './ContentsLeaf'
import TrackerEntryLine from './TrackerEntryLine'
import { FILL_MS } from './SegmentedProgressBar'

const SHELF_BACKGROUND = [
  'repeating-linear-gradient(91deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 9px)',
  'linear-gradient(180deg, #1D1813 0%, var(--color-shelf) 44%, #17120E 100%)',
].join(', ')

export default function Tracker() {
  const { data: user } = useCurrentUserQuery();
  const { data: books = [] } = useBooksQuery();

  const { pendingCount, isOnline, submit, undo, reset } = useTrackerMutations()

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [selectedBookName, setSelectedBookName] = useState<string | null>(null)
  const selectedBook = books.find(b => b.name === selectedBookName) ?? null

  const [chaptersInput, setChaptersInput] = useState('');
  const resetConfirm = useConfirm(selectedBookName);
  const confirmMarkAll = useConfirm(selectedBookName);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // Set only by Dashboard's testament-breakdown deep link — there's no dropdown for it,
  // since a testament cuts across multiple volumes and has no single volume to open.
  const [testamentFilter, setTestamentFilter] = useState('');
  const [openedFromNav, setOpenedFromNav] = useState(false);

  const chaptersInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Search or status (or a testament deep-link) flattens the shelf: instead of one
  // volume's leaf, every matching book across all nine categories lists on one leaf.
  const flattened = search.trim() !== '' || filterStatus !== '' || testamentFilter !== '';

  const flatBooks = useMemo(
    () => filterBooks(books, { search, filterTestament: testamentFilter, filterStatus }),
    [books, search, testamentFilter, filterStatus]
  );
  const openVolumeBooks = useMemo(
    () => openCategory ? books.filter(b => b.category === openCategory) : [],
    [books, openCategory]
  );
  const visibleBooks = flattened ? flatBooks : openVolumeBooks;

  // Typing into search/status (or a testament deep-link) can flatten the leaf out from
  // under whatever was selected — drop a selection the moment it's no longer visible,
  // rather than leaving the entry line pointed at a book that isn't on the leaf anymore.
  useEffect(() => {
    if (selectedBookName && !visibleBooks.some(b => b.name === selectedBookName)) {
      setSelectedBookName(null);
      setChaptersInput('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleBooks]);

  const openVolume = (category: string) => {
    setSearch(''); setFilterStatus(''); setTestamentFilter('');
    setOpenCategory(category);
    setSelectedBookName(defaultBookForCategory(books, category)?.name ?? null);
    setChaptersInput('');
    setOpenedFromNav(false);
  };

  useEffect(() => {
    const state = location.state as { selectBook?: string; filterTestament?: string; filterCategory?: string } | null;
    if (!state) return;

    if (state.filterCategory) {
      window.history.replaceState({}, '');
      openVolume(state.filterCategory);
      return;
    }
    if (state.filterTestament) {
      window.history.replaceState({}, '');
      setOpenCategory(null);
      setSearch(''); setFilterStatus('');
      setTestamentFilter(state.filterTestament);
      return;
    }

    if (!state.selectBook || books.length === 0) return;
    const book = books.find(b => b.name === state.selectBook);
    if (!book) return;
    window.history.replaceState({}, '');
    const t = setTimeout(() => {
      setOpenCategory(book.category);
      setSelectedBookName(book.name);
      setOpenedFromNav(true);
    }, 0)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, location.state]);

  // Chapters whose write just landed, kept only for the length of the bar's fill animation
  // and scoped to the book they belong to, so switching book can't replay it elsewhere.
  const [justLogged, setJustLogged] = useState<{ book: string; chapters: number[] } | null>(null);
  const fillTimer = useRef<number | null>(null);
  useEffect(() => () => { if (fillTimer.current) window.clearTimeout(fillTimer.current); }, []);
  const loggingChapters = justLogged?.book === selectedBookName ? justLogged.chapters : undefined;

  const parsedChapters = selectedBook ? parseChapters(chaptersInput, selectedBook.num_chapters) : [];
  const inputIsInvalid = chaptersInput.trim() !== '' && parsedChapters.length === 0;
  // Chapters already logged are a server-side no-op, so only the new ones are submitted —
  // and when nothing is new, Submit is disabled rather than firing a write that does nothing.
  const { newChapters, alreadyRead } = splitAlreadyRead(parsedChapters, selectedBook?.chapters_read_list ?? []);
  const nothingNewToLog = parsedChapters.length > 0 && newChapters.length === 0;
  const canSubmit = newChapters.length > 0;

  const handleSubmit = async () => {
    if (!selectedBook || !canSubmit) return;
    const logged = newChapters;
    setChaptersInput('');
    // Hold the just-logged chapters apart from the solid fill while the bar wipes them in.
    // Submitting again mid-wipe restarts it on the new chapters rather than stacking.
    if (fillTimer.current) window.clearTimeout(fillTimer.current);
    setJustLogged({ book: selectedBook.name, chapters: logged });
    fillTimer.current = window.setTimeout(() => setJustLogged(null), FILL_MS);
    await submit(selectedBook, logged);
  };

  const handleMarkAllRead = async () => {
    if (!selectedBook) return;
    const allChapters = Array.from({ length: selectedBook.num_chapters }, (_, i) => i + 1);
    confirmMarkAll.cancel();
    await submit(selectedBook, allChapters);
  };

  const handleUndo = async () => {
    if (!selectedBook || !isOnline) return;
    await undo(selectedBook);
  };

  const handleReset = async () => {
    if (!selectedBook || !resetConfirm.confirmOrRequest()) return;
    await reset(selectedBook);
  };

  useEffect(() => {
    if (!selectedBook) return;
    document.querySelector(`[data-book="${selectedBook.name}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedBook]);

  const moveVolume = (step: number) => {
    if (flattened) return;
    const currentIndex = openCategory ? CATEGORY_ORDER.indexOf(openCategory as typeof CATEGORY_ORDER[number]) : -1;
    if (currentIndex === -1) {
      openVolume(CATEGORY_ORDER[step > 0 ? 0 : CATEGORY_ORDER.length - 1]);
      return;
    }
    const nextIndex = currentIndex + step;
    if (nextIndex >= 0 && nextIndex < CATEGORY_ORDER.length) openVolume(CATEGORY_ORDER[nextIndex]);
  };

  const moveEntry = (step: number) => {
    const currentIndex = selectedBook ? visibleBooks.findIndex(b => b.name === selectedBook.name) : -1;
    if (currentIndex === -1) {
      if (step > 0 && visibleBooks.length > 0) { setSelectedBookName(visibleBooks[0].name); setChaptersInput(''); }
      return;
    }
    const nextIndex = currentIndex + step;
    if (nextIndex >= 0 && nextIndex < visibleBooks.length) { setSelectedBookName(visibleBooks[nextIndex].name); setChaptersInput(''); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (resetConfirm.confirming) { resetConfirm.cancel(); return; }
        if (confirmMarkAll.confirming) { confirmMarkAll.cancel(); return; }
        if (target === searchInputRef.current) {
          setSearch(''); searchInputRef.current?.blur();
        } else {
          setOpenedFromNav(false); setSelectedBookName(null); setChaptersInput('');
        }
        return;
      }
      if (e.key === '/' && !isInput) { e.preventDefault(); searchInputRef.current?.focus(); return; }
      if (e.key === 'Tab' && !isInput && selectedBook) { e.preventDefault(); chaptersInputRef.current?.focus(); return; }
      if (e.key === 'Enter' && !isInput && selectedBook) { e.preventDefault(); handleSubmit(); return; }
      if (e.key === 'u' && !isInput && selectedBook) { e.preventDefault(); handleUndo(); return; }
      if (e.key === 'R' && !isInput && selectedBook) { e.preventDefault(); handleReset(); return; }
      if (e.key === 'A' && !isInput && selectedBook) {
        e.preventDefault();
        if (confirmMarkAll.confirming) handleMarkAllRead(); else confirmMarkAll.request();
        return;
      }
      if (e.key === 'i' && !isInput && selectedBook) { e.preventDefault(); chaptersInputRef.current?.focus(); return; }

      if (isInput) return;

      const VOLUME_STEP: Record<string, number> = { h: -1, l: 1, ArrowLeft: -1, ArrowRight: 1 };
      const ENTRY_STEP: Record<string, number> = { k: -1, j: 1, ArrowUp: -1, ArrowDown: 1 };

      if (e.key in VOLUME_STEP) { e.preventDefault(); moveVolume(VOLUME_STEP[e.key]); return; }
      if (e.key in ENTRY_STEP) { e.preventDefault(); moveEntry(ENTRY_STEP[e.key]); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBook, visibleBooks, openCategory, flattened, resetConfirm.confirming, confirmMarkAll.confirming, isOnline]);

  const openIndex = openCategory ? CATEGORY_ORDER.indexOf(openCategory as typeof CATEGORY_ORDER[number]) : -1;
  const leafCloth = openCategory ? CLOTH[openCategory] : 'var(--color-shelf-lit)';
  const entryCloth = selectedBook ? CLOTH[selectedBook.category] : 'var(--color-ink)';

  const leafSummary = (() => {
    if (visibleBooks.length === 0) {
      return flattened ? `No books match — try a different search or status` : '';
    }
    const read = visibleBooks.reduce((s, b) => s + b.chapters_read, 0);
    const total = visibleBooks.reduce((s, b) => s + b.num_chapters, 0);
    const pct = total ? Math.round((read / total) * 100) : 0;
    return `${visibleBooks.length} book${visibleBooks.length !== 1 ? 's' : ''} · ${read} of ${total} chapters · ${pct}%`;
  })();

  const leafHeading = flattened
    ? (search.trim() ? `Search: "${search.trim()}"` : testamentFilter || 'Matching books')
    : (openCategory ?? '');

  return (
    <div className="flex flex-col min-h-screen" style={{ background: SHELF_BACKGROUND }}>
      {/* Status banners */}
      {!isOnline && (
        <div
          className="text-xs font-medium text-center py-1.5 px-4"
          style={{ background: 'var(--color-leaf)', color: 'var(--color-leaf-red)', borderBottom: '1px solid rgba(35,31,26,0.15)' }}
        >
          Offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount > 1 ? 's' : ''} will sync when reconnected` : ''}
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div
          className="text-xs font-medium text-center py-1.5 px-4"
          style={{ background: 'var(--color-leaf)', color: 'var(--color-ink)', borderBottom: '1px solid rgba(35,31,26,0.15)' }}
        >
          Syncing {pendingCount} pending change{pendingCount > 1 ? 's' : ''}…
        </div>
      )}

      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      <div className="flex-1 pb-20 md:pb-10 px-4 md:px-6 py-6 mx-auto w-full" style={{ maxWidth: 1100 }}>
        {openedFromNav && (
          <button
            onClick={() => { setOpenedFromNav(false); navigate(-1); }}
            className="vol-num text-sm mb-3"
            style={{ color: 'rgba(242,236,221,0.6)' }}
          >
            ← Back
          </button>
        )}

        {/* Search + status control row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search books… (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && flatBooks.length > 0) {
                e.preventDefault();
                setSelectedBookName(flatBooks[0].name);
                setChaptersInput('');
                searchInputRef.current?.blur();
              }
            }}
            className="vol-num text-sm px-3 py-2 flex-1 min-w-[10rem] rounded-md"
            style={{
              maxWidth: 320,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(242,236,221,0.2)',
              color: 'var(--color-leaf)',
              outline: 'none',
            }}
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="vol-num text-xs px-2 py-2 rounded-md"
            style={{
              background: filterStatus ? 'rgba(210,166,63,0.18)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(242,236,221,0.2)',
              color: filterStatus ? 'var(--color-gilt)' : 'rgba(242,236,221,0.6)',
            }}
          >
            <option value="">Status</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
          {(search || filterStatus || testamentFilter) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setTestamentFilter(''); }}
              className="vol-num text-xs px-2 py-1.5"
              style={{ color: 'var(--color-leaf-red)' }}
            >
              Clear
            </button>
          )}
        </div>

        <VolumeShelf
          books={books}
          openCategory={openCategory}
          flattened={flattened}
          onSelectCategory={openVolume}
        />

        {(openCategory || flattened) && (
          <>
            <ContentsLeaf
              heading={leafHeading}
              romanNumeral={!flattened && openIndex >= 0 ? ROMAN[openIndex + 1] : null}
              topBorder={leafCloth}
              books={visibleBooks}
              selectedBookName={selectedBookName}
              onSelectBook={(name) => { setSelectedBookName(name); setChaptersInput(''); setOpenedFromNav(false); }}
              summary={leafSummary}
            />
            {visibleBooks.length > 0 && (
              <div
                style={{
                  padding: '0 clamp(20px, 3.4vw, 46px) clamp(20px, 3.4vw, 46px)',
                  background: 'var(--color-leaf)',
                  borderRadius: '0 0 0.5rem 0.5rem',
                  marginTop: -1,
                }}
              >
                <TrackerEntryLine
                  book={selectedBook}
                  cloth={entryCloth}
                  chaptersInput={chaptersInput}
                  onChaptersInputChange={setChaptersInput}
                  inputRef={chaptersInputRef}
                  inputIsInvalid={inputIsInvalid}
                  invalidMessage={selectedBook ? invalidChaptersMessage(selectedBook.name, selectedBook.num_chapters) : ''}
                  nothingNewToLog={nothingNewToLog}
                  alreadyReadMessage={`Already read — nothing new to log (${formatChapterList(alreadyRead)})`}
                  newChapters={newChapters}
                  canSubmit={canSubmit}
                  onSubmit={handleSubmit}
                  loggingChapters={loggingChapters}
                  isOnline={isOnline}
                  onUndo={handleUndo}
                  resetConfirm={resetConfirm}
                  onReset={handleReset}
                  markAllConfirm={confirmMarkAll}
                  onMarkAllRead={handleMarkAllRead}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
