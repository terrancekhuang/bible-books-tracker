"use server";
import {
  createReadingCycle,
  updateReadingCycle,
  getUserId,
  getLatestCycle,
} from "@/lib/queries";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function formUpdateReadingCycle(formData: FormData) {
  const session = await auth();
  if (!session) {
    redirect("api/auth/signin")
  }
  const user = session.user;
  const userId = await getUserId(user?.name || "", user?.email || "");
  const latestCycle = await getLatestCycle(user?.email || "");

  const readingCycle = formData.get("readingCycleInput");
  console.log(`Reading cycle: ${readingCycle}`);
  const startDateStr = (formData.get("startDateInput") as string) || null;
  const goalDateStr = (formData.get("goalDateInput") as string) || null;
  console.log(`Start date string: ${startDateStr}`);
  console.log(`Goal date string: ${goalDateStr}`);
  const startDate = startDateStr
    ? new Date(startDateStr + "T00:00:00")
    : new Date();
  const goalDate = goalDateStr
    ? new Date(goalDateStr + "T00:00:00")
    : new Date();
  console.log(`Start date formatted: ${startDate}`);
  console.log(`Goal date formatted: ${goalDate}`);

  if (!latestCycle?.cycle_id) {
    await createReadingCycle(
      userId?.id || 0,
      Number(readingCycle),
      startDate,
      goalDate
    );
    return;
  }

  await updateReadingCycle(
    latestCycle.cycle_id,
    userId?.id || 0,
    Number(readingCycle),
    startDate,
    goalDate
  );

  redirect("/profile");
}
