import React from "react";
import { getBooks } from "../lib/queries";

interface Book {
  book_id: number;
  book_name: string;
  testament: string;
  chapters: number;
  category: string;
}
const books: Book[] = await getBooks();

const BookProgressTable = () => {
  return (
    <div className="overflow-x-auto">
      <table className="table">
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
            <tr className="hover" key={book.book_id}>
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

export default BookProgressTable;
