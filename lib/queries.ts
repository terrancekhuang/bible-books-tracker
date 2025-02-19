import prisma from "@/lib/db";

// Create
export async function createUser(name: string, email: string) {
  return await prisma.users.upsert({
    where: {
      full_name_email: {
        full_name: name,
        email: email,
      },
    },
    update: {},
    create: {
      full_name: name,
      email: email,
    },
  });
}

export async function createReadingCycle(user_id: number, readingCycle: number, startDate: Date, goalDate: Date) {
  return await prisma.reading_cycles.create({
    data: {
      user_id,
      reading_cycle: readingCycle,
      start_date: startDate,
      goal_date: goalDate,
    },
  });
}

// Read
export async function getUsers() {
  return await prisma.users.findMany();
}

export async function getUserId(name: string, email: string) {
  return await prisma.users.findFirst({
    where: { full_name: name, email },
    select: { id: true },
  });
}

export async function getLatestCycle(email: string) {
  const user = await prisma.users.findFirst({
    where: { email },
    select: { id: true },
  });

  if (!user) return null;

  return await prisma.reading_cycles.findFirst({
    where: { user_id: user.id },
    orderBy: { cycle_id: "desc" },
    take: 1,
  });
}

export async function getBooks() {
  return await prisma.bible_books.findMany();
}

// Update
export async function updateReadingCycle(cycle_id: number, user_id: number, readingCycle: number, startDate: Date, goalDate: Date) {
  return await prisma.reading_cycles.upsert({
    where: { cycle_id },
    update: {
      user_id,
      reading_cycle: readingCycle,
      start_date: startDate,
      goal_date: goalDate,
    },
    create: {
      user_id,
      reading_cycle: readingCycle,
      start_date: startDate,
      goal_date: goalDate,
    },
  });
}