/**
 * BỘ XỬ LÝ THAO TÁC CẢM ỨNG & CHUỘT trên vùng vẽ.
 * - 1 ngón: vẽ / chọn / kéo đỉnh (tùy công cụ); kéo trên vùng trống = di chuyển.
 * - 2 ngón: chụm phóng to/thu nhỏ + di chuyển.
 * - Chuột: lăn để zoom, giữ nút giữa/phải hoặc phím Space để di chuyển; khi vẽ, đoạn bám theo con trỏ.
 * Cảm ứng vẽ theo kiểu "kéo tương đối": ngón tay kéo ở đâu cũng được, đoạn mới xuất phát từ điểm cuối chuỗi,
 * nên ngón tay không che điểm đang vẽ.
 */
import type { Boundary, Point, Room } from '../model/types';
import { Viewport, RULER } from '../render/viewport';
import { render, type Scene } from '../render/renderer';
import { activeFloor, activeRoom, applyOp, beginGesture, endGesture, liveUpdate, findRoom, store, toast, updateRoom } from '../store/store';
import { appendSegment, moveEdge, setVertex, startChain } from '../model/ops';
import { snapPoint, snapSegment } from './snap';
import { chainEnd, outwardSide, segEnds } from '../geometry/boundary';
import { dist, distToSegment, norm, perpLeft, perpRight, sub } from '../geometry/vec';
import { pointInPolygon, bbox } from '../geometry/polygon';
import { newFixture, newHeight, uid } from '../model/factory';
import { FIXTURES, type FixtureType } from '../model/types';
import { attachToWall, fixturePos } from '../geometry/fixtures';
import { primsBounds, buildRoomPrims, DEFAULT_DRAW } from '../drawing/buildDrawing';

type Mode = 'idle' | 'draw' | 'pan' | 'pinch' | 'vertex' | 'zone' | 'tap' | 'edge' | 'fixture';

interface TapTarget {
  kind: 'segment' | 'vertex' | 'zone' | 'fixture' | 'none';
  fixtureId?: string;
  roomId?: string;
  index?: number;
  zoneId?: string;
}

const HIT_PX = 16;
const TAP_MOVE_PX = 7;

export class CanvasController {
  vp = new Viewport();
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private raf = 0;
  private unsub: () => void;
  private ro: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private mode: Mode = 'idle';
  private downScreen: Point = { x: 0, y: 0 };
  private downWorld: Point = { x: 0, y: 0 };
  private lastScreen: Point = { x: 0, y: 0 };
  private moved = false;
  private pinch: { d: number; c: Point } | null = null;
  private tap: TapTarget = { kind: 'none' };
  private drawFrom: Point | null = null;
  private vertexRoom: string | null = null;
  private vertexIndex = -1;
  /** co kéo cạnh tường */
  private edge: { roomId: string; index: number; base: Boundary; normal: Point; mid: Point; d: number } | null = null;
  private spaceDown = false;
  private fitted = false;
  /** trạng thái tạm hiển thị */
  private scene: Pick<Scene, 'preview' | 'snapMark' | 'guides' | 'zoneRect' | 'hoverSeg'> = { preview: null, snapMark: null, guides: [], zoneRect: null, hoverSeg: null };
  insets = { top: 0, bottom: 0, left: 0, right: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement!);
    let lastSel: unknown = null;
    this.unsub = store.subscribe(() => {
      this.invalidate();
      const sel = store.get().ui.selection;
      if (sel !== lastSel) {
        lastSel = sel;
        // chờ bảng thuộc tính mở xong (vùng vẽ co lại) rồi mới tính
        requestAnimationFrame(() => requestAnimationFrame(() => this.revealSelection()));
      }
    });
    this.resize();
  }

  destroy() {
    this.unsub();
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    cancelAnimationFrame(this.raf);
  }

  private resize() {
    const host = this.canvas.parentElement!;
    const w = host.clientWidth;
    const h = host.clientHeight;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const oldH = this.vp.h;
    this.vp.resize(w, h);
    if (this.fitted && h < oldH) requestAnimationFrame(() => this.revealSelection());
    if (!this.fitted && w > 0 && h > 0) {
      this.fitted = true;
      this.fitAll();
    }
    this.invalidate();
  }

  invalidate = () => {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  };

  private draw() {
    const s = store.get();
    const p = s.project;
    const sc: Scene = {
      floor: activeFloor(s),
      activeRoomId: s.ui.roomId,
      selection: s.ui.selection,
      grid: s.ui.grid,
      minorGrid: s.ui.minorGrid,
      dims: s.ui.dims,
      showOtherRooms: s.ui.showOtherRooms,
      partitionThickness: p?.settings.partitionThickness ?? 100,
      ...this.scene,
    };
    render(this.ctx, this.vp, sc, this.dpr);
  }

  // ------------------------------------------------------------ view commands
  /** Fit All: hiển thị toàn bộ mặt bằng của tầng. Chưa có gì thì hiển thị vùng 6.000 × 8.000 mm. */
  fitAll() {
    const f = activeFloor();
    let bb: ReturnType<typeof primsBounds> = null;
    if (f) {
      const pts: Point[] = [];
      for (const r of f.rooms) {
        const b = primsBounds(buildRoomPrims(r, { ...DEFAULT_DRAW, labels: false }));
        if (b) pts.push({ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY });
        else pts.push(...r.boundary.vertices);
      }
      bb = bbox(pts);
      if (bb && bb.maxX - bb.minX < 1000 && bb.maxY - bb.minY < 1000) bb = { minX: bb.minX - 2000, minY: bb.minY - 2000, maxX: bb.maxX + 2000, maxY: bb.maxY + 2000 };
    }
    this.vp.fit(bb ?? { minX: 0, minY: 0, maxX: 6000, maxY: 8000 }, 24, this.insets);
    this.invalidate();
  }

  fitRoom() {
    const r = activeRoom();
    const b = r ? primsBounds(buildRoomPrims(r, DEFAULT_DRAW)) : null;
    if (b) {
      this.vp.fit(b, 24, this.insets);
      this.invalidate();
    } else this.fitAll();
  }

  zoomBy(f: number) {
    const cx = RULER + (this.vp.w - RULER - this.insets.right) / 2;
    const cy = RULER + (this.vp.h - RULER - this.insets.bottom) / 2;
    this.vp.zoomAt(cx, cy, f);
    this.invalidate();
  }

  /** Đưa điểm (mm) vào giữa màn hình nếu đang nằm ngoài khung nhìn */
  ensureVisible(p: Point) {
    const s = this.vp.toScreen(p);
    const m = 40;
    if (s.x < RULER + m || s.y < RULER + m || s.x > this.vp.w - this.insets.right - m || s.y > this.vp.h - this.insets.bottom - m) {
      const cx = RULER + (this.vp.w - RULER - this.insets.right) / 2;
      const cy = RULER + (this.vp.h - RULER - this.insets.bottom) / 2;
      this.vp.pan(cx - s.x, cy - s.y);
      this.invalidate();
    }
  }

  // ------------------------------------------------------------ helpers
  private local(e: PointerEvent | WheelEvent): Point {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private settings() {
    const s = store.get();
    return { ui: s.ui, step: s.project?.settings.snapStep ?? 10 };
  }

  private snapTargets(room: Room | null): Point[] {
    if (!room) return [];
    const f = activeFloor();
    const pts = [...room.boundary.vertices];
    if (f) for (const r of f.rooms) if (r !== room) pts.push(...r.boundary.vertices);
    return pts;
  }

  private hitTest(sp: Point, tool: string): TapTarget {
    const s = store.get();
    const f = activeFloor(s);
    if (!f) return { kind: 'none' };
    const w = this.vp.toWorld(sp.x, sp.y);
    const tol = HIT_PX / this.vp.scale;
    const act = activeRoom(s);
    if (act && tool === 'select') {
      let bf: string | null = null;
      let bfd = Infinity;
      for (const f of act.fixtures) {
        const d = dist(fixturePos(act, f), w);
        if (d < bfd) {
          bfd = d;
          bf = f.id;
        }
      }
      if (bf && bfd <= tol) return { kind: 'fixture', roomId: act.id, fixtureId: bf };
    }
    if (act && tool === 'select') {
      let best = -1;
      let bd = Infinity;
      act.boundary.vertices.forEach((v, i) => {
        const d = dist(v, w);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best >= 0 && bd <= tol * 0.8) return { kind: 'vertex', roomId: act.id, index: best };
    }
    const rooms = act ? [act, ...f.rooms.filter((r) => r !== act)] : f.rooms;
    for (const r of rooms) {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < r.boundary.segments.length; i++) {
        const [a, b] = segEnds(r.boundary, i);
        const d = distToSegment(w, a, b).d;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      // cho phép chạm vào phần bề dày tường (phía ngoài) cũng chọn được đoạn
      if (best >= 0 && bd <= Math.max(tol, r === act ? Math.min(r.defaultThickness, tol * 2) : tol)) return { kind: 'segment', roomId: r.id, index: best };
    }
    if (act) {
      for (const z of [...act.zones].reverse()) if (z.polygon.length >= 3 && pointInPolygon(w, z.polygon)) return { kind: 'zone', roomId: act.id, zoneId: z.id };
    }
    // chạm vào lòng phòng khác → chuyển phòng
    for (const r of f.rooms) if (r !== act && r.boundary.closed && pointInPolygon(w, r.boundary.vertices)) return { kind: 'none', roomId: r.id };
    return { kind: 'none' };
  }

  private setScene(p: Partial<CanvasController['scene']>) {
    this.scene = { ...this.scene, ...p };
    this.invalidate();
  }

  private clearPreview() {
    this.setScene({ preview: null, snapMark: null, guides: [], zoneRect: null });
  }

  // ------------------------------------------------------------ events
  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      this.spaceDown = e.type === 'keydown';
      this.canvas.style.cursor = this.spaceDown ? 'grab' : '';
      if (e.type === 'keydown') e.preventDefault();
    }
    if (e.type === 'keydown' && e.key === 'Escape') {
      this.mode = 'idle';
      this.drawFrom = null;
      this.clearPreview();
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    if (e.shiftKey) this.vp.pan(-e.deltaY, 0);
    else if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 && Math.abs(e.deltaX) > 2) this.vp.pan(-e.deltaX, -e.deltaY);
    else {
      const k = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0018;
      this.vp.zoomAt(p.x, p.y, Math.exp(-e.deltaY * k));
    }
    this.invalidate();
  };

  private onDown = (e: PointerEvent) => {
    const sp = this.local(e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* con trỏ tổng hợp / đã nhả */
    }
    this.pointers.set(e.pointerId, { ...sp, type: e.pointerType });
    if (this.pointers.size === 2) {
      // chuyển sang chụm 2 ngón, hủy thao tác 1 ngón đang dở
      if (this.mode === 'vertex' || this.mode === 'edge' || this.mode === 'fixture') endGesture(true);
      this.edge = null;
      this.mode = 'pinch';
      this.drawFrom = null;
      this.clearPreview();
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    if (this.pointers.size > 2) return;
    this.downScreen = sp;
    this.lastScreen = sp;
    this.downWorld = this.vp.toWorld(sp.x, sp.y);
    this.moved = false;
    const { ui, step } = this.settings();

    if (e.button === 1 || e.button === 2 || this.spaceDown || ui.tool === 'pan') {
      this.mode = 'pan';
      return;
    }
    const room = activeRoom();
    if (ui.tool === 'draw') {
      if (!room) {
        toast('Hãy tạo hoặc chọn một phòng trước khi vẽ.', 'warn');
        this.mode = 'pan';
        return;
      }
      const b = room.boundary;
      if (b.closed) {
        this.mode = 'tap';
        this.tap = this.hitTest(sp, 'draw');
        return;
      }
      if (!b.vertices.length) {
        const sn = snapPoint(this.downWorld, { snap: ui.snap, step: Math.max(step, 10), tol: HIT_PX / this.vp.scale, targets: this.snapTargets(room) });
        applyOp(room.id, (bd) => startChain(bd, sn.p));
        this.drawFrom = sn.p;
        this.downWorld = sn.p;
      } else this.drawFrom = chainEnd(b)!;
      this.mode = 'draw';
      if (e.pointerType === 'mouse') this.updateDraw(sp, e.pointerType);
      return;
    }
    if (ui.tool === 'fixture') {
      if (!room) return;
      this.placeFixture(this.downWorld);
      this.mode = 'idle';
      return;
    }
    if (ui.tool === 'zone') {
      if (!room) return;
      const sn = snapPoint(this.downWorld, { snap: ui.snap, step: Math.max(step, 10), tol: HIT_PX / this.vp.scale, targets: room.boundary.vertices });
      this.downWorld = sn.p;
      this.mode = 'zone';
      this.setScene({ zoneRect: { a: sn.p, b: sn.p } });
      return;
    }
    // công cụ chọn
    const hit = this.hitTest(sp, 'select');
    this.tap = hit;
    if (hit.kind === 'fixture') {
      this.mode = 'fixture';
      beginGesture();
      store.ui({ selection: { kind: 'fixture', roomId: hit.roomId!, fixtureId: hit.fixtureId! }, panel: 'props' });
      return;
    }
    if (hit.kind === 'vertex') {
      this.mode = 'vertex';
      this.vertexRoom = hit.roomId!;
      this.vertexIndex = hit.index!;
      beginGesture();
      store.ui({ selection: { kind: 'vertex', roomId: hit.roomId!, index: hit.index! }, panel: 'props' });
      return;
    }
    this.mode = 'tap';
  };

  private onMove = (e: PointerEvent) => {
    const sp = this.local(e);
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) {
      // di chuột không nhấn
      if (e.pointerType === 'mouse') this.hover(sp);
      return;
    }
    ptr.x = sp.x;
    ptr.y = sp.y;
    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinch) {
        this.vp.pan(c.x - this.pinch.c.x, c.y - this.pinch.c.y);
        if (this.pinch.d > 10) this.vp.zoomAt(c.x, c.y, d / this.pinch.d);
      }
      this.pinch = { d, c };
      this.invalidate();
      return;
    }
    if (Math.hypot(sp.x - this.downScreen.x, sp.y - this.downScreen.y) > TAP_MOVE_PX) this.moved = true;
    const dx = sp.x - this.lastScreen.x;
    const dy = sp.y - this.lastScreen.y;
    this.lastScreen = sp;
    switch (this.mode) {
      case 'pan':
        this.vp.pan(dx, dy);
        this.invalidate();
        break;
      case 'tap':
        if (this.moved) {
          if (this.tap.kind === 'segment' && store.get().ui.tool === 'select' && this.tap.roomId === store.get().ui.roomId) this.startEdge();
          else this.mode = 'pan';
        }
        if ((this.mode as Mode) === 'edge') this.updateEdge(sp);
        break;
      case 'edge':
        this.updateEdge(sp);
        break;
      case 'fixture':
        if (this.moved) this.dragFixture(sp);
        break;
      case 'draw':
        this.updateDraw(sp, e.pointerType);
        break;
      case 'vertex': {
        if (!this.moved) return;
        const { ui, step } = this.settings();
        const room = findRoom(store.get().project!, this.vertexRoom!);
        if (!room) return;
        const raw = this.vp.toWorld(sp.x, sp.y);
        const others = room.boundary.vertices.filter((_, i) => i !== this.vertexIndex);
        const sn = snapPoint(raw, { snap: ui.snap, step, tol: (HIT_PX * 0.7) / this.vp.scale, targets: others });
        const idx = this.vertexIndex;
        liveUpdate((p) => {
          const r = findRoom(p, this.vertexRoom!);
          if (r) r.boundary = setVertex(r.boundary, idx, sn.p).boundary;
        });
        this.setScene({ snapMark: sn.mark?.type === 'vertex' ? sn.mark : null });
        break;
      }
      case 'zone': {
        const { ui, step } = this.settings();
        const room = activeRoom();
        const sn = snapPoint(this.vp.toWorld(sp.x, sp.y), { snap: ui.snap, step: Math.max(step, 10), tol: HIT_PX / this.vp.scale, targets: room?.boundary.vertices ?? [] });
        this.setScene({ zoneRect: { a: this.downWorld, b: sn.p } });
        break;
      }
    }
  };

  /** Vị trí thiết bị theo điểm chạm: thiết bị tường bám tường gần nhất, thiết bị sàn theo lưới bắt điểm */
  private fixtureTarget(room: Room, w: Point, type: FixtureType) {
    const { ui, step } = this.settings();
    if (FIXTURES[type].mount === 'wall') {
      const at = attachToWall(room, w);
      if (!at) return null;
      const st = ui.snap ? Math.max(step, 10) : 1;
      return { segId: at.segId, offset: Math.round(at.offset / st) * st, pos: at.point };
    }
    const sn = snapPoint(w, { snap: ui.snap, step: Math.max(step, 10), tol: 0, targets: [] });
    return { segId: null, offset: null, pos: sn.p };
  }

  private placeFixture(w: Point) {
    const room = activeRoom();
    if (!room) return;
    const type = store.get().ui.fixtureType;
    const t = this.fixtureTarget(room, w, type);
    if (!t) return toast('Phòng chưa có tường để gắn thiết bị. Vẽ chu vi trước.', 'warn');
    const f = newFixture(type, t.pos, t.segId, t.offset);
    updateRoom(room.id, (r) => void r.fixtures.push(f));
    store.ui({ selection: { kind: 'fixture', roomId: room.id, fixtureId: f.id }, panel: 'props' });
  }

  private dragFixture(sp: Point) {
    const sel = store.get().ui.selection;
    if (sel?.kind !== 'fixture') return;
    const room = findRoom(store.get().project!, sel.roomId);
    const f = room?.fixtures.find((x) => x.id === sel.fixtureId);
    if (!room || !f) return;
    const t = this.fixtureTarget(room, this.vp.toWorld(sp.x, sp.y), f.type);
    if (!t) return;
    liveUpdate((p) => {
      const r = findRoom(p, sel.roomId);
      const ff = r?.fixtures.find((x) => x.id === sel.fixtureId);
      if (!ff) return;
      if (ff.mount === 'wall') {
        ff.segId = t.segId;
        ff.offset = t.offset;
      }
      ff.pos = t.pos;
    });
  }

  /** Điểm đại diện của đối tượng đang chọn (để tự cuộn tránh bảng thuộc tính) */
  private selectionPoint(): Point | null {
    const s = store.get();
    const sel = s.ui.selection;
    if (!sel || !s.project) return null;
    const room = findRoom(s.project, sel.roomId);
    if (!room) return null;
    if (sel.kind === 'segment' && sel.index < room.boundary.segments.length) {
      const [a, c] = segEnds(room.boundary, sel.index);
      return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
    }
    if (sel.kind === 'vertex') return room.boundary.vertices[sel.index] ?? null;
    if (sel.kind === 'fixture') {
      const f = room.fixtures.find((x) => x.id === sel.fixtureId);
      return f ? fixturePos(room, f) : null;
    }
    if (sel.kind === 'zone') {
      const z = room.zones.find((x) => x.id === sel.zoneId);
      if (z && z.polygon.length) return { x: z.polygon.reduce((m, p) => m + p.x, 0) / z.polygon.length, y: z.polygon.reduce((m, p) => m + p.y, 0) / z.polygon.length };
    }
    return null;
  }

  /** Nếu đối tượng đang chọn bị che (gần mép dưới / khuất), dời khung nhìn để thấy rõ */
  revealSelection() {
    if (this.mode !== 'idle') return;
    const p = this.selectionPoint();
    if (!p) return;
    const s = this.vp.toScreen(p);
    const m = 56;
    const bottom = this.vp.h - m;
    const top = RULER + 90; // chừa chỗ cho dòng gợi ý / bảng chọn thiết bị
    let dy = 0;
    let dx = 0;
    // ngoài vùng nhìn thoải mái → đưa về giữa phần màn hình còn trống
    if (s.y > bottom || s.y < top) dy = (top + bottom) / 2 - s.y;
    if (s.x > this.vp.w - m) dx = this.vp.w - m - s.x;
    else if (s.x < RULER + m) dx = RULER + m - s.x;
    if (dx || dy) {
      this.vp.pan(dx, dy);
      this.invalidate();
    }
  }

  private startEdge() {
    const room = activeRoom();
    const i = this.tap.index!;
    if (!room || i >= room.boundary.segments.length) return void (this.mode = 'pan');
    const b = room.boundary;
    const [a, c] = segEnds(b, i);
    const dir = norm(sub(c, a));
    const N = outwardSide(b) === 1 ? perpRight(dir) : perpLeft(dir);
    this.edge = { roomId: room.id, index: i, base: b, normal: N, mid: { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, d: 0 };
    this.mode = 'edge';
    beginGesture();
    store.ui({ selection: { kind: 'segment', roomId: room.id, index: i } });
  }

  private updateEdge(sp: Point) {
    const e = this.edge;
    if (!e) return;
    const { ui, step } = this.settings();
    const w = this.vp.toWorld(sp.x, sp.y);
    let d = (w.x - this.downWorld.x) * e.normal.x + (w.y - this.downWorld.y) * e.normal.y;
    if (ui.snap) d = Math.round(d / Math.max(step, 10)) * Math.max(step, 10);
    if (d === e.d) return;
    try {
      const nb = moveEdge(e.base, e.index, d).boundary;
      e.d = d;
      liveUpdate((p) => {
        const r = findRoom(p, e.roomId);
        if (r) r.boundary = nb;
      });
      const to = { x: e.mid.x + e.normal.x * d, y: e.mid.y + e.normal.y * d };
      this.setScene({ preview: Math.abs(d) > 0 ? { from: e.mid, to, kind: 'wall' } : null });
    } catch {
      /* co quá mức: giữ vị trí trước */
    }
  }

  private finishEdge() {
    const e = this.edge;
    this.edge = null;
    this.setScene({ preview: null });
    if (!e) return;
    if (!e.d) return endGesture(false);
    endGesture(true);
    store.ui({ panel: 'props', selection: { kind: 'segment', roomId: e.roomId, index: e.index } });
    try {
      const msg = moveEdge(e.base, e.index, e.d).message;
      toast(`Đã ${e.d > 0 ? 'nới' : 'thu'} cạnh ${Math.abs(e.d)} mm.${msg ? ' ' + msg : ''}`, 'info', 5000);
    } catch {
      /* bỏ qua */
    }
  }

  private hover(sp: Point) {
    const { ui, step } = this.settings();
    if (ui.tool === 'draw') {
      const room = activeRoom();
      const b = room?.boundary;
      if (b && b.vertices.length && !b.closed) {
        this.drawFrom = chainEnd(b)!;
        this.updateDraw(sp, 'mouse');
      } else if (b && !b.vertices.length) {
        const sn = snapPoint(this.vp.toWorld(sp.x, sp.y), { snap: ui.snap, step: Math.max(step, 10), tol: HIT_PX / this.vp.scale, targets: this.snapTargets(room) });
        this.setScene({ snapMark: sn.mark, preview: null });
      }
      return;
    }
    if (ui.tool === 'select') {
      const h = this.hitTest(sp, 'select');
      const hs = h.kind === 'segment' ? { roomId: h.roomId!, index: h.index! } : null;
      const cur = this.scene.hoverSeg;
      if (hs?.roomId !== cur?.roomId || hs?.index !== cur?.index) this.setScene({ hoverSeg: hs });
      this.canvas.style.cursor = h.kind === 'vertex' ? 'move' : h.kind !== 'none' ? 'pointer' : '';
    }
  }

  private updateDraw(sp: Point, pointerType: string) {
    if (!this.drawFrom) return;
    const { ui, step } = this.settings();
    const room = activeRoom();
    if (!room) return;
    const w = this.vp.toWorld(sp.x, sp.y);
    // chuột: tuyệt đối theo con trỏ; cảm ứng/bút: tương đối theo quãng kéo
    const raw = pointerType === 'mouse' ? sub(w, this.drawFrom) : sub(w, this.downWorld);
    const b = room.boundary;
    const closeTarget = b.vertices.length >= 3 ? b.vertices[0] : null;
    const r = snapSegment({
      from: this.drawFrom,
      raw,
      ortho: ui.ortho,
      snap: ui.snap,
      step,
      tol: (HIT_PX * 0.9) / this.vp.scale,
      targets: this.snapTargets(room).filter((p) => dist(p, this.drawFrom!) > 1),
      closeTarget,
    });
    const kind = ui.workMode === 'detail' ? ui.drawKind : 'wall';
    this.setScene({ preview: { from: this.drawFrom, to: r.to, kind }, snapMark: r.mark, guides: r.guides });
  }

  private onUp = (e: PointerEvent) => {
    const had = this.pointers.has(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!had) return;
    if (this.mode === 'pinch') {
      if (this.pointers.size === 0) this.mode = 'idle';
      else this.mode = 'pan'; // 1 ngón còn lại: di chuyển
      const rest = [...this.pointers.values()][0];
      if (rest) this.lastScreen = { x: rest.x, y: rest.y };
      this.pinch = null;
      return;
    }
    const mode = this.mode;
    this.mode = 'idle';
    if (mode === 'draw') this.finishDraw(e.pointerType);
    else if (mode === 'edge') this.finishEdge();
    else if (mode === 'fixture') endGesture(this.moved);
    else if (mode === 'vertex') {
      endGesture(this.moved);
      this.setScene({ snapMark: null });
    } else if (mode === 'zone') this.finishZone();
    else if (mode === 'tap' && !this.moved) this.finishTap();
  };

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'vertex' || this.mode === 'edge' || this.mode === 'fixture') endGesture(true);
    this.edge = null;
    this.mode = 'idle';
    this.clearPreview();
  };

  private onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !this.pointers.size) this.setScene({ preview: null, snapMark: null, guides: [], hoverSeg: null });
  };

  private finishDraw(pointerType: string) {
    const pv = this.scene.preview;
    const room = activeRoom();
    this.clearPreview();
    if (!room || !pv) return;
    const L = dist(pv.from, pv.to);
    const minLen = Math.max(5, 10 / this.vp.scale);
    if (L < minLen) {
      if (pointerType !== 'mouse' && room.boundary.vertices.length > 1) toast('Kéo ngón tay theo hướng cần vẽ, hoặc nhập số đo ở bảng phía dưới.', 'info', 2500);
      if (pointerType === 'mouse' && room.boundary.segments.length === 0 && room.boundary.vertices.length === 1) toast('Đã đặt điểm đầu. Di chuột và bấm để thêm đoạn, hoặc nhập số đo.', 'info', 3000);
      return;
    }
    const ui = store.get().ui;
    const kind = ui.workMode === 'detail' ? ui.drawKind : 'wall';
    const res = applyOp(room.id, (b) => appendSegment(b, pv.to, kind, 1));
    if (res && kind !== 'wall' && kind !== 'partition') store.ui({ drawKind: 'wall' });
    if (res?.boundary.closed) store.ui({ tool: 'select', selection: null });
  }

  private finishZone() {
    const zr = this.scene.zoneRect;
    this.clearPreview();
    const room = activeRoom();
    if (!zr || !room) return;
    const w = Math.abs(zr.b.x - zr.a.x);
    const h = Math.abs(zr.b.y - zr.a.y);
    if (w < 50 || h < 50) {
      toast('Kéo để tạo vùng trần hình chữ nhật (tối thiểu 50 × 50 mm).', 'info');
      return;
    }
    const x0 = Math.min(zr.a.x, zr.b.x);
    const y0 = Math.min(zr.a.y, zr.b.y);
    const zoneId = uid('z');
    updateRoom(room.id, (r) => {
      let lv = r.heights.find((x) => x.type === 'stepped');
      if (!lv) {
        lv = newHeight('stepped', null, `Giật cấp ${r.heights.filter((x) => x.type === 'stepped').length + 1}`);
        r.heights.push(lv);
      }
      r.zones.push({
        id: zoneId,
        name: `Vùng ${r.zones.length + 1}`,
        levelId: lv.id,
        polygon: [
          { x: x0, y: y0 },
          { x: x0 + w, y: y0 },
          { x: x0 + w, y: y0 + h },
          { x: x0, y: y0 + h },
        ],
      });
      return 'Đã tạo vùng trần. Gán mức cao độ cho vùng trong bảng thuộc tính.';
    });
    store.ui({ selection: { kind: 'zone', roomId: room.id, zoneId }, panel: 'props', tool: 'select' });
  }

  private finishTap() {
    const t = this.tap;
    const s = store.get();
    if (t.kind === 'segment') {
      store.ui({ roomId: t.roomId!, selection: { kind: 'segment', roomId: t.roomId!, index: t.index! }, panel: 'props', tool: s.ui.tool === 'draw' ? 'select' : s.ui.tool });
    } else if (t.kind === 'zone') {
      store.ui({ selection: { kind: 'zone', roomId: t.roomId!, zoneId: t.zoneId! }, panel: 'props' });
    } else if (t.roomId) {
      store.ui({ roomId: t.roomId, selection: null, panel: s.ui.panel === 'props' ? 'none' : s.ui.panel });
      toast('Đã chuyển sang ' + (activeRoom()?.name ?? 'phòng'), 'info', 1500);
    } else {
      if (s.ui.tool === 'draw') toast('Chu vi đã khép kín. Dùng công cụ Chọn để sửa đoạn, hoặc tạo phòng mới.', 'info');
      store.ui({ selection: null, panel: s.ui.panel === 'props' ? 'none' : s.ui.panel });
    }
  }
}
