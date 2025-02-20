import { auth } from "@/auth";
import BookProgressTable from "./components/BookProgressTable";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session) {
    redirect("api/auth/signin");
  }

  return (
    <>
      <div className="flex h-screen">
        <div className="w-1/2">
          <BookProgressTable />
        </div>

        <div className="w-1/2">
          <p>Well Hello There</p>
        </div>
      </div>
    </>
  );
}
