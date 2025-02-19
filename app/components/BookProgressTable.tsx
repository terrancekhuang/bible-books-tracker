import React from "react";
import DataTable from "./DataTable";
import prisma from "@/lib/db";

export default async function BookProgressTable() {
  const books = await prisma.bible_books.findMany();

  return (
    <div>
      <h1 className="text-xl font-bold ml-4 pt-4">Progress</h1>
      <DataTable books={books} />
    </div>
  );
}
