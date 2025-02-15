import React from "react";
import { getBooks } from "../lib/queries";
import DataTable from "./DataTable";

export default async function BookProgressTable() {
  const books = await getBooks();
  return (
    <div>
      <h1 className="text-xl font-bold ml-4 pt-4">Progress</h1>
      <DataTable books={books} />
    </div>
  );
}
