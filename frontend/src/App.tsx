function App() {
  return (
    <>
      <h1 className="text-3xl font-bold text-center">Bible Books Tracker</h1>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Book Name</th>
              <th>Testament</th>
              <th>Category</th>
              <th>Chapters</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </>
  );
}

export default App;
