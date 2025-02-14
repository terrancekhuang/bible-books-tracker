import BookProgressTable from "./components/BookProgressTable";
import NavBar from "./components/NavBar";

export default function Home() {
  return (
    <div>
      <NavBar />
      <h1><strong>Bible Books Progress</strong></h1>
      <BookProgressTable />
    </div>
  );
}
