/**
 * QUẢN LÝ TRẠNG THÁI DỰ ÁN + LỊCH SỬ HOÀN TÁC / LÀM LẠI + TỰ ĐỘNG LƯU.
 * Mỗi thao tác chỉnh sửa tạo một bản chụp (snapshot) dự án — đơn giản, chắc chắn, không lệch dữ liệu.
 */
import { useSyncExternalStore } from 'react';
import type { Boundary, Floor, Project, Room, SegmentKind } from '../model/types';
import { saveProject } from './db';
import { OpError, type OpResult } from '../model/ops';

export type Tool = 'select' | 'draw' | 'zone' | 'pan';
export type WorkMode = 'quick' | 'detail';
export type Panel = 'none' | 'props' | 'room' | 'rooms' | 'export' | 'settings' | 'project' | 'draw' | 'library';

export type Selection =
  | { kind: 'segment'; roomId: string; index: number }
  | { kind: 'vertex'; roomId: string; index: number }
  | { kind: 'zone'; roomId: string; zoneId: string }
  | null;

export interface Toast {
  id: number;
  msg: string;
  type: 'info' | 'warn' | 'error' | 'ok';
}

export interface UIState {
  screen: 'projects' | 'editor';
  floorId: string | null;
  roomId: string | null;
  tool: Tool;
  workMode: WorkMode;
  /** Loại đoạn sẽ vẽ tiếp theo (chế độ đo chi tiết) */
  drawKind: SegmentKind;
  selection: Selection;
  grid: boolean;
  minorGrid: boolean;
  ortho: boolean;
  snap: boolean;
  dims: boolean;
  panel: Panel;
  toast: Toast | null;
  saveState: 'saved' | 'dirty' | 'saving' | 'error';
  /** Hiển thị các phòng khác trong tầng (mờ) */
  showOtherRooms: boolean;
}

export interface State {
  project: Project | null;
  ui: UIState;
  past: Project[];
  future: Project[];
}

const HISTORY_LIMIT = 150;

const initialUI: UIState = {
  screen: 'projects',
  floorId: null,
  roomId: null,
  tool: 'draw',
  workMode: 'quick',
  drawKind: 'wall',
  selection: null,
  grid: true,
  minorGrid: true,
  ortho: true,
  snap: true,
  dims: true,
  panel: 'none',
  toast: null,
  saveState: 'saved',
  showOtherRooms: true,
};

let state: State = { project: null, ui: loadUiPrefs(initialUI), past: [], future: [] };
const listeners = new Set<() => void>();

function loadUiPrefs(ui: UIState): UIState {
  try {
    const p = JSON.parse(localStorage.getItem('vht:ui') || '{}');
    const keep: (keyof UIState)[] = ['grid', 'minorGrid', 'ortho', 'snap', 'dims', 'workMode', 'showOtherRooms'];
    const out = { ...ui };
    for (const k of keep) if (k in p) (out as any)[k] = p[k];
    return out;
  } catch {
    return ui;
  }
}

function saveUiPrefs() {
  const u = state.ui;
  try {
    localStorage.setItem('vht:ui', JSON.stringify({ grid: u.grid, minorGrid: u.minorGrid, ortho: u.ortho, snap: u.snap, dims: u.dims, workMode: u.workMode, showOtherRooms: u.showOtherRooms }));
  } catch {
    /* bỏ qua */
  }
}

function emit() {
  for (const l of listeners) l();
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(next: Partial<State>) {
    state = { ...state, ...next };
    emit();
  },
  ui(patch: Partial<UIState>) {
    state = { ...state, ui: { ...state.ui, ...patch } };
    saveUiPrefs();
    emit();
  },
};

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state));
}

// ------------------------------------------------------------------ toast
let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, type: Toast['type'] = 'info', ms = 3500) {
  const t = { id: ++toastId, msg, type };
  store.ui({ toast: t });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (state.ui.toast?.id === t.id) store.ui({ toast: null });
  }, ms);
}

// ------------------------------------------------------------------ project & history
export function openProject(p: Project) {
  const floor = p.floors[0] ?? null;
  state = {
    project: p,
    past: [],
    future: [],
    ui: {
      ...state.ui,
      screen: 'editor',
      floorId: floor?.id ?? null,
      roomId: floor?.rooms[0]?.id ?? null,
      selection: null,
      panel: floor?.rooms[0]?.boundary.segments.length ? 'none' : 'draw',
      saveState: 'saved',
      tool: floor?.rooms[0]?.boundary.segments.length ? 'select' : 'draw',
    },
  };
  emit();
}

export function closeProject() {
  flushSave();
  state = { ...state, project: null, past: [], future: [], ui: { ...state.ui, screen: 'projects', selection: null, panel: 'none' } };
  emit();
}

/**
 * Thực hiện một thao tác chỉnh sửa có ghi lịch sử.
 * fn sửa trực tiếp trên bản sao dự án; trả về chuỗi để hiện thông báo.
 */
export function commit(fn: (p: Project) => string | void, opts: { silent?: boolean } = {}): boolean {
  const cur = state.project;
  if (!cur) return false;
  const draft = structuredClone(cur);
  let msg: string | void;
  try {
    msg = fn(draft);
  } catch (e) {
    if (e instanceof OpError) {
      toast(e.message, 'warn');
      return false;
    }
    console.error(e);
    toast('Lỗi: ' + (e as Error).message, 'error');
    return false;
  }
  draft.updatedAt = Date.now();
  const past = [...state.past, cur].slice(-HISTORY_LIMIT);
  state = { ...state, project: draft, past, future: [], ui: { ...state.ui, saveState: 'dirty' } };
  emit();
  scheduleSave();
  if (msg && !opts.silent) toast(msg, 'info', 5000);
  return true;
}

/** Cập nhật tạm thời không ghi lịch sử (khi đang kéo); gọi endGesture để ghi một bước lịch sử */
let gestureBase: Project | null = null;
export function beginGesture() {
  gestureBase = state.project;
}
export function liveUpdate(fn: (p: Project) => void) {
  if (!state.project) return;
  const draft = structuredClone(state.project);
  try {
    fn(draft);
  } catch (e) {
    if (!(e instanceof OpError)) console.error(e);
    return;
  }
  state = { ...state, project: draft };
  emit();
}
export function endGesture(changed = true) {
  if (gestureBase && changed && gestureBase !== state.project) {
    state.project!.updatedAt = Date.now();
    state = { ...state, past: [...state.past, gestureBase].slice(-HISTORY_LIMIT), future: [], ui: { ...state.ui, saveState: 'dirty' } };
    emit();
    scheduleSave();
  } else if (gestureBase && !changed) {
    state = { ...state, project: gestureBase };
    emit();
  }
  gestureBase = null;
}

export function undo() {
  const { past, project, future } = state;
  if (!past.length || !project) return;
  const prev = past[past.length - 1];
  state = { ...state, project: prev, past: past.slice(0, -1), future: [project, ...future], ui: { ...fixSelection(prev), saveState: 'dirty' } };
  emit();
  scheduleSave();
}

export function redo() {
  const { past, project, future } = state;
  if (!future.length || !project) return;
  const next = future[0];
  state = { ...state, project: next, past: [...past, project], future: future.slice(1), ui: { ...fixSelection(next), saveState: 'dirty' } };
  emit();
  scheduleSave();
}

function fixSelection(p: Project): UIState {
  const ui = { ...state.ui };
  const floor = p.floors.find((f) => f.id === ui.floorId) ?? p.floors[0];
  ui.floorId = floor?.id ?? null;
  if (!floor?.rooms.some((r) => r.id === ui.roomId)) ui.roomId = floor?.rooms[0]?.id ?? null;
  const sel = ui.selection;
  if (sel) {
    const room = floor?.rooms.find((r) => r.id === sel.roomId);
    if (!room) ui.selection = null;
    else if (sel.kind === 'segment' && sel.index >= room.boundary.segments.length) ui.selection = null;
    else if (sel.kind === 'vertex' && sel.index >= room.boundary.vertices.length) ui.selection = null;
    else if (sel.kind === 'zone' && !room.zones.some((z) => z.id === sel.zoneId)) ui.selection = null;
  }
  return ui;
}

// ------------------------------------------------------------------ autosave
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 700);
}

export async function flushSave(): Promise<void> {
  clearTimeout(saveTimer);
  const p = state.project;
  if (!p) return;
  store.ui({ saveState: 'saving' });
  try {
    await saveProject(p);
    if (state.project === p) store.ui({ saveState: 'saved' });
    else store.ui({ saveState: 'dirty' });
  } catch (e) {
    console.error(e);
    store.ui({ saveState: 'error' });
    toast((e as Error).message || 'Không lưu được dữ liệu!', 'error', 6000);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flushSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave();
  });
}

// ------------------------------------------------------------------ selectors & helpers
export function activeFloor(s: State = state): Floor | null {
  const p = s.project;
  if (!p) return null;
  return p.floors.find((f) => f.id === s.ui.floorId) ?? p.floors[0] ?? null;
}

export function activeRoom(s: State = state): Room | null {
  const f = activeFloor(s);
  return f?.rooms.find((r) => r.id === s.ui.roomId) ?? null;
}

export function findRoom(p: Project, roomId: string): Room | null {
  for (const f of p.floors) for (const r of f.rooms) if (r.id === roomId) return r;
  return null;
}

/** Áp dụng một thao tác hình học lên phòng đang chọn (ghi lịch sử, báo thông điệp) */
export function applyOp(roomId: string, op: (b: Boundary) => OpResult): OpResult | null {
  let result: OpResult | null = null;
  const ok = commit((p) => {
    const r = findRoom(p, roomId);
    if (!r) throw new OpError('Không tìm thấy phòng.');
    result = op(r.boundary);
    r.boundary = result.boundary;
    return result.message;
  });
  return ok ? result : null;
}

export function updateRoom(roomId: string, fn: (r: Room) => string | void) {
  return commit((p) => {
    const r = findRoom(p, roomId);
    if (!r) throw new OpError('Không tìm thấy phòng.');
    return fn(r);
  });
}
