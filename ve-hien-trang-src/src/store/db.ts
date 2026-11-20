/**
 * LƯU TRỮ CỤC BỘ — IndexedDB (dữ liệu nằm trên thiết bị, không gửi lên máy chủ).
 * Dự phòng localStorage nếu trình duyệt chặn IndexedDB (ví dụ chế độ riêng tư cũ).
 */
import type { Project } from '../model/types';

const DB_NAME = 've-hien-trang';
const STORE = 'projects';
const VERSION = 1;

export interface ProjectMeta {
  id: string;
  name: string;
  address: string;
  updatedAt: number;
  createdAt: number;
  floors: number;
  rooms: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      // dự phòng cho ảnh hiện trạng (giai đoạn sau)
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

const LS_KEY = 'vht:projects';
const lsAll = (): Record<string, Project> => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
};

export async function saveProject(p: Project): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(p));
  } catch {
    const all = lsAll();
    all[p.id] = p;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    return ((await tx('readonly', (s) => s.get(id))) as Project) ?? null;
  } catch {
    return lsAll()[id] ?? null;
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    const all = lsAll();
    delete all[id];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  let all: Project[];
  try {
    all = (await tx('readonly', (s) => s.getAll())) as Project[];
  } catch {
    all = Object.values(lsAll());
  }
  return all
    .map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      floors: p.floors.length,
      rooms: p.floors.reduce((s, f) => s + f.rooms.length, 0),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Yêu cầu trình duyệt giữ dữ liệu bền vững (tránh bị xóa khi thiếu dung lượng) */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* bỏ qua */
  }
}
