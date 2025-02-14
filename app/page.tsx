import BookProgressTable from "./components/BookProgressTable";
import NavBar from "./components/NavBar/NavBar";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (!session)
    return (
      <div>
        <NavBar />
      </div>
    );

  return (
    <div>
      <NavBar />
      <BookProgressTable />
    </div>
  );
}
