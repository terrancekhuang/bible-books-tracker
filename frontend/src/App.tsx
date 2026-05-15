import { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import Login from './Login'
import Profile from './Profile'

interface Book {
  id: number;
  name: string;
  testament: string;
  category: string;
  num_chapters: number;
  chapters_read: number;
}

type SortKey = "name" | "chapters_read" | "percent" | "status";
type SortDir = "asc" | "desc";
type TabFilter = "all" | "old" | "new";

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

function Tracker({ onLogout }: { onLogout: () => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chaptersInput, setChaptersInput] = useState('');
  const chaptersToday = parseInt(chaptersInput) || 0;
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

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
        const transformedBooks = rawData.map((item: Book) => ({
          book_id: item.id,
          name: item.name,
          testament: item.testament,
          category: item.category,
          num_chapters: item.num_chapters,
          chapters_read: item.chapters_read,
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

  const tabFilteredBooks = filteredBooks.filter(b => {
    if (activeTab === "all") return true;
    if (activeTab === "old") return b.testament === "Old Testament";
    return b.testament === "New Testament";
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

      if (e.key === 'Escape') {
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

      if ((e.key === '+' || e.key === '=') && !isInput && selectedBook) {
        e.preventDefault();
        const max = selectedBook.num_chapters - selectedBook.chapters_read;
        setChaptersInput(v => String(Math.min((parseInt(v) || 0) + 1, max)));
        return;
      }

      if (e.key === '-' && !isInput && selectedBook) {
        e.preventDefault();
        setChaptersInput(v => String(Math.max((parseInt(v) || 0) - 1, 0)));
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
  }, [selectedBook, tabFilteredBooks, chaptersInput]);

  const handleSubmit = async () => {
    if (!selectedBook || chaptersToday === 0) return;

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          book_name: selectedBook.name,
          chapters_today: chaptersToday,
        }),
      });

      const data = await response.json();

      if (response.status === 401) { onLogout(); return; }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update progress");
      }

      setBooks(
        books.map((book) =>
          book.name === selectedBook.name
            ? { ...book, chapters_read: data.chapters_read }
            : book,
        ),
      );

      setSelectedBook({
        ...selectedBook,
        chapters_read: data.chapters_read,
      });

      setChaptersInput('1');
    } catch (e) {
      console.error("Error updating progress:", e);
    }
  };

  const showGrid = !isMobile || !selectedBook;
  const showDetail = !isMobile || !!selectedBook;

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "old", label: "Old Testament" },
    { key: "new", label: "New Testament" },
  ];

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

            {/* Testament tabs */}
            <div className="flex items-center gap-1 px-3 pt-2 pb-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    "text-xs font-medium px-3 py-1.5 rounded-full transition-all",
                    activeTab === tab.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
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
                        <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={[
                              "h-full rounded-full transition-all",
                              inProgress ? "bg-indigo-500" : "bg-slate-200",
                            ].join(" ")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
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
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${calculateProgress(selectedBook)}%` }}
                      />
                    </div>
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
                          Chapters read today
                        </label>
                        <input
                          ref={chaptersInputRef}
                          type="number"
                          min="0"
                          max={selectedBook.num_chapters - selectedBook.chapters_read}
                          value={chaptersInput}
                          onChange={(e) => setChaptersInput(e.target.value)}
                          onKeyDown={(e) => {
                            const max = selectedBook.num_chapters - selectedBook.chapters_read;
                            if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
                            if (e.key === '+' || e.key === '=') { e.preventDefault(); setChaptersInput(v => String(Math.min((parseInt(v) || 0) + 1, max))); }
                            if (e.key === '-') { e.preventDefault(); setChaptersInput(v => String(Math.max((parseInt(v) || 0) - 1, 0))); }
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 transition"
                        />
                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={chaptersToday === 0}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                      >
                        Submit
                      </button>
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
