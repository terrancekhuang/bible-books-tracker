import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import Login from './Login'
import Profile from './Profile'

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

const TOKEN_KEY = 'app_jwt'

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[] | { value: string; label: string }[];
}) {
  const active = value !== '';
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={[
        "text-xs px-2 py-1.5 rounded-lg border cursor-pointer outline-none transition-colors",
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
      ].join(" ")}
    >
      <option value="">{placeholder}</option>
      {options.map(o =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

function SegmentedProgressBar({ total, readChapters }: { total: number; readChapters: number[] }) {
  const readSet = new Set(readChapters);
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ chapter: number; x: number; y: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const chapter = Math.max(1, Math.min(total, Math.ceil(((e.clientX - rect.left) / rect.width) * total)));
    setTooltip({ chapter, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="mt-2.5">
      <div
        ref={barRef}
        className="flex h-1.5 rounded-full overflow-hidden gap-px cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`flex-1 ${readSet.has(i + 1) ? 'bg-indigo-500' : 'bg-slate-100'}`} />
        ))}
      </div>
      {tooltip && (
        <div
          className="fixed bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-50"
          style={{ left: tooltip.x, top: tooltip.y - 28, transform: 'translateX(-50%)' }}
        >
          Ch. {tooltip.chapter} {readSet.has(tooltip.chapter) ? '· ✓' : ''}
        </div>
      )}
    </div>
  );
}

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

function Tracker({ onLogout }: { onLogout: () => void }) {
  const [books, setBooks] = useState<Book[]>([]);
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

  const chaptersInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    fetch("/api/books", { headers: authHeaders() })
      .then((res) => {
        if (res.status === 401) { onLogout(); return null }
        return res.json()
      })
      .then((rawData) => {
        if (!rawData) return
        const transformedBooks = rawData.map((item: any) => ({
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

      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !isInput) {
        e.preventDefault();
        const currentIndex = selectedBook
          ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name)
          : -1;
        if (e.key === 'ArrowRight') {
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

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInput) {
        e.preventDefault();
        const numCols = window.innerWidth < 640 ? 2 : 3;
        const currentIndex = selectedBook
          ? tabFilteredBooks.findIndex(b => b.name === selectedBook.name)
          : -1;
        if (e.key === 'ArrowDown') {
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

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          book_name: selectedBook.name,
          chapters: parsedChapters,
        }),
      });

      const data = await response.json();

      if (response.status === 401) { onLogout(); return; }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update progress");
      }

      setBooks(books.map(b => b.name === selectedBook.name ? { ...b, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list } : b));
      setSelectedBook({ ...selectedBook, chapters_read: data.chapters_read, chapters_read_list: data.chapters_read_list });
      setChaptersInput('');
    } catch (e) {
      console.error("Error updating progress:", e);
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
    <div className="flex flex-col min-h-screen md:h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <h1 className="text-xl md:text-2xl font-bold text-indigo-700 tracking-tight">
            Bible Books Tracker
          </h1>
          <div className="flex items-center gap-3">
            <Link to="/profile" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
              Profile
            </Link>
            <button
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              onClick={onLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 flex-1 md:overflow-hidden px-4 md:px-5 py-4">
        {/* Book Grid Panel */}
        {showGrid && (
          <div className="flex flex-col flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden md:overflow-y-auto">
            {/* Search + Sort controls */}
            <div className="flex items-center gap-2 p-3 border-b border-slate-100">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isMobile ? "Search books…" : "Search books… (press /)"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
              {sortKey !== null && (
                <button
                  className="text-xs text-slate-500 hover:text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50 transition-colors whitespace-nowrap"
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
                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
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
                          ? "text-indigo-600 bg-indigo-50 font-medium"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50",
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
                const inProgress = book.chapters_read > 0 && !isComplete;
                const progress = calculateProgress(book);
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
                        ? "border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50 shadow-md"
                        : "border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5",
                      isComplete && !isSelected ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{book.name}</p>
                    <p className="text-xs text-indigo-500 mt-0.5">{book.category}</p>

                    {isComplete ? (
                      <div className="mt-2.5 flex items-center gap-1">
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ✓ Complete
                        </span>
                      </div>
                    ) : (
                      <>
                        <SegmentedProgressBar total={book.num_chapters} readChapters={book.chapters_read_list} />
                        <p className="text-xs text-slate-400 mt-1">
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4 flex-1">
              {selectedBook ? (
                <>
                  {isMobile && (
                    <button
                      className="self-start text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-1 transition-colors"
                      onClick={() => { setSelectedBook(null); setChaptersInput(''); }}
                    >
                      ← Back
                    </button>
                  )}

                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedBook.name}</h2>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                        {selectedBook.testament}
                      </span>
                      <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        {selectedBook.category}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm text-slate-500 mb-1.5">
                      <span>Progress</span>
                      <span className="font-medium text-slate-700">
                        {selectedBook.chapters_read || 0} / {selectedBook.num_chapters} chapters
                      </span>
                    </div>
                    <SegmentedProgressBar total={selectedBook.num_chapters} readChapters={selectedBook.chapters_read_list} />
                    <p className="text-xs text-slate-400 mt-1">
                      {calculateProgress(selectedBook)}% complete
                    </p>
                  </div>

                  {selectedBook.chapters_read >= selectedBook.num_chapters ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                      <p className="text-emerald-700 font-semibold">All chapters read! ✓</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-sm font-medium text-slate-600 block mb-1.5">
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
                            "w-full px-3 py-2 rounded-lg border outline-none transition",
                            inputIsInvalid
                              ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                              : "border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                          ].join(' ')}
                        />
                        <p className={`text-xs mt-1 min-h-[1rem] ${inputIsInvalid ? 'text-red-400' : 'text-slate-400'}`}>
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
                            className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 text-sm transition-colors"
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
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400 py-12">
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
          className="fixed bottom-5 right-5 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors text-sm font-bold select-none"
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
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {([
                { keys: ['/'], description: 'Focus search' },
                { keys: ['Esc'], description: 'Deselect book / clear search' },
                { keys: ['←', '→'], description: 'Navigate books left / right' },
                { keys: ['↑', '↓'], description: 'Navigate books up / down' },
                { keys: ['Tab'], description: 'Focus chapter input' },
                { keys: ['Enter'], description: 'Submit chapter progress' },
                { keys: ['?'], description: 'Show / hide this help' },
              ] as { keys: string[]; description: string }[]).map(({ keys, description }) => (
                <div key={description} className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {keys.map(k => (
                      <kbd
                        key={k}
                        className="inline-flex items-center justify-center rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs font-mono shadow-[0_1px_0_#cbd5e1] text-slate-700 min-w-[1.5rem]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span className="text-sm text-slate-600">{description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [jwt, setJwt] = useState<string | null>(getToken)
  const navigate = useNavigate()

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    setJwt(token)
    navigate('/')
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setJwt(null)
    navigate('/login')
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={jwt ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
      />
      <Route
        path="/"
        element={jwt ? <Tracker onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/profile"
        element={jwt ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}
