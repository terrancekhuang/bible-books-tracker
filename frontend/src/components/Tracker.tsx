import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authHeaders } from '../lib/auth'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { enqueueWrite, flushQueue, getPendingCount } from '../lib/offlineQueue'
import { getCache, setCache, invalidateCache } from '../lib/cache'
import { FlameIcon, CalendarIcon, CategoryIcon, BookOpenIcon } from './Icons'
import FilterSelect from './FilterSelect'
import SegmentedProgressBar from './SegmentedProgressBar'
import NavBar from './NavBar'

interface Book {
  book_id: number;
  name: string;
  testament: string;
  category: string;
  num_chapters: number;
  chapters_read: number;
  chapters_read_list: number[];
  last_read_at: string | null;
}

interface Stats {
  chapters_today: number;
  chapters_this_week: number;
  current_streak: number;
  best_streak: number;
  total_chapters: number;
  total_days: number;
}

type SortKey = "name" | "chapters_read" | "percent" | "status";
type SortDir = "asc" | "desc";

const TOTAL_CHAPTERS = 1189

const statusRank = (book: Book) => {
  if (book.chapters_read >= book.num_chapters) return 2;
  if (book.chapters_read > 0) return 1;
  return 0;
};

function parseChapters(input: string, max: number): number[] {
  if (!input.trim()) return [];
  const result = new Set<number>();
  for (const part of input.split(',').map(s => s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(s => parseInt(s.trim()));
      if (isNaN(a) || isNaN(b) || a > b || a < 1 || b > max) return [];
      for (let i = a; i <= b; i++) result.add(i);
    } else {
      const n = parseInt(part);
      if (isNaN(n) || n < 1 || n > max) return [];
      result.add(n);
    }
  }
  return [...result].sort((a, b) => a - b);
}

interface UserInfo {
  name: string | null
  picture_url: string | null
}

export default function Tracker() {
  const { logout } = useAuth()
  const { isDark, colors } = useTheme()
  const [books, setBooks] = useState<Book[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chaptersInput, setChaptersInput] = useState('');
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState('');
  const [filterTestament, setFilterTestament] = useState('');
  const [filterCategory,  setFilterCategory]  = useState('');
  const [filterStatus,    setFilterStatus]     = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [openedFromNav, setOpenedFromNav] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const chaptersInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { primaryText, dimText, bodyText, trackBg } = colors

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    getPendingCount().then(setPendingCount);

    const handleOnline = () => {
      setIsOnline(true);
      flushQueue(logout).then(() =>
        getPendingCount().then(n => {
          setPendingCount(n);
          if (n === 0) {
            fetch("/api/books", { headers: authHeaders() })
              .then(r => r.json())
              .then(rawData => {
                const mapped = rawData.map((item: Book & { chapters_read_list: number[] }) => ({
                  book_id: item.book_id,
                  name: item.name,
                  testament: item.testament,
                  category: item.category,
                  num_chapters: item.num_chapters,
                  chapters_read: item.chapters_read,
                  chapters_read_list: item.chapters_read_list || [],
                  last_read_at: item.last_read_at ?? null,
                }))
                setBooks(mapped)
                setCache('books', mapped)
              })
              .catch(() => {});
          }
        })
      );
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [logout]);

  useEffect(() => {
    const cached = getCache<Book[]>('books')
    if (cached) setBooks(cached)
    const fetchBooks = () => fetch("/api/books", { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) { logout(); return null }
        return res.json()
      })
      .then((rawData) => {
        if (!rawData) return
        const transformedBooks = rawData.map((item: Book) => ({
          book_id: item.book_id,
          name: item.name,
          testament: item.testament,
          category: item.category,
          num_chapters: item.num_chapters,
          chapters_read: item.chapters_read,
          chapters_read_list: item.chapters_read_list || [],
          last_read_at: item.last_read_at ?? null,
        }))
        setBooks(transformedBooks)
        setCache('books', transformedBooks)
      })
    if (navigator.onLine) {
      flushQueue(logout).then(fetchBooks)
    } else {
      fetchBooks()
    }
  }, [logout]);

  useEffect(() => {
    const cached = getCache<UserInfo>('user')
    if (cached) setUser(cached)
    fetch("/auth/me", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setUser(data); setCache('user', data) } })
  }, []);

  const fetchStats = () => {
    fetch(`/api/stats?tz_offset=${-new Date().getTimezoneOffset()}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setStats(data); setCache('stats', data) } })
  }

  useEffect(() => {
    const cached = getCache<Stats>('stats')
    if (cached) setStats(cached)
    fetchStats()
  }, []);

  const totalRead = books.reduce((sum, b) => sum + b.chapters_read, 0)
  const overallPct = Math.round((totalRead / TOTAL_CHAPTERS) * 100)

  useEffect(() => {
    const state = location.state as { selectBook?: string } | null;
    if (!state?.selectBook || books.length === 0) return;
    const book = books.find(b => b.name === state.selectBook);
    if (book) {
      setSelectedBook(book);
      setOpenedFromNav(true);
      window.history.replaceState({}, '');
    }
  }, [books, location.state]);

  const calculateProgress = (book: Book) => {
    if (!book.chapters_read) return 0;
    return Math.round((book.chapters_read / book.num_chapters) * 100);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const resetSort = () => { setSortKey(null); setSortDir("asc"); };

  const sortedBooks = sortKey === null
    ? books
    : [...books].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = a.name.localeCompare(b.name);
        else if (sortKey === "chapters_read") cmp = a.chapters_read - b.chapters_read;
        else if (sortKey === "percent") cmp = calculateProgress(a) - calculateProgress(b);
        else if (sortKey === "status") cmp = statusRank(a) - statusRank(b);
        return sortDir === "asc" ? cmp : -cmp;
      });

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const filteredBooks = search
    ? sortedBooks.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : sortedBooks;

  const availableCategoryOptions = [...new Set(
    books.filter(b => !filterTestament || b.testament === filterTestament).map(b => b.category)
  )];
  const availableTestamentOptions = [...new Set(
    books.filter(b => !filterCategory || b.category === filterCategory).map(b => b.testament)
  )];
  const anyFilterActive = filterTestament !== '' || filterCategory !== '' || filterStatus !== '';
  const clearFilters = () => { setFilterTestament(''); setFilterCategory(''); setFilterStatus(''); };

  const parsedChapters = selectedBook ? parseChapters(chaptersInput, selectedBook.num_chapters) : [];
  const inputIsInvalid = chaptersInput.trim() !== '' && parsedChapters.length === 0;

  const tabFilteredBooks = filteredBooks.filter(b => {
    if (filterTestament && b.testament !== filterTestament) return false;
    if (filterCategory  && b.category  !== filterCategory)  return false;
    if (filterStatus) {
      const isComplete = b.chapters_read >= b.num_chapters;
      const inProgress = b.chapters_read > 0 && !isComplete;
      if (filterStatus === 'complete'    && !isComplete)         return false;
      if (filterStatus === 'in_progress' && !inProgress)         return false;
      if (filterStatus === 'not_started' && b.chapters_read > 0) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!selectedBook || isMobile) return;
    document.querySelector(`[data-book="${selectedBook.name}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedBook, isMobile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (resetConfirm) { setResetConfirm(false); return; }
        if (confirmMarkAll) { setConfirmMarkAll(false); return; }
        if (target === searchInputRef.current) {
          setSearch(''); searchInputRef.current?.blur();
        } else {
          setOpenedFromNav(false); setSelectedBook(null); setChaptersInput('');
        }
        return;
      }
      if (e.key === '/' && !isInput) { e.preventDefault(); searchInputRef.current?.focus(); return; }
      if (e.key === 'Tab' && !isInput && selectedBook) { e.preventDefault(); chaptersInputRef.current?.focus(); return; }
      if (e.key === 'Enter' && !isInput && selectedBook) { e.preventDefault(); handleSubmit(); return; }
      if (e.key === 'u' && !isInput && selectedBook) { e.preventDefault(); if (isOnline) handleUndo(); return; }
      if (e.key === 'R' && !isInput && selectedBook) { e.preventDefault(); handleReset(); return; }
      if (e.key === 'A' && !isInput && selectedBook) {
        e.preventDefault();
        if (confirmMarkAll) handleMarkAllRead(); else setConfirmMarkAll(true);
        return;
      }
      if (e.key === 'i' && !isInput && selectedBook) { e.preventDefault(); chaptersInputRef.current?.focus(); return; }

      if (e.key === 'g' && !isInput) {
        e.preventDefault();
        if (lastKeyRef.current === 'g') {
          if (lastKeyTimeoutRef.current !== null) clearTimeout(lastKeyTimeoutRef.current);
          lastKeyRef.current = null;
          if (tabFilteredBooks.length > 0) { setSelectedBook(tabFilteredBooks[0]); setChaptersInput(''); }
        } else {
          lastKeyRef.current = 'g';
          lastKeyTimeoutRef.current = window.setTimeout(() => { lastKeyRef.current = null; }, 500);
        }
        return;
      }
      if (e.key === 'G' && !isInput) {
        e.preventDefault();
        if (tabFilteredBooks.length > 0) { setSelectedBook(tabFilteredBooks[tabFilteredBooks.length - 1]); setChaptersInput(''); }
        return;
      }

      const VIM_MAP: Record<string, string> = { h: 'ArrowLeft', l: 'ArrowRight', k: 'ArrowUp', j: 'ArrowDown' };
      const resolvedKey = (!isInput && VIM_MAP[e.key]) ? VIM_MAP[e.key] : e.key;

      if ((resolvedKey === 'ArrowRight' || resolvedKey === 'ArrowLeft') && !isInput) {
        e.preventDefault();
        const currentIndex = selectedBook ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name) : -1;
        if (resolvedKey === 'ArrowRight') {
          if (currentIndex === -1 && tabFilteredBooks.length > 0) setSelectedBook(tabFilteredBooks[0]);
          else if (currentIndex < tabFilteredBooks.length - 1) setSelectedBook(tabFilteredBooks[currentIndex + 1]);
        } else {
          if (currentIndex > 0) setSelectedBook(tabFilteredBooks[currentIndex - 1]);
        }
        setChaptersInput(''); return;
      }
      if ((resolvedKey === 'ArrowDown' || resolvedKey === 'ArrowUp') && !isInput) {
        e.preventDefault();
        const numCols = window.innerWidth < 640 ? 2 : 3;
        const currentIndex = selectedBook ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name) : -1;
        if (resolvedKey === 'ArrowDown') {
          if (currentIndex === -1 && tabFilteredBooks.length > 0) setSelectedBook(tabFilteredBooks[0]);
          else { const next = currentIndex + numCols; if (next < tabFilteredBooks.length) setSelectedBook(tabFilteredBooks[next]); }
        } else {
          const prev = currentIndex - numCols; if (prev >= 0) setSelectedBook(tabFilteredBooks[prev]);
        }
        setChaptersInput('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBook, tabFilteredBooks, chaptersInput, resetConfirm, confirmMarkAll, isOnline]);

  useEffect(() => { setConfirmMarkAll(false); setResetConfirm(false); }, [selectedBook]);

  const submitChapters = async (book: Book, chapters: number[]) => {
    if (chapters.length === 0) return;
    const now = new Date().toISOString();
    const optimisticList = [...new Set([...book.chapters_read_list, ...chapters])].sort((a, b) => a - b);
    const newlyLogged = optimisticList.length - book.chapters_read_list.length;
    const optimisticBook = { ...book, chapters_read: optimisticList.length, chapters_read_list: optimisticList, last_read_at: now };
    setBooks(prev => prev.map(b => b.name === book.name ? optimisticBook : b));
    setSelectedBook(optimisticBook);
    if (newlyLogged > 0) {
      setStats(prev => prev ? { ...prev, chapters_today: prev.chapters_today + newlyLogged, total_chapters: prev.total_chapters + newlyLogged } : prev)
    }
    const body = JSON.stringify({ book_name: book.name, chapters });
    const headers = authHeaders() as Record<string, string>;
    try {
      const response = await fetch("/api/progress", { method: "POST", headers, body });
      if (response.status === 401) { logout(); return; }
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Failed");
      setBooks(prev => prev.map(b => b.name === book.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list, last_read_at: now } : b));
      setSelectedBook(prev => prev ? { ...prev, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list, last_read_at: now } : null);
      const cachedBooks = getCache<Book[]>('books')
      if (cachedBooks) setCache('books', cachedBooks.map(b => b.name === book.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list, last_read_at: now } : b))
      if (data.newly_logged > 0) {
        invalidateCache('activity')
        fetchStats()
      }
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        try {
          await enqueueWrite("/api/progress", "POST", headers, body);
          setPendingCount(c => c + 1);
        } catch {
          console.error("Failed to queue write; change will be lost if page is closed");
        }
      } else {
        setBooks(prev => prev.map(b => b.name === book.name ? book : b));
        setSelectedBook(book);
        console.error("Error updating progress:", e);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedBook || parsedChapters.length === 0) return;
    setChaptersInput('');
    await submitChapters(selectedBook, parsedChapters);
  };

  const handleMarkAllRead = async () => {
    if (!selectedBook) return;
    const allChapters = Array.from({ length: selectedBook.num_chapters }, (_, i) => i + 1);
    setConfirmMarkAll(false);
    await submitChapters(selectedBook, allChapters);
  };

  const handleUndo = async () => {
    if (!selectedBook) return;
    try {
      const response = await fetch("/api/progress/undo", { method: "POST", headers: authHeaders(), body: JSON.stringify({ book_name: selectedBook.name }) });
      if (response.status === 401) { logout(); return; }
      const data = await response.json();
      if (data.success) {
        setBooks(books.map(b => b.name === selectedBook.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list } : b));
        setSelectedBook({ ...selectedBook, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list });
        setChaptersInput('');
        const cachedBooks = getCache<Book[]>('books')
        if (cachedBooks) setCache('books', cachedBooks.map(b => b.name === selectedBook.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list } : b))
        invalidateCache('activity')
        fetchStats();
      }
    } catch (e) { console.error("Error undoing progress:", e); }
  };

  const handleReset = async () => {
    if (!selectedBook) return;
    if (!resetConfirm) { setResetConfirm(true); return; }
    try {
      const response = await fetch("/api/progress/reset", { method: "POST", headers: authHeaders(), body: JSON.stringify({ book_name: selectedBook.name }) });
      if (response.status === 401) { logout(); return; }
      const data = await response.json();
      if (data.success) {
        setBooks(books.map(b => b.name === selectedBook.name ? { ...b, chapters_read: 0, chapters_read_list: [] } : b));
        setSelectedBook({ ...selectedBook, chapters_read: 0, chapters_read_list: [] });
        setChaptersInput(''); setResetConfirm(false);
        const cachedBooks = getCache<Book[]>('books')
        if (cachedBooks) setCache('books', cachedBooks.map(b => b.name === selectedBook.name ? { ...b, chapters_read: 0, chapters_read_list: [] } : b))
        invalidateCache('activity')
        fetchStats();
      }
    } catch (e) { console.error("Error resetting progress:", e); }
  };

  const showGrid = !isMobile || !selectedBook;
  const showDetail = !isMobile || !!selectedBook;

  const glassPanel = {
    background: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: isDark ? '1px solid rgba(150,175,255,0.22)' : '1px solid rgba(100,130,255,0.14)',
    borderRadius: '1rem',
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

        {/* Book Grid Panel */}
        {showGrid && (
          <div className="flex flex-col flex-1 overflow-hidden md:overflow-y-auto rounded-2xl" style={glassPanel}>
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
                    setSelectedBook(tabFilteredBooks[0]);
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

            {/* Card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3">
              {tabFilteredBooks.map((book) => {
                const isComplete = book.chapters_read >= book.num_chapters;
                const inProgress = book.chapters_read > 0 && !isComplete;
                const isSelected = selectedBook?.name === book.name;

                let cardStyle = {}
                if (isSelected && isComplete) {
                  cardStyle = {
                    background: isDark ? 'rgba(60,200,140,0.2)' : 'rgba(40,170,110,0.18)',
                    border: isDark ? '2px solid rgba(80,215,155,0.6)' : '2px solid rgba(40,170,110,0.55)',
                    boxShadow: isDark ? '0 0 20px rgba(60,200,140,0.18)' : '0 0 16px rgba(40,170,110,0.12)',
                  }
                } else if (isSelected && inProgress) {
                  cardStyle = {
                    background: isDark ? 'rgba(215,185,90,0.2)' : 'rgba(200,160,40,0.18)',
                    border: isDark ? '2px solid rgba(230,200,110,0.6)' : '2px solid rgba(180,140,30,0.5)',
                    boxShadow: isDark ? '0 0 20px rgba(215,185,90,0.15)' : '0 0 16px rgba(200,160,40,0.1)',
                  }
                } else if (isSelected) {
                  cardStyle = {
                    background: isDark ? 'rgba(100,130,255,0.22)' : 'rgba(100,130,255,0.18)',
                    border: isDark ? '2px solid rgba(170,195,255,0.6)' : '2px solid rgba(100,130,255,0.5)',
                    boxShadow: isDark ? '0 0 20px rgba(150,175,255,0.18)' : '0 0 16px rgba(100,130,255,0.12)',
                  }
                } else if (isComplete) {
                  cardStyle = {
                    background: isDark ? 'rgba(60,200,140,0.1)' : 'rgba(40,170,110,0.1)',
                    border: '1px solid ' + (isDark ? 'rgba(60,200,140,0.24)' : 'rgba(40,170,110,0.24)'),
                  }
                } else if (inProgress) {
                  cardStyle = {
                    background: isDark ? 'rgba(215,185,90,0.1)' : 'rgba(200,160,40,0.1)',
                    border: '1px solid ' + (isDark ? 'rgba(225,195,100,0.24)' : 'rgba(180,140,30,0.22)'),
                  }
                } else {
                  cardStyle = {
                    background: isDark ? 'rgba(100,130,255,0.09)' : 'rgba(215,225,255,0.72)',
                    border: '1px solid ' + (isDark ? 'rgba(130,160,255,0.16)' : 'rgba(130,160,255,0.22)'),
                  }
                }

                const iconColor = isComplete
                  ? (isDark ? 'rgba(80,200,140,0.9)' : 'rgba(40,160,100,0.8)')
                  : inProgress
                    ? (isDark ? 'rgba(225,195,100,0.9)' : 'rgba(160,120,20,0.75)')
                    : isSelected
                      ? (isDark ? 'rgba(200,215,255,0.9)' : 'rgba(60,90,200,0.8)')
                      : dimText

                return (
                  <div
                    key={book.name}
                    data-book={book.name}
                    onClick={() => { if (selectedBook?.name !== book.name) setChaptersInput(''); setOpenedFromNav(false); setSelectedBook(book); }}
                    className="rounded-xl p-3.5 cursor-pointer flex flex-col gap-1 transition-all duration-150"
                    style={{ ...cardStyle, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                  >
                    <div className="flex items-center gap-1.5" style={{ color: iconColor }}>
                      <CategoryIcon category={book.category} size={14} />
                      <p className="text-xs font-medium truncate" style={{ fontFamily: "'Raleway', sans-serif" }}>{book.category}</p>
                    </div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>{book.name}</p>
                    {isComplete ? (
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(60,200,140,0.15)', color: 'rgba(80,200,140,0.9)', fontFamily: "'Raleway', sans-serif" }}>
                          ✓ Complete
                        </span>
                      </div>
                    ) : (
                      <>
                        <SegmentedProgressBar total={book.num_chapters} readChapters={book.chapters_read_list} />
                        <p className="text-xs" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                          {book.chapters_read || 0} / {book.num_chapters}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detail Panel */}
        {showDetail && (
          <div className="flex flex-col w-full md:w-96 md:overflow-y-auto shrink-0">
            <div className="p-6 flex flex-col gap-4 flex-1" style={glassPanel}>
              {selectedBook ? (
                <>
                  {isMobile && (
                    <button
                      className="self-start text-sm font-medium mb-1 transition-colors"
                      style={{ color: isDark ? 'rgba(170,195,255,0.7)' : 'rgba(13,21,51,0.5)', fontFamily: "'Raleway', sans-serif" }}
                      onClick={() => { if (openedFromNav) { setOpenedFromNav(false); navigate(-1); } else { setSelectedBook(null); setChaptersInput(''); } }}
                    >
                      ← Back
                    </button>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1.5" style={{ color: dimText }}>
                      <CategoryIcon category={selectedBook.category} size={18} />
                      <span className="text-sm font-medium" style={{ fontFamily: "'Raleway', sans-serif" }}>{selectedBook.category}</span>
                    </div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: "'Cinzel', serif", color: primaryText, letterSpacing: '0.03em' }}>
                      {selectedBook.name}
                    </h2>
                    <span
                      className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: isDark ? 'rgba(150,175,255,0.1)' : 'rgba(13,21,51,0.06)',
                        color: isDark ? 'rgba(195,210,255,0.7)' : 'rgba(13,21,51,0.55)',
                        fontFamily: "'Raleway', sans-serif",
                        letterSpacing: '0.04em',
                      }}
                    >
                      {selectedBook.testament}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>Progress</span>
                      <span className="font-medium" style={{ color: primaryText, fontFamily: "'Raleway', sans-serif" }}>
                        {selectedBook.chapters_read || 0} / {selectedBook.num_chapters} chapters
                      </span>
                    </div>
                    <SegmentedProgressBar total={selectedBook.num_chapters} readChapters={selectedBook.chapters_read_list} />
                    <p className="text-xs mt-1" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>
                      {calculateProgress(selectedBook)}% complete
                    </p>
                  </div>

                  {selectedBook.chapters_read >= selectedBook.num_chapters ? (
                    <div
                      className="rounded-xl p-4 text-center flex flex-col gap-2"
                      style={{ background: 'rgba(60,200,140,0.08)', border: '1px solid rgba(60,200,140,0.2)' }}
                    >
                      <p className="font-semibold" style={{ color: 'rgba(80,200,140,0.9)', fontFamily: "'Raleway', sans-serif" }}>All chapters read! ✓</p>
                      <button
                        onClick={handleReset}
                        className="w-full py-2 rounded-xl text-sm font-medium transition-colors"
                        style={resetConfirm
                          ? { background: 'rgba(220,60,60,0.2)', border: '1px solid rgba(220,60,60,0.4)', color: 'rgba(240,100,100,0.9)', fontFamily: "'Raleway', sans-serif" }
                          : { background: 'transparent', border: '1px solid rgba(60,200,140,0.25)', color: 'rgba(80,200,140,0.7)', fontFamily: "'Raleway', sans-serif" }
                        }
                      >
                        {resetConfirm ? 'Confirm reset?' : 'Reset progress'}
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
                            ? (isDark ? 'rgba(150,175,255,0.22)' : 'rgba(13,21,51,0.12)')
                            : 'transparent',
                          border: isDark ? '1px solid rgba(150,175,255,0.28)' : '1px solid rgba(13,21,51,0.18)',
                          color: primaryText,
                          fontFamily: "'Raleway', sans-serif",
                          letterSpacing: '0.05em',
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
                            { label: resetConfirm ? 'Confirm reset?' : 'Reset', onClick: handleReset, disabled: false, confirm: resetConfirm },
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

                      {confirmMarkAll ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleMarkAllRead}
                            className="flex-1 py-2 rounded-xl font-semibold text-sm transition-colors"
                            style={{ background: 'rgba(60,200,140,0.2)', border: '1px solid rgba(60,200,140,0.3)', color: 'rgba(80,200,140,0.9)', fontFamily: "'Raleway', sans-serif" }}
                          >
                            Confirm — all {selectedBook.num_chapters} chapters
                          </button>
                          <button
                            onClick={() => setConfirmMarkAll(false)}
                            className="px-3.5 py-2 rounded-xl text-sm transition-colors"
                            style={{ background: 'transparent', border: isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(13,21,51,0.1)', color: dimText, fontFamily: "'Raleway', sans-serif" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmMarkAll(true)}
                          className="w-full py-2 rounded-xl text-sm transition-colors"
                          style={{ background: 'transparent', border: isDark ? '1px solid rgba(150,175,255,0.1)' : '1px solid rgba(13,21,51,0.1)', color: dimText, fontFamily: "'Raleway', sans-serif" }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
                  <span style={{ color: dimText }}><BookOpenIcon size={40} /></span>
                  <p className="text-sm text-center" style={{ color: dimText, fontFamily: "'Raleway', sans-serif" }}>Select a book to view details</p>
                  <p className="text-sm text-center" style={{ color: isDark ? 'rgba(170,195,255,0.55)' : 'rgba(13,21,51,0.45)', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15 }}>
                    "Your word is a lamp to my feet" — Ps 119:105
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
