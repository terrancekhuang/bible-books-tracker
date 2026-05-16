import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authHeaders } from '../lib/auth'
import { enqueueWrite, flushQueue, getPendingCount } from '../lib/offlineQueue'
import { MoonIcon, SunIcon } from './Icons'
import FilterSelect from './FilterSelect'
import SegmentedProgressBar from './SegmentedProgressBar'
import UserMenu from './UserMenu'

interface Book {
  book_id: number;
  name: string;
  testament: string;
  category: string;
  num_chapters: number;
  chapters_read: number;
  chapters_read_list: number[];
}

type SortKey = "name" | "chapters_read" | "percent" | "status";
type SortDir = "asc" | "desc";

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

export default function Tracker({ onLogout, theme, onToggleTheme }: { onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chaptersInput, setChaptersInput] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState('');
  const [filterTestament, setFilterTestament] = useState('');
  const [filterCategory,  setFilterCategory]  = useState('');
  const [filterStatus,    setFilterStatus]     = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const chaptersInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    getPendingCount().then(setPendingCount);

    const handleOnline = () => {
      setIsOnline(true);
      flushQueue(onLogout).then(() =>
        getPendingCount().then(n => {
          setPendingCount(n);
          if (n === 0) {
            fetch("/api/books", { headers: authHeaders() })
              .then(r => r.json())
              .then(rawData => {
                setBooks(rawData.map((item: Book & { chapters_read_list: number[] }) => ({
                  book_id: item.book_id,
                  name: item.name,
                  testament: item.testament,
                  category: item.category,
                  num_chapters: item.num_chapters,
                  chapters_read: item.chapters_read,
                  chapters_read_list: item.chapters_read_list || [],
                })));
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
  }, [onLogout]);

  useEffect(() => {
    fetch("/api/books", { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) { onLogout(); return null }
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
        }));
        setBooks(transformedBooks);
      });
  }, []);

  useEffect(() => {
    fetch("/auth/me", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser(data) });
  }, []);

  const calculateProgress = (book: Book) => {
    if (!book.chapters_read) return 0;
    return Math.round((book.chapters_read / book.num_chapters) * 100);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const resetSort = () => {
    setSortKey(null);
    setSortDir("asc");
  };

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
    document
      .querySelector(`[data-book="${selectedBook.name}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedBook, isMobile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowHelp(v => !v);
        return;
      }

      if (e.key === 'Escape') {
        if (showHelp) { setShowHelp(false); return; }
        if (target === searchInputRef.current) {
          setSearch('');
          searchInputRef.current?.blur();
        } else {
          setSelectedBook(null);
          setChaptersInput('');
        }
        return;
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && !isInput && selectedBook) {
        e.preventDefault();
        chaptersInputRef.current?.focus();
        return;
      }

      if (e.key === 'Enter' && !isInput && selectedBook) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      if (e.key === 'u' && !isInput && selectedBook) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'i' && !isInput && selectedBook) {
        e.preventDefault();
        chaptersInputRef.current?.focus();
        return;
      }

      if (e.key === 'p' && !isInput) {
        e.preventDefault();
        navigate('/profile');
        return;
      }

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
        const currentIndex = selectedBook
          ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name)
          : -1;
        if (resolvedKey === 'ArrowRight') {
          if (currentIndex === -1 && tabFilteredBooks.length > 0) {
            setSelectedBook(tabFilteredBooks[0]);
          } else if (currentIndex < tabFilteredBooks.length - 1) {
            setSelectedBook(tabFilteredBooks[currentIndex + 1]);
          }
        } else {
          if (currentIndex > 0) {
            setSelectedBook(tabFilteredBooks[currentIndex - 1]);
          }
        }
        setChaptersInput('');
        return;
      }

      if ((resolvedKey === 'ArrowDown' || resolvedKey === 'ArrowUp') && !isInput) {
        e.preventDefault();
        const numCols = window.innerWidth < 640 ? 2 : 3;
        const currentIndex = selectedBook
          ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name)
          : -1;
        if (resolvedKey === 'ArrowDown') {
          if (currentIndex === -1 && tabFilteredBooks.length > 0) {
            setSelectedBook(tabFilteredBooks[0]);
          } else {
            const next = currentIndex + numCols;
            if (next < tabFilteredBooks.length) setSelectedBook(tabFilteredBooks[next]);
          }
        } else {
          const prev = currentIndex - numCols;
          if (prev >= 0) setSelectedBook(tabFilteredBooks[prev]);
        }
        setChaptersInput('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBook, tabFilteredBooks, chaptersInput, showHelp]);

  const handleSubmit = async () => {
    if (!selectedBook || parsedChapters.length === 0) return;

    const optimisticList = [...new Set([...selectedBook.chapters_read_list, ...parsedChapters])].sort((a, b) => a - b);
    const optimisticBook = { ...selectedBook, chapters_read: optimisticList.length, chapters_read_list: optimisticList };
    setBooks(prev => prev.map(b => b.name === selectedBook.name ? optimisticBook : b));
    setSelectedBook(optimisticBook);
    setChaptersInput('');

    const body = JSON.stringify({ book_name: selectedBook.name, chapters: parsedChapters });
    const headers = authHeaders() as Record<string, string>;

    try {
      const response = await fetch("/api/progress", { method: "POST", headers, body });

      if (response.status === 401) { onLogout(); return; }

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Failed");

      setBooks(prev => prev.map(b => b.name === selectedBook.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list } : b));
      setSelectedBook(prev => prev ? { ...prev, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list } : null);
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        await enqueueWrite("/api/progress", "POST", headers, body);
        setPendingCount(c => c + 1);
      } else {
        setBooks(prev => prev.map(b => b.name === selectedBook.name ? selectedBook : b));
        setSelectedBook(selectedBook);
        console.error("Error updating progress:", e);
      }
    }
  };

  const handleUndo = async () => {
    if (!selectedBook) return;
    try {
      const response = await fetch("/api/progress/undo", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ book_name: selectedBook.name }),
      });
      const data = await response.json();
      if (response.status === 401) { onLogout(); return; }
      if (data.success) {
        setBooks(books.map(b => b.name === selectedBook.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list } : b));
        setSelectedBook({ ...selectedBook, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list });
        setChaptersInput('');
      }
    } catch (e) {
      console.error("Error undoing progress:", e);
    }
  };

  const showGrid = !isMobile || !selectedBook;
  const showDetail = !isMobile || !!selectedBook;

  return (
    <div className="flex flex-col min-h-screen md:h-screen bg-slate-50 dark:bg-slate-900">
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4">
          Offline{pendingCount > 0 ? ` — ${pendingCount} change${pendingCount > 1 ? 's' : ''} will sync when reconnected` : ''}
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-indigo-600 text-white text-xs font-medium text-center py-1.5 px-4">
          Syncing {pendingCount} pending change{pendingCount > 1 ? 's' : ''}…
        </div>
      )}
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <h1 className="text-xl md:text-2xl font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">
            Bible Books Tracker
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <UserMenu
              pictureUrl={user?.picture_url}
              userName={user?.name}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 flex-1 md:overflow-hidden px-4 md:px-5 py-4">
        {/* Book Grid Panel */}
        {showGrid && (
          <div className="flex flex-col flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden md:overflow-y-auto">
            {/* Search + Sort controls */}
            <div className="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-700">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isMobile ? "Search books…" : "Search books… (press /)"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {sortKey !== null && (
                <button
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors whitespace-nowrap"
                  onClick={resetSort}
                >
                  Reset order
                </button>
              )}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-wrap">
              <FilterSelect
                value={filterTestament}
                onChange={v => {
                  setFilterTestament(v);
                  if (v && filterCategory) {
                    const valid = new Set(books.filter(b => b.testament === v).map(b => b.category));
                    if (!valid.has(filterCategory)) setFilterCategory('');
                  }
                }}
                placeholder="Testament"
                options={availableTestamentOptions}
              />
              <FilterSelect
                value={filterCategory}
                onChange={v => {
                  setFilterCategory(v);
                  if (v && filterTestament) {
                    const valid = new Set(books.filter(b => b.category === v).map(b => b.testament));
                    if (!valid.has(filterTestament)) setFilterTestament('');
                  }
                }}
                placeholder="Category"
                options={availableCategoryOptions}
              />
              <FilterSelect
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="Status"
                options={[
                  { value: 'not_started', label: 'Not Started' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'complete',    label: 'Complete' },
                ]}
              />
              {anyFilterActive && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap"
                >
                  Clear filters
                </button>
              )}
              {/* Sort controls */}
              <div className="ml-auto flex gap-1">
                {(["name", "chapters_read", "percent", "status"] as SortKey[]).map(key => {
                  const labels: Record<SortKey, string> = {
                    name: "Name",
                    chapters_read: "Chapters",
                    percent: "%",
                    status: "Status",
                  };
                  return (
                    <button
                      key={key}
                      onClick={() => handleSort(key)}
                      className={[
                        "text-xs px-2 py-1 rounded transition-colors",
                        sortKey === key
                          ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 font-medium"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
                      ].join(" ")}
                    >
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
                const isSelected = selectedBook?.name === book.name;

                return (
                  <div
                    key={book.name}
                    data-book={book.name}
                    onClick={() => {
                      if (selectedBook?.name !== book.name) setChaptersInput('');
                      setSelectedBook(book);
                    }}
                    className={[
                      "rounded-xl border p-3 cursor-pointer transition-all duration-150",
                      isSelected
                        ? "border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/20 shadow-md"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:-translate-y-0.5",
                      isComplete && !isSelected ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{book.name}</p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{book.category}</p>

                    {isComplete ? (
                      <div className="mt-2.5 flex items-center gap-1">
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                          ✓ Complete
                        </span>
                      </div>
                    ) : (
                      <>
                        <SegmentedProgressBar total={book.num_chapters} readChapters={book.chapters_read_list} />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col gap-4 flex-1">
              {selectedBook ? (
                <>
                  {isMobile && (
                    <button
                      className="self-start text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-1 transition-colors"
                      onClick={() => { setSelectedBook(null); setChaptersInput(''); }}
                    >
                      ← Back
                    </button>
                  )}

                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedBook.name}</h2>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                        {selectedBook.testament}
                      </span>
                      <span className="text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                        {selectedBook.category}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>Progress</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {selectedBook.chapters_read || 0} / {selectedBook.num_chapters} chapters
                      </span>
                    </div>
                    <SegmentedProgressBar total={selectedBook.num_chapters} readChapters={selectedBook.chapters_read_list} />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {calculateProgress(selectedBook)}% complete
                    </p>
                  </div>

                  {selectedBook.chapters_read >= selectedBook.num_chapters ? (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
                      <p className="text-emerald-700 dark:text-emerald-400 font-semibold">All chapters read! ✓</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                          Chapters read
                        </label>
                        <input
                          ref={chaptersInputRef}
                          type="text"
                          placeholder="e.g. 1-5, 7, 10-12"
                          value={chaptersInput}
                          onChange={e => setChaptersInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
                          className={[
                            "w-full px-3 py-2 rounded-lg border outline-none transition dark:bg-slate-700 dark:text-slate-100",
                            inputIsInvalid
                              ? "border-red-300 dark:border-red-700 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/40"
                              : "border-slate-200 dark:border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40",
                          ].join(' ')}
                        />
                        <p className={`text-xs mt-1 min-h-[1rem] ${inputIsInvalid ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {inputIsInvalid
                            ? 'Invalid format — try "1-5" or "3, 7, 12"'
                            : parsedChapters.length > 0
                              ? `Will log: ${parsedChapters.length} chapter${parsedChapters.length !== 1 ? 's' : ''} (${parsedChapters.slice(0, 8).join(', ')}${parsedChapters.length > 8 ? '…' : ''})`
                              : ''}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmit}
                          disabled={parsedChapters.length === 0}
                          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                        >
                          Submit
                        </button>
                        {selectedBook.chapters_read > 0 && (
                          <button
                            onClick={handleUndo}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:bg-slate-700 text-sm transition-colors"
                            title="Undo last entry"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400 dark:text-slate-500 py-12">
                  <p className="text-sm">Select a book to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Help FAB — desktop only */}
      {!isMobile && (
        <button
          onClick={() => setShowHelp(v => !v)}
          title="Keyboard shortcuts (?)"
          className="fixed bottom-5 right-5 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors text-sm font-bold select-none"
        >
          ?
        </button>
      )}

      {/* Help modal — desktop only */}
      {showHelp && !isMobile && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {([
                { keys: ['/'], description: 'Focus search' },
                { keys: ['←', '→', '↑', '↓'], altKeys: ['h', 'l', 'k', 'j'], description: 'Navigate books' },
                { keys: ['g', 'g'], description: 'Go to first book' },
                { keys: ['G'], description: 'Go to last book' },
                { keys: ['Tab'], altKeys: ['i'], description: 'Focus chapter input' },
                { keys: ['Enter'], description: 'Submit progress' },
                { keys: ['u'], description: 'Undo last entry' },
                { keys: ['p'], description: 'Go to Profile' },
                { keys: ['Esc'], description: 'Deselect / clear search' },
                { keys: ['?'], description: 'Show / hide this help' },
              ] as { keys: string[]; altKeys?: string[]; description: string }[]).map(({ keys, altKeys, description }) => (
                <div key={description} className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {keys.map(k => (
                      <kbd
                        key={k}
                        className="inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 text-xs font-mono shadow-[0_1px_0_#cbd5e1] dark:shadow-[0_1px_0_#475569] text-slate-700 dark:text-slate-300 min-w-[1.5rem]"
                      >
                        {k}
                      </kbd>
                    ))}
                    {altKeys && (
                      <>
                        <span className="text-slate-400 dark:text-slate-500 text-xs px-0.5">/</span>
                        {altKeys.map(k => (
                          <kbd
                            key={k}
                            className="inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 text-xs font-mono shadow-[0_1px_0_#cbd5e1] dark:shadow-[0_1px_0_#475569] text-slate-700 dark:text-slate-300 min-w-[1.5rem]"
                          >
                            {k}
                          </kbd>
                        ))}
                      </>
                    )}
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">{description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
