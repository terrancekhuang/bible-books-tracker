CREATE TABLE IF NOT EXISTS bible_books (
    book_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    testament VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    num_chapters INTEGER
);

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_cycles ( 
    cycle_id SERIAL PRIMARY KEY, 
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    cycle_number INTEGER,
    UNIQUE(user_id, cycle_number)
);

CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    cycle_id INTEGER REFERENCES reading_cycles(cycle_id) ON DELETE CASCADE,
    book_id INTEGER REFERENCES bible_books(book_id) ON DELETE CASCADE,
    chapters_read INTEGER,
    UNIQUE(user_id, cycle_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user_cycle ON progress(user_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_reading_cycles_user ON reading_cycles(user_id);

INSERT INTO bible_books (name, testament, category, num_chapters)
VALUES
    ('Genesis', 'Old Testament', 'Law', 50),
    ('Exodus', 'Old Testament', 'Law', 40),
    ('Leviticus', 'Old Testament', 'Law', 27),
    ('Numbers', 'Old Testament', 'Law', 36),
    ('Deuteronomy', 'Old Testament', 'Law', 34),
    ('Joshua', 'Old Testament', 'History', 24),
    ('Judges', 'Old Testament', 'History', 21),
    ('Ruth', 'Old Testament', 'History', 4),
    ('1 Samuel', 'Old Testament', 'History', 31),
    ('2 Samuel', 'Old Testament', 'History', 24),
    ('1 Kings', 'Old Testament', 'History', 22),
    ('2 Kings', 'Old Testament', 'History', 25),
    ('1 Chronicles', 'Old Testament', 'History', 29),
    ('2 Chronicles', 'Old Testament', 'History', 36),
    ('Ezra', 'Old Testament', 'History', 10),
    ('Nehemiah', 'Old Testament', 'History', 13),
    ('Esther', 'Old Testament', 'History', 10),
    ('Job', 'Old Testament', 'Poetry', 42),
    ('Psalms', 'Old Testament', 'Poetry', 150),
    ('Proverbs', 'Old Testament', 'Poetry', 31),
    ('Ecclesiastes', 'Old Testament', 'Poetry', 12),
    ('Song of Solomon', 'Old Testament', 'Poetry', 8),
    ('Isaiah', 'Old Testament', 'Major Prophets', 66),
    ('Jeremiah', 'Old Testament', 'Major Prophets', 52),
    ('Lamentations', 'Old Testament', 'Major Prophets', 5),
    ('Ezekiel', 'Old Testament', 'Major Prophets', 48),
    ('Daniel', 'Old Testament', 'Major Prophets', 12),
    ('Hosea', 'Old Testament', 'Minor Prophets', 14),
    ('Joel', 'Old Testament', 'Minor Prophets', 3),
    ('Amos', 'Old Testament', 'Minor Prophets', 9),
    ('Obadiah', 'Old Testament', 'Minor Prophets', 1),
    ('Jonah', 'Old Testament', 'Minor Prophets', 4),
    ('Micah', 'Old Testament', 'Minor Prophets', 7),
    ('Nahum', 'Old Testament', 'Minor Prophets', 3),
    ('Habakkuk', 'Old Testament', 'Minor Prophets', 3),
    ('Zephaniah', 'Old Testament', 'Minor Prophets', 3),
    ('Haggai', 'Old Testament', 'Minor Prophets', 2),
    ('Zechariah', 'Old Testament', 'Minor Prophets', 14),
    ('Malachi', 'Old Testament', 'Minor Prophets', 4),
    ('Matthew', 'New Testament', 'Gospels', 28),
    ('Mark', 'New Testament', 'Gospels', 16),
    ('Luke', 'New Testament', 'Gospels', 24),
    ('John', 'New Testament', 'Gospels', 21),
    ('Acts', 'New Testament', 'Church History', 28),
    ('Romans', 'New Testament', 'Paul''s Epistles', 16),
    ('1 Corinthians', 'New Testament', 'Paul''s Epistles', 16),
    ('2 Corinthians', 'New Testament', 'Paul''s Epistles', 13),
    ('Galatians', 'New Testament', 'Paul''s Epistles', 6),
    ('Ephesians', 'New Testament', 'Paul''s Epistles', 6),
    ('Philippians', 'New Testament', 'Paul''s Epistles', 4),
    ('Colossians', 'New Testament', 'Paul''s Epistles', 4),
    ('1 Thessalonians', 'New Testament', 'Paul''s Epistles', 5),
    ('2 Thessalonians', 'New Testament', 'Paul''s Epistles', 3),
    ('1 Timothy', 'New Testament', 'Paul''s Epistles', 6),
    ('2 Timothy', 'New Testament', 'Paul''s Epistles', 4),
    ('Titus', 'New Testament', 'Paul''s Epistles', 3),
    ('Philemon', 'New Testament', 'Paul''s Epistles', 1),
    ('Hebrews', 'New Testament', 'General Epistles', 13),
    ('James', 'New Testament', 'General Epistles', 5),
    ('1 Peter', 'New Testament', 'General Epistles', 5),
    ('2 Peter', 'New Testament', 'General Epistles', 3),
    ('1 John', 'New Testament', 'General Epistles', 5),
    ('2 John', 'New Testament', 'General Epistles', 1),
    ('3 John', 'New Testament', 'General Epistles', 1),
    ('Jude', 'New Testament', 'General Epistles', 1),
    ('Revelation', 'New Testament', 'General Epistles', 22)
ON CONFLICT (name) DO NOTHING;
