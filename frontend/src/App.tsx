import { useEffect, useState } from 'react'
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
  const [chaptersToday, setChaptersToday] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const handleSubmit = async () => {
    if (!selectedBook) return;

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

      setChaptersToday(1);
    } catch (e) {
      console.error("Error updating progress:", e);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-3xl font-bold text-center flex-1">Bible Books Tracker</h1>
        <div className="flex items-center gap-2">
          <Link to="/profile" className="btn btn-ghost btn-sm">Profile</Link>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      <div className="app flex gap-5 flex-1 overflow-hidden px-5 pb-5">
        <div className="table-container flex-1 border-2 overflow-y-auto">
          {sortKey !== null && (
            <div className="p-2">
              <button className="btn btn-xs btn-ghost" onClick={resetSort}>
                Reset order
              </button>
            </div>
          )}
          <table className="books-table w-full table-zebra">
            <thead className="font-bold">
              <tr>
                <th className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                  Book Name{sortIndicator("name")}
                </th>
                <th className="cursor-pointer select-none" onClick={() => handleSort("chapters_read")}>
                  Chapters Read{sortIndicator("chapters_read")}
                </th>
                <th className="cursor-pointer select-none" onClick={() => handleSort("percent")}>
                  Percent Read{sortIndicator("percent")}
                </th>
                <th className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                  Status{sortIndicator("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedBooks.map((book) => {
                const isComplete = book.chapters_read >= book.num_chapters;
                const inProgress = book.chapters_read > 0 && !isComplete;
                return (
                  <tr
                    key={book.name}
                    onClick={() => setSelectedBook(book)}
                    className={[
                      selectedBook?.name === book.name ? "selected" : "",
                      isComplete ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    <td>{book.name}</td>
                    <td>{book.chapters_read || 0} / {book.num_chapters}</td>
                    <td>{calculateProgress(book)}%</td>
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

        <div className="detail-card flex flex-col w-96 overflow-y-auto">
          {selectedBook ? (
            <>
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
                      type="number"
                      min="1"
                      max={selectedBook.num_chapters - selectedBook.chapters_read}
                      value={chaptersToday}
                      onChange={(e) =>
                        setChaptersToday(parseInt(e.target.value) || 1)
                      }
                      className="input"
                    />
                  </div>

                  <button
                    className="submit-btn btn btn-success"
                    onClick={handleSubmit}
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
