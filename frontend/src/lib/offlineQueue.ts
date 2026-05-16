const DB_NAME = 'bible-tracker-offline';
const STORE = 'pending-writes';

interface PendingWrite {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueWrite(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ url, method, headers, body });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return count;
}

export async function flushQueue(onLogout: () => void): Promise<void> {
  const db = await openDB();
  const items = await new Promise<PendingWrite[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingWrite[]);
    req.onerror = () => reject(req.error);
  });
  db.close();

  for (const item of items) {
    let response: Response;
    try {
      response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
    } catch {
      break; // still offline
    }

    if (response.status === 401) {
      onLogout();
      return;
    }

    if (response.ok) {
      const db2 = await openDB();
      await new Promise<void>((resolve) => {
        const tx = db2.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(item.id!);
        tx.oncomplete = () => resolve();
      });
      db2.close();
    }
  }
}
