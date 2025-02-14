import BookProgressTable from "./components/BookProgressTable";
import NavBar from "./components/NavBar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session) return redirect('/profile');

  return (
    <div>
      <NavBar />
      <BookProgressTable />
    </div>
  );
}
