"use client";

import React, { useState } from "react";

interface Book {
  book_id: number;
  book_name: string;
  testament: string;
  chapters: number;
  category: string;
}

const DataTable = ({ books }: { books: Book[] }) => {
  const [selectedBookRow, setSelectedBookRow] = useState(0);

  return (
    <div className="h-screen overflow-y-scroll">
      <table className="table table-pin-rows">
        <thead>
          <tr>
            <th>Book name</th>
            <th>Testament</th>
            <th>Category</th>
            <th>Chapters</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr
              className={`${selectedBookRow === book.book_id && "bg-base-200"}`}
              key={book.book_id}
              onClick={() => setSelectedBookRow(book.book_id)}
            >
              <td>{book.book_name}</td>
              <td>{book.testament}</td>
              <td>{book.category}</td>
              <td>{book.chapters}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
