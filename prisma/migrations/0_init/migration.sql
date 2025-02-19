-- CreateEnum
CREATE TYPE "categories" AS ENUM ('Law', 'History', 'Poetry', 'Major Prophets', 'Minor Prophets', 'Gospels', 'Church History', 'Paul's Epistles', 'General Epistles');

-- CreateEnum
CREATE TYPE "testaments" AS ENUM ('Old Testament', 'New Testament');

-- CreateTable
CREATE TABLE "bible_books" (
    "book_id" SERIAL NOT NULL,
    "book_name" TEXT,
    "testament" "testaments",
    "chapters" INTEGER,
    "category" "categories",

    CONSTRAINT "bible_books_pkey" PRIMARY KEY ("book_id")
);

-- CreateTable
CREATE TABLE "reading_cycles" (
    "cycle_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "reading_cycle" INTEGER,
    "start_date" DATE DEFAULT CURRENT_DATE,
    "goal_date" DATE,

    CONSTRAINT "reading_cycles_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "cycle_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "chapters_read" INTEGER NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("cycle_id","book_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "users_prim_key" PRIMARY KEY ("full_name","email")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_id_key" ON "users"("id");

-- CreateIndex
CREATE UNIQUE INDEX "user_btree_index" ON "users"("full_name", "email");

-- AddForeignKey
ALTER TABLE "reading_cycles" ADD CONSTRAINT "reading_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "bible_books"("book_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "reading_cycles"("cycle_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

