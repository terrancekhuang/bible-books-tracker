import { useEffect, useState } from "react";

interface Book {
  name: string;
  testament: string;
  category: string;
  num_chapters: number;
}

function App() {
  const [books, set_books] = useState<Book[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/books")
      .then((res) => res.json())
      .then((data) => set_books(data))
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  return (
    <>
      <h1 className="text-3xl font-bold text-center">Bible Books Tracker</h1>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Book Name</th>
              <th>Testament</th>
              <th>Category</th>
              <th>Chapters</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book, index) => (
              <tr key={index}>
                <td>{book.name}</td>
                <td>{book.testament}</td>
                <td>{book.category}</td>
                <td>{book.num_chapters}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default App;
