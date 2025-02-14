import { query } from "./db";

export async function createUser(name: string, email: string) {
  return await query("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *", [name, email])
}

export async function getBooks() {
  return await query("SELECT * FROM bible_books")
}
