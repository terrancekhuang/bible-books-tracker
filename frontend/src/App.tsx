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

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInput) {
        e.preventDefault();
        const currentIndex = selectedBook
          ? filteredBooks.findIndex(b => b.name === selectedBook.name)
          : -1;

        if (e.key === 'ArrowDown') {
          if (currentIndex === -1 && filteredBooks.length > 0) {
            setSelectedBook(filteredBooks[0]);
            setChaptersInput('');
          } else if (currentIndex < filteredBooks.length - 1) {
            setSelectedBook(filteredBooks[currentIndex + 1]);
            setChaptersInput('');
          }
        } else {
          if (currentIndex > 0) {
            setSelectedBook(filteredBooks[currentIndex - 1]);
            setChaptersInput('');
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedBook, filteredBooks, chaptersInput]);

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

  const showTable = !isMobile || !selectedBook;
  const showDetail = !isMobile || !!selectedBook;

  return (
    <div className="flex flex-col md:h-screen">
      <div className="flex items-center justify-between px-4 py-3 md:py-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center flex-1">Bible Books Tracker</h1>
        <div className="flex items-center gap-2">
          <Link to="/profile" className="btn btn-ghost btn-sm">Profile</Link>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5 flex-1 md:overflow-hidden px-4 pb-5">
        {showTable && (
          <div className="table-container flex-1 border-2 md:overflow-y-auto">
            <div className="flex items-center gap-2 p-2">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isMobile ? "Search books…" : "Search books… (press /)"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input input-sm flex-1"
              />
              {sortKey !== null && (
                <button className="btn btn-xs btn-ghost" onClick={resetSort}>
                  Reset order
                </button>
              )}
            </div>
            <table className="books-table w-full table-zebra">
              <thead className="font-bold">
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                    Book Name{sortIndicator("name")}
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("chapters_read")}>
                    Chapters Read{sortIndicator("chapters_read")}
                  </th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("percent")}>
                    Percent Read{sortIndicator("percent")}
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    Status{sortIndicator("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => {
                  const isComplete = book.chapters_read >= book.num_chapters;
                  const inProgress = book.chapters_read > 0 && !isComplete;
                  return (
                    <tr
                      key={book.name}
                      data-book={book.name}
                      onClick={() => {
                        if (selectedBook?.name !== book.name) setChaptersInput('');
                        setSelectedBook(book);
                      }}
                      className={[
                        "cursor-pointer",
                        selectedBook?.name === book.name
                          ? "ring-2 ring-inset ring-primary"
                          : "",
                        isComplete && selectedBook?.name !== book.name
                          ? "opacity-40"
                          : "",
                      ].join(" ")}
                    >
                      <td>{book.name}</td>
                      <td>{book.chapters_read || 0} / {book.num_chapters}</td>
                      <td className="hidden md:table-cell">{calculateProgress(book)}%</td>
                      <td>
                        {isComplete && <span className="badge badge-success">Complete</span>}
                        {inProgress && <span className="badge badge-warning">In Progress</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showDetail && (
          <div className="detail-card flex flex-col w-full md:w-96 md:overflow-y-auto">
            {selectedBook ? (
              <>
                {isMobile && (
                  <button
                    className="btn btn-ghost btn-sm self-start mb-2"
                    onClick={() => { setSelectedBook(null); setChaptersInput(''); }}
                  >
                    ← Back
                  </button>
                )}
                <h1 className="text-3xl font-bold text-center">
                  {selectedBook.name}
                </h1>
                <p className="testament">{selectedBook.testament}</p>
                <p>Category: {selectedBook.category}</p>
                <p>Chapters Read: {selectedBook.chapters_read || 0}</p>
                <p>Total Number Chapters: {selectedBook.num_chapters || 0}</p>

                {selectedBook.chapters_read >= selectedBook.num_chapters ? (
                  <div className="alert alert-success mt-4">
                    All chapters read!
                  </div>
                ) : (
                  <>
                    <div className="chapters-today">
                      <label>Chapters Read Today: </label>
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
                        className="input"
                      />
                    </div>

                    <button
                      className="submit-btn btn btn-success"
                      onClick={handleSubmit}
                      disabled={chaptersToday === 0}
                    >
                      Submit
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="placeholder">Select a book to view details.</p>
            )}
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
