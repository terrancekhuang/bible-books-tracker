import { useEffect, useState } from "react";

interface Book {
  id: number;
  name: string;
  testament: string;
  category: string;
  num_chapters: number;
  chapters_read: number;
}

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chaptersToday, setChaptersToday] = useState(0);

  useEffect(() => {
    fetch("http://localhost:5000/api/books")
      .then((res) => res.json())
      .then((rawData) => {
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

  const handleSubmit = () => {
    if (!selectedBook) return;
    setBooks(
      books.map((book) =>
        book.name === selectedBook.name
          ? {
              ...book,
              chapters_read: (book.chapters_read || 0) + chaptersToday,
            }
          : book,
      ),
    );

    setSelectedBook({
      ...selectedBook,
      chapters_read: (selectedBook.chapters_read || 0) + chaptersToday,
    });
  };

  return (
    <>
      <h1 className="text-3xl font-bold text-center">Bible Books Tracker</h1>

      <div className="app flex gap-5 min-h-screen">
        <div className="table-container flex-1 border-2 table table-md table-pin-rows overflow-auto">
          <table className="books-table w-full table-zebra">
            <thead className="font-bold">
              <tr>
                <th>Book Name</th>
                <th>Chapters Read</th>
                <th>Percent Read</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr
                  key={book.name}
                  onClick={() => setSelectedBook(book)}
                  className={selectedBook?.name === book.name ? "selected" : ""}
                >
                  <td>{book.name}</td>
                  <td>
                    {book.chapters_read || 0} / {book.num_chapters}
                  </td>
                  <td>{calculateProgress(book)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="detail-card flex flex-col w-96">
          {selectedBook ? (
            <>
              <h1 className="text-3xl font-bold text-center">
                {selectedBook.name}
              </h1>
              <p className="testament">{selectedBook.testament}</p>
              <p>Category: {selectedBook.category}</p>
              <p>Chapters Read: {selectedBook.chapters_read || 0}</p>

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
              <p>Total Number Chapters: {selectedBook.num_chapters || 0}</p>

              <button
                className="submit-btn btn btn-success"
                onClick={handleSubmit}
              >
                Submit
              </button>
            </>
          ) : (
            <p className="placeholder">Select a book to view details.</p>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
