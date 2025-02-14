import { query } from "./db";

export async function createUser(name: string, email: string) {
  return await query(
    "INSERT INTO users (full_name, email) \
    VALUES ($1, $2) \
    ON CONFLICT (full_name, email) DO NOTHING \
    RETURNING *",
    [name, email]
  );
}

export async function getUsers() {
  return await query("SELECT * FROM users");
}

export async function getBooks() {
  return await query("SELECT * FROM bible_books");
}
