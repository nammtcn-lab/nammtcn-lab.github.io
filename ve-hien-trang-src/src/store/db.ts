/**
 * LƯU TRỮ DỰ ÁN.
 * - Trình duyệt / PWA: IndexedDB trên thiết bị (dự phòng localStorage, cuối cùng là bộ nhớ tạm).
 * - Trong ứng dụng Claude: lưu vào kho dữ liệu riêng của tài khoản (data/users/<id>/…) để không mất khi
 *   đóng ứng dụng và dùng được trên các thiết bị đăng nhập cùng tài khoản; đồng thời giữ bản sao trên thiết bị.
 * Không gửi dữ liệu tới máy chủ nào khác.
 */
import type { Project } from '../model/types';
import { capability, inClaude } from '../platform';

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

export type Backend = 'claude' | 'device' | 'memory';

// ------------------------------------------------------------ IndexedDB / localStorage / bộ nhớ
let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
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
    } catch (e) {
      reject(e);
    }
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
const memory: Record<string, Project> = {};
let localWorks = true;

function lsAll(): Record<string, Project> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return { ...memory };
  }
}
function lsWrite(all: Record<string, Project>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    localWorks = false;
    Object.assign(memory, all);
  }
}

async function localSave(p: Project) {
  memory[p.id] = p;
  try {
    await tx('readwrite', (s) => s.put(p));
  } catch {
    const all = lsAll();
    all[p.id] = p;
    lsWrite(all);
  }
}
async function localLoad(id: string): Promise<Project | null> {
  try {
    const r = (await tx('readonly', (s) => s.get(id))) as Project | undefined;
    if (r) return r;
  } catch {
    /* thử tiếp */
  }
  return lsAll()[id] ?? memory[id] ?? null;
}
async function localDelete(id: string) {
  delete memory[id];
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    const all = lsAll();
    delete all[id];
    lsWrite(all);
  }
}
async function localList(): Promise<Project[]> {
  let all: Project[] = [];
  try {
    all = (await tx('readonly', (s) => s.getAll())) as Project[];
  } catch {
    all = Object.values(lsAll());
  }
  const ids = new Set(all.map((p) => p.id));
  for (const p of Object.values(memory)) if (!ids.has(p.id)) all.push(p);
  return all;
}

// ------------------------------------------------------------ kho dữ liệu tài khoản Claude
interface ClaudeStore {
  col: any; // CollectionReference data/users/<id>
}
let claudeStore: Promise<ClaudeStore | null> | null = null;
function getClaude(): Promise<ClaudeStore | null> {
  if (!inClaude()) return Promise.resolve(null);
  if (!claudeStore) {
    claudeStore = (async () => {
      const [db, user] = await Promise.all([capability<any>('db'), capability<any>('user')]);
      if (!db || !user) return null;
      const id = await user.id();
      if (!id) return null;
      return { col: db.collection('data/users/' + id) };
    })().catch(() => null);
  }
  return claudeStore;
}

/** Ghi tuần tự từng tài liệu (mỗi lúc một lệnh ghi) */
const chains = new Map<string, Promise<unknown>>();
function serial(id: string, fn: () => Promise<unknown>) {
  const prev = chains.get(id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  chains.set(id, next);
  return next;
}

const meta = (p: Project): ProjectMeta => ({
  id: p.id,
  name: p.name,
  address: p.address,
  updatedAt: p.updatedAt,
  createdAt: p.createdAt,
  floors: p.floors.length,
  rooms: p.floors.reduce((s, f) => s + f.rooms.length, 0),
});

// ------------------------------------------------------------ API
export async function storageBackend(): Promise<Backend> {
  if (await getClaude()) return 'claude';
  try {
    await openDb();
    return 'device';
  } catch {
    return localWorks ? 'device' : 'memory';
  }
}

export async function saveProject(p: Project): Promise<void> {
  await localSave(p);
  const c = await getClaude();
  if (!c) return;
  const body = { ...meta(p), json: JSON.stringify(p) };
  await serial(p.id, async () => {
    try {
      await c.col.doc(p.id).set(body);
    } catch (e: any) {
      if (e?.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        await c.col.doc(p.id).set(body);
      } else throw new Error(e?.code === 'invalid_argument' ? 'Dự án quá lớn để đồng bộ vào tài khoản (đã lưu trên thiết bị).' : e?.message || 'Lỗi lưu');
    }
  });
}

export async function loadProject(id: string): Promise<Project | null> {
  const local = await localLoad(id);
  const c = await getClaude();
  if (!c) return local;
  try {
    const snap = await c.col.doc(id).get();
    if (snap.exists) {
      const remote = JSON.parse(snap.data().json) as Project;
      if (!local || remote.updatedAt >= local.updatedAt) return remote;
    }
  } catch {
    /* dùng bản trên thiết bị */
  }
  return local;
}

export async function deleteProject(id: string): Promise<void> {
  await localDelete(id);
  const c = await getClaude();
  if (c) await serial(id, () => c.col.doc(id).delete());
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const byId = new Map<string, ProjectMeta>();
  for (const p of await localList()) byId.set(p.id, meta(p));
  const c = await getClaude();
  if (c) {
    try {
      const snap = await c.col.get();
      for (const d of snap.docs) {
        const m = d.data() as ProjectMeta;
        const cur = byId.get(d.id);
        if (!cur || m.updatedAt >= cur.updatedAt) byId.set(d.id, { id: d.id, name: m.name, address: m.address ?? '', updatedAt: m.updatedAt, createdAt: m.createdAt, floors: m.floors, rooms: m.rooms });
      }
    } catch {
      /* chỉ danh sách trên thiết bị */
    }
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Yêu cầu trình duyệt giữ dữ liệu bền vững (tránh bị xóa khi thiếu dung lượng) */
export async function requestPersistence() {
  try {
    if (!inClaude() && navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* bỏ qua */
  }
}
