import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useCachedFetch } from '../lib/useCachedFetch'
import { useProgressSync } from '../lib/useProgressSync'
import { useKeyChord } from '../lib/useKeyChord'
import { useConfirm } from '../lib/useConfirm'
import { parseChapters, sortBooks, filterBooks, availableFilterOptions, calculateProgress, calculateOverallProgress, type SortKey, type SortDir, TOTAL_CHAPTERS } from '../lib/trackerLogic'
import { FlameIcon, CalendarIcon, CategoryIcon, BookOpenIcon } from './Icons'
import FilterSelect from './FilterSelect'
import SegmentedProgressBar from './SegmentedProgressBar'
import NavBar from './NavBar'
import BookCard from './BookCard'
import { getCategoryPalette } from '../lib/categoryColors'

interface UserInfo {
  name: string | null
  picture_url: string | null
}

export default function Tracker() {
  const { isDark, colors } = useTheme()
  const { data: user } = useCachedFetch<UserInfo>('user', '/auth/me');

  const { books, stats, pendingCount, isOnline, submit, undo, reset } = useProgressSync()

  const [selectedBookName, setSelectedBookName] = useState<string | null>(null)
  const selectedBook = books.find(b => b.name === selectedBookName) ?? null

  const [chaptersInput, setChaptersInput] = useState('');
  const resetConfirm = useConfirm(selectedBookName);
  const confirmMarkAll = useConfirm(selectedBookName);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState('');
  const [filterTestament, setFilterTestament] = useState('');
  const [filterCategory,  setFilterCategory]  = useState('');
  const [filterStatus,    setFilterStatus]     = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [openedFromNav, setOpenedFromNav] = useState(false);

  const chaptersInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gChord = useKeyChord();
  const navigate = useNavigate();
  const location = useLocation();

  const { primaryText, dimText, bodyText, trackBg } = colors

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const state = location.state as { selectBook?: string } | null;
    if (!state?.selectBook || books.length === 0) return;
    const book = books.find(b => b.name === state.selectBook);
    if (!book) return;
    window.history.replaceState({}, '');
    const t = setTimeout(() => {
      setSelectedBookName(book.name);
      setOpenedFromNav(true);
    }, 0)
    return () => clearTimeout(t)
  }, [books, location.state]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const resetSort = () => { setSortKey(null); setSortDir("asc"); };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const tabFilteredBooks = useMemo(
    () => filterBooks(sortBooks(books, sortKey, sortDir), { search, filterTestament, filterCategory, filterStatus }),
    [books, sortKey, sortDir, search, filterTestament, filterCategory, filterStatus]
  );
  const { testaments: availableTestamentOptions, categories: availableCategoryOptions } = useMemo(
    () => availableFilterOptions(books, { filterTestament, filterCategory }),
    [books, filterTestament, filterCategory]
  );
  const anyFilterActive = filterTestament !== '' || filterCategory !== '' || filterStatus !== '';
  const clearFilters = () => { setFilterTestament(''); setFilterCategory(''); setFilterStatus(''); };

  const { totalRead, overallPct } = useMemo(() => calculateOverallProgress(books), [books])

  const parsedChapters = selectedBook ? parseChapters(chaptersInput, selectedBook.num_chapters) : [];
  const inputIsInvalid = chaptersInput.trim() !== '' && parsedChapters.length === 0;

  const handleSubmit = async () => {
    if (!selectedBook || parsedChapters.length === 0) return;
    setChaptersInput('');
    await submit(selectedBook, parsedChapters);
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
    if (!selectedBook || isMobile) return;
    document.querySelector(`[data-book="${selectedBook.name}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedBook, isMobile]);

  const moveSelection = (step: number) => {
    const currentIndex = selectedBook ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name) : -1;
    if (currentIndex === -1) {
      if (step > 0 && tabFilteredBooks.length > 0) setSelectedBookName(tabFilteredBooks[0].name);
      return;
    }
    const nextIndex = currentIndex + step;
    if (nextIndex >= 0 && nextIndex < tabFilteredBooks.length) setSelectedBookName(tabFilteredBooks[nextIndex].name);
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

      if (e.key === 'g' && !isInput) {
        e.preventDefault();
        if (gChord.consume()) {
          if (tabFilteredBooks.length > 0) { setSelectedBookName(tabFilteredBooks[0].name); setChaptersInput(''); }
        } else {
          gChord.arm();
        }
        return;
      }
      if (e.key === 'G' && !isInput) {
        e.preventDefault();
        if (tabFilteredBooks.length > 0) { setSelectedBookName(tabFilteredBooks[tabFilteredBooks.length - 1].name); setChaptersInput(''); }
        return;
      }

      const VIM_MAP: Record<string, string> = { h: 'ArrowLeft', l: 'ArrowRight', k: 'ArrowUp', j: 'ArrowDown' };
      const resolvedKey = (!isInput && VIM_MAP[e.key]) ? VIM_MAP[e.key] : e.key;

      if ((resolvedKey === 'ArrowRight' || resolvedKey === 'ArrowLeft') && !isInput) {
        e.preventDefault();
        moveSelection(resolvedKey === 'ArrowRight' ? 1 : -1);
        setChaptersInput(''); return;
      }
      if ((resolvedKey === 'ArrowDown' || resolvedKey === 'ArrowUp') && !isInput) {
        e.preventDefault();
        const numCols = window.innerWidth < 640 ? 2 : 3;
        moveSelection(resolvedKey === 'ArrowDown' ? numCols : -numCols);
        setChaptersInput('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBook, tabFilteredBooks, chaptersInput, resetConfirm.confirming, confirmMarkAll.confirming, isOnline]);

  const showGrid = !isMobile || !selectedBook;
  const showDetail = !isMobile || !!selectedBook;

  // Glass panel used only for the book grid
  const gridPanelStyle = {
    background: isDark ? 'rgba(6,10,28,0.62)' : 'rgba(255,255,255,0.82)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: isDark ? '1px solid rgba(150,175,255,0.14)' : '1px solid rgba(100,130,255,0.12)',
    borderRadius: '1.25rem',
  }

  const inputStyle = {
    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)',
    border: `1px solid ${isDark ? 'rgba(150,175,255,0.22)' : 'rgba(100,130,255,0.2)'}`,
    borderRadius: '0.5rem',
    color: primaryText,
    fontFamily: "'Raleway', sans-serif",
    outline: 'none',
  }

  const filterStyle = (active: boolean) => ({
    fontFamily: "'Raleway', sans-serif",
    fontSize: 12,
    color: active ? primaryText : dimText,
    background: active ? (isDark ? 'rgba(150,175,255,0.14)' : 'rgba(13,21,51,0.08)') : 'transparent',
    borderRadius: '0.375rem',
    padding: '3px 8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <div className="flex flex-col min-h-screen md:h-screen pb-20 md:pb-0">
      {/* Status banners */}
      {!isOnline && (
        <div
          className="text-xs font-medium text-center py-1.5 px-4"
          style={{ background: 'rgba(200,160,40,0.2)', color: 'rgba(240,200,80,0.9)', fontFamily: "'Raleway', sans-serif", backdropFilter: 'blur(8px)' }}
        >
          Offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount > 1 ? 's' : ''} will sync when reconnected` : ''}
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div
          className="text-xs font-medium text-center py-1.5 px-4"
          style={{ background: 'rgba(100,130,255,0.18)', color: 'rgba(170,195,255,0.9)', fontFamily: "'Raleway', sans-serif", backdropFilter: 'blur(8px)' }}
        >
          Syncing {pendingCount} pending change{pendingCount > 1 ? 's' : ''}…
        </div>
      )}

      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      {/* Progress strip */}
      <div
        className="px-5 pt-2 pb-2.5"
        style={{
          background: isDark ? 'rgba(6,12,30,0.5)' : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(100,130,255,0.1)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: trackBg }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%`, background: isDark ? 'rgba(150,175,255,0.7)' : 'rgba(13,21,51,0.6)' }}
            />
          </div>
          <span className="text-xs font-semibold shrink-0 tabular-nums" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
            {overallPct}%
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
          <span className="tabular-nums">{totalRead.toLocaleString()}/{TOTAL_CHAPTERS.toLocaleString()} ch</span>
          {stats && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1"><FlameIcon size={12} />{stats.current_streak}d streak</span>
              <span>·</span>
              <span className="flex items-center gap-1"><CalendarIcon size={12} />Today: {stats.chapters_today}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 md:overflow-hidden px-4 md:px-5 py-4">

        {/* ── Book Grid Panel ── */}
        {showGrid && (
          <div className="flex flex-col flex-1 overflow-hidden md:overflow-y-auto rounded-2xl" style={gridPanelStyle}>
            {/* Search */}
            <div className="flex items-center gap-2 p-3" style={{ borderBottom: isDark ? '1px solid rgba(150,175,255,0.07)' : '1px solid rgba(13,21,51,0.07)' }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isMobile ? "Search books…" : "Search books… (/)"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tabFilteredBooks.length > 0) {
                    e.preventDefault();
                    setSelectedBookName(tabFilteredBooks[0].name);
                    setChaptersInput('');
                    searchInputRef.current?.blur();
                  }
                }}
                className="flex-1 text-sm px-3 py-2"
                style={{ ...inputStyle, transition: 'border-color 0.15s' }}
                onFocus={e => (e.target.style.borderColor = isDark ? 'rgba(150,175,255,0.4)' : 'rgba(13,21,51,0.3)')}
                onBlur={e => (e.target.style.borderColor = isDark ? 'rgba(150,175,255,0.18)' : 'rgba(13,21,51,0.14)')}
              />
              {sortKey !== null && (
                <button
                  onClick={resetSort}
                  style={{ ...filterStyle(false), color: dimText }}
                  className="whitespace-nowrap text-xs px-2 py-1 rounded"
                >
                  Reset order
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-wrap" style={{ borderBottom: isDark ? '1px solid rgba(150,175,255,0.04)' : '1px solid rgba(13,21,51,0.04)' }}>
              <FilterSelect value={filterTestament} onChange={v => { setFilterTestament(v); if (v && filterCategory) { const valid = new Set(books.filter(b => b.testament === v).map(b => b.category)); if (!valid.has(filterCategory)) setFilterCategory(''); } }} placeholder="Testament" options={availableTestamentOptions} />
              <FilterSelect value={filterCategory} onChange={v => { setFilterCategory(v); if (v && filterTestament) { const valid = new Set(books.filter(b => b.category === v).map(b => b.testament)); if (!valid.has(filterTestament)) setFilterTestament(''); } }} placeholder="Category" options={availableCategoryOptions} />
              <FilterSelect value={filterStatus} onChange={setFilterStatus} placeholder="Status" options={[{ value: 'not_started', label: 'Not Started' }, { value: 'in_progress', label: 'In Progress' }, { value: 'complete', label: 'Complete' }]} />
              {anyFilterActive && (
                <button onClick={clearFilters} className="text-xs px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap" style={{ color: 'rgba(240,100,100,0.7)', fontFamily: "'Raleway', sans-serif" }}>
                  Clear filters
                </button>
              )}
              <div className="ml-auto flex gap-1">
                {(["name", "chapters_read", "percent", "status"] as SortKey[]).map(key => {
                  const labels: Record<SortKey, string> = { name: "Name", chapters_read: "Chapters", percent: "%", status: "Status" };
                  return (
                    <button key={key} onClick={() => handleSort(key)} style={filterStyle(sortKey === key)}>
                      {labels[key]}{sortIndicator(key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Card grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
              {tabFilteredBooks.map((book) => (
                <BookCard
                  key={book.name}
                  book={book}
                  isSelected={selectedBook?.name === book.name}
                  onClick={() => {
                    if (selectedBook?.name !== book.name) setChaptersInput('')
                    setOpenedFromNav(false)
                    setSelectedBookName(book.name)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Detail Panel — floats on the starfield ── */}
        {showDetail && (
          <div
            className="flex flex-col w-full md:w-[26rem] shrink-0"
            style={isMobile ? {
              // Mobile: full-screen with background since it replaces the grid
              background: isDark ? 'rgba(6,10,28,0.88)' : 'rgba(245,248,255,0.94)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              borderRadius: '1.25rem',
            } : {
              // Desktop: no box — content floats on the starfield
              // subtle left separator only
              paddingLeft: '0.25rem',
              borderLeft: isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(100,130,255,0.1)',
            }}
          >
            <div className={`p-6 flex flex-col gap-5 flex-1${!isMobile ? ' md:overflow-y-auto' : ''}`}>
              {selectedBook ? (
                <>
                  {isMobile && (
                    <button
                      className="self-start text-sm font-medium mb-1 transition-colors"
                      style={{ color: isDark ? 'rgba(170,195,255,0.7)' : 'rgba(13,21,51,0.5)', fontFamily: "'Raleway', sans-serif" }}
                      onClick={() => { if (openedFromNav) { setOpenedFromNav(false); navigate(-1); } else { setSelectedBookName(null); setChaptersInput(''); } }}
                    >
                      ← Back
                    </button>
                  )}

                  {/* Book header — dramatic, full-bleed typography */}
                  {(() => {
                    const cat = getCategoryPalette(selectedBook.category);
                    const isComplete = selectedBook.chapters_read >= selectedBook.num_chapters;
                    const inProgress = selectedBook.chapters_read > 0 && !isComplete;
                    const arcColor = isComplete || inProgress ? cat.color : (isDark ? 'rgba(150,175,255,0.45)' : 'rgba(100,130,255,0.45)');
                    const pct = Math.round(calculateProgress(selectedBook));

                    return (
                      <>
                        {/* Category row */}
                        <div className="flex items-center gap-2" style={{ color: cat.dim }}>
                          <CategoryIcon category={selectedBook.category} size={16} />
                          <span className="text-sm font-medium" style={{ fontFamily: "'Raleway', sans-serif", letterSpacing: '0.04em' }}>
                            {selectedBook.category}
                          </span>
                          <span
                            className="ml-auto text-xs px-2.5 py-0.5 rounded-full"
                            style={{
                              background: isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.05)',
                              color: isDark ? 'rgba(195,210,255,0.6)' : 'rgba(13,21,51,0.5)',
                              fontFamily: "'Raleway', sans-serif",
                              letterSpacing: '0.05em',
                              border: isDark ? '1px solid rgba(150,175,255,0.14)' : '1px solid rgba(13,21,51,0.1)',
                            }}
                          >
                            {selectedBook.testament}
                          </span>
                        </div>

                        {/* Book name — LARGE Cinzel with category glow */}
                        <div>
                          <h2
                            style={{
                              fontFamily: "'Cinzel', serif",
                              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                              fontWeight: 700,
                              color: primaryText,
                              letterSpacing: '0.04em',
                              lineHeight: 1.2,
                              textShadow: `0 0 32px ${cat.glow}, 0 0 64px ${cat.color.replace(',1)', ',0.08)')}`,
                            }}
                          >
                            {selectedBook.name}
                          </h2>
                        </div>

                        {/* Progress stats */}
                        <div className="flex items-baseline gap-3">
                          <span
                            className="text-4xl font-bold tabular-nums"
                            style={{ fontFamily: "'Cinzel', serif", color: arcColor, letterSpacing: '-0.01em' }}
                          >
                            {pct}%
                          </span>
                          <p className="text-sm" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                            {selectedBook.chapters_read} of {selectedBook.num_chapters} chapters
                          </p>
                          {isComplete && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full w-fit ml-auto"
                              style={{ background: `${cat.glow}`, color: cat.color, fontFamily: "'Raleway', sans-serif", border: `1px solid ${cat.color.replace(',1)', ',0.3)')}` }}
                            >
                              Complete
                            </span>
                          )}
                        </div>

                        {/* Chapter progress — the hero: which chapters, not just how many */}
                        {!isComplete && (
                          <div>
                            <span
                              className="text-xs font-medium uppercase"
                              style={{ color: cat.dim, fontFamily: "'Raleway', sans-serif", letterSpacing: '0.08em' }}
                            >
                              Chapter progress
                            </span>
                            <SegmentedProgressBar total={selectedBook.num_chapters} readChapters={selectedBook.chapters_read_list} />
                          </div>
                        )}

                        {/* Divider */}
                        <div style={{ height: 1, background: isDark ? 'rgba(150,175,255,0.08)' : 'rgba(13,21,51,0.07)' }} />

                        {/* Actions */}
                        {selectedBook.chapters_read >= selectedBook.num_chapters ? (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-center" style={{ color: cat.color, fontFamily: "'Raleway', sans-serif" }}>
                              All {selectedBook.num_chapters} chapters read ✓
                            </p>
                            <button
                              onClick={handleReset}
                              className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                              style={resetConfirm.confirming
                                ? { background: 'rgba(220,60,60,0.18)', border: '1px solid rgba(220,60,60,0.35)', color: 'rgba(240,100,100,0.9)', fontFamily: "'Raleway', sans-serif" }
                                : { background: 'transparent', border: isDark ? '1px solid rgba(150,175,255,0.12)' : '1px solid rgba(13,21,51,0.12)', color: dimText, fontFamily: "'Raleway', sans-serif" }
                              }
                            >
                              {resetConfirm.confirming ? 'Confirm reset?' : 'Reset progress'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <div>
                              <label className="text-sm font-medium block mb-1.5" style={{ color: bodyText, fontFamily: "'Raleway', sans-serif" }}>
                                Chapters read
                              </label>
                              <input
                                ref={chaptersInputRef}
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g. 1-5, 7, 10-12"
                                value={chaptersInput}
                                onChange={e => setChaptersInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
                                className="w-full px-3 py-2"
                                style={{
                                  ...inputStyle,
                                  borderColor: inputIsInvalid ? 'rgba(220,80,80,0.4)' : undefined,
                                }}
                                onFocus={e => (e.target.style.borderColor = inputIsInvalid ? 'rgba(220,80,80,0.6)' : (isDark ? 'rgba(150,175,255,0.4)' : 'rgba(13,21,51,0.3)'))}
                                onBlur={e => (e.target.style.borderColor = inputIsInvalid ? 'rgba(220,80,80,0.4)' : (isDark ? 'rgba(150,175,255,0.18)' : 'rgba(13,21,51,0.14)'))}
                              />
                              <p className="text-xs mt-1 min-h-[1rem]" style={{ color: inputIsInvalid ? 'rgba(240,100,100,0.75)' : dimText, fontFamily: "'Raleway', sans-serif" }}>
                                {inputIsInvalid
                                  ? 'Invalid format — try "1-5" or "3, 7, 12"'
                                  : parsedChapters.length > 0
                                    ? `Will log: ${parsedChapters.length} chapter${parsedChapters.length !== 1 ? 's' : ''} (${parsedChapters.slice(0, 8).join(', ')}${parsedChapters.length > 8 ? '…' : ''})`
                                    : ''}
                              </p>
                            </div>
                            <button
                              onClick={handleSubmit}
                              disabled={parsedChapters.length === 0}
                              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background: parsedChapters.length > 0
                                  ? (isDark ? 'rgba(150,175,255,0.18)' : 'rgba(13,21,51,0.1)')
                                  : 'transparent',
                                border: isDark ? '1px solid rgba(150,175,255,0.24)' : '1px solid rgba(13,21,51,0.16)',
                                color: primaryText,
                                fontFamily: "'Raleway', sans-serif",
                                letterSpacing: '0.06em',
                              }}
                            >
                              Submit
                            </button>

                            <div className="flex items-center gap-2 pt-1">
                              <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(150,175,255,0.07)' : 'rgba(13,21,51,0.07)' }} />
                              <span className="text-xs select-none" style={{ color: isDark ? 'rgba(150,175,255,0.25)' : 'rgba(13,21,51,0.22)', fontFamily: "'Raleway', sans-serif" }}>other actions</span>
                              <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(150,175,255,0.07)' : 'rgba(13,21,51,0.07)' }} />
                            </div>

                            {selectedBook.chapters_read > 0 && (
                              <div className="flex gap-2">
                                {[
                                  { label: 'Undo', onClick: handleUndo, disabled: !isOnline, confirm: false },
                                  { label: resetConfirm.confirming ? 'Confirm reset?' : 'Reset', onClick: handleReset, disabled: false, confirm: resetConfirm.confirming },
                                ].map(({ label, onClick, disabled, confirm }) => (
                                  <button
                                    key={label}
                                    onClick={onClick}
                                    disabled={disabled}
                                    className="flex-1 py-2 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{
                                      background: confirm ? 'rgba(220,60,60,0.18)' : 'transparent',
                                      border: confirm ? '1px solid rgba(220,60,60,0.35)' : isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(13,21,51,0.1)',
                                      color: confirm ? 'rgba(240,100,100,0.9)' : dimText,
                                      fontFamily: "'Raleway', sans-serif",
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {confirmMarkAll.confirming ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={handleMarkAllRead}
                                  className="flex-1 py-2 rounded-xl font-semibold text-sm transition-colors"
                                  style={{ background: `${cat.glow}`, border: `1px solid ${cat.color.replace(',1)', ',0.3)')}`, color: cat.color, fontFamily: "'Raleway', sans-serif" }}
                                >
                                  Confirm — all {selectedBook.num_chapters} chapters
                                </button>
                                <button
                                  onClick={() => confirmMarkAll.cancel()}
                                  className="px-3.5 py-2 rounded-xl text-sm transition-colors"
                                  style={{ background: 'transparent', border: isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(13,21,51,0.1)', color: dimText, fontFamily: "'Raleway', sans-serif" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => confirmMarkAll.request()}
                                className="w-full py-2 rounded-xl text-sm transition-colors"
                                style={{ background: 'transparent', border: isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(13,21,51,0.1)', color: dimText, fontFamily: "'Raleway', sans-serif" }}
                              >
                                Mark all as read
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 gap-4">
                  <span style={{ color: isDark ? 'rgba(150,175,255,0.3)' : 'rgba(100,130,255,0.3)' }}>
                    <BookOpenIcon size={48} />
                  </span>
                  <div className="text-center">
                    <p className="text-sm mb-2" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                      Select a book to begin
                    </p>
                    <p
                      style={{
                        color: isDark ? 'rgba(170,195,255,0.45)' : 'rgba(13,21,51,0.4)',
                        fontFamily: "'Cormorant Garamond', serif",
                        fontStyle: 'italic',
                        fontSize: 16,
                        lineHeight: 1.5,
                        maxWidth: '18rem',
                      }}
                    >
                      "Your word is a lamp to my feet and a light to my path"
                      <br />
                      <span style={{ fontSize: 13, opacity: 0.7 }}>— Psalm 119:105</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
