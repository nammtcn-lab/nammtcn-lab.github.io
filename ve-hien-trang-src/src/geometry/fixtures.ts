/** Hình học thiết bị: vị trí tim, bám tường, khoảng cách tới góc / tới tường */
import type { Fixture, Point, Room } from '../model/types';
import { edges, isSolidKind, outwardSide, segEnds, segLength } from './boundary';
import { add, dist, distToSegment, mul, norm, perpLeft, perpRight, sub } from './vec';

export function segIndexById(room: Room, id: string | null): number {
  return id ? room.boundary.segments.findIndex((s) => s.id === id) : -1;
}

/** Vị trí tim trên mặt bằng; thiết bị gắn tường đi theo tường khi tường bị co kéo */
export function fixturePos(room: Room, f: Fixture): Point {
  if (f.mount === 'wall') {
    const i = segIndexById(room, f.segId);
    if (i >= 0) {
      const [a, c] = segEnds(room.boundary, i);
      const L = dist(a, c);
      const o = Math.max(0, Math.min(L, f.offset ?? L / 2));
      return add(a, mul(norm(sub(c, a)), o));
    }
  }
  return f.pos;
}

/** Pháp tuyến hướng vào trong phòng của đoạn i */
export function inwardNormal(room: Room, i: number): Point {
  const [a, c] = segEnds(room.boundary, i);
  const d = norm(sub(c, a));
  return outwardSide(room.boundary) === 1 ? perpLeft(d) : perpRight(d);
}

/** Tìm đoạn tường gần điểm p nhất để gắn thiết bị (chỉ tường / vách, không gắn lên ô cửa) */
export function attachToWall(room: Room, p: Point, allowOpenings = false): { segId: string; offset: number; point: Point; d: number } | null {
  const b = room.boundary;
  let best: { segId: string; offset: number; point: Point; d: number } | null = null;
  b.segments.forEach((s, i) => {
    if (!allowOpenings && !isSolidKind(s.kind)) return;
    const [a, c] = segEnds(b, i);
    const r = distToSegment(p, a, c);
    if (!best || r.d < best.d) best = { segId: s.id, offset: r.t * dist(a, c), point: r.foot, d: r.d };
  });
  return best;
}

/** Cạnh phòng chứa đoạn i và vị trí tim tính dọc cạnh (từ đầu cạnh) */
export function edgeInfo(room: Room, segIdx: number) {
  const b = room.boundary;
  const e = edges(b).find((x) => x.segs.includes(segIdx));
  if (!e) return null;
  let before = 0;
  for (const k of e.segs) {
    if (k === segIdx) break;
    before += segLength(b, k);
  }
  return { edge: e, before };
}

/** Đứng trong phòng nhìn vào tường: điểm đầu cạnh nằm bên phải (phòng vẽ ngược chiều kim đồng hồ) */
export function startIsRight(room: Room): boolean {
  return outwardSide(room.boundary) === 1;
}

/** Khoảng cách tim thiết bị gắn tường tới hai góc của mảng tường */
export function cornerDistances(room: Room, f: Fixture): { fromStart: number; fromEnd: number; edgeLen: number } | null {
  const i = segIndexById(room, f.segId);
  if (i < 0) return null;
  const info = edgeInfo(room, i);
  if (!info) return null;
  const s = info.before + Math.max(0, Math.min(segLength(room.boundary, i), f.offset ?? 0));
  return { fromStart: s, fromEnd: info.edge.length - s, edgeLen: info.edge.length };
}

/** Thiết bị đặt sàn: khoảng cách vuông góc tới các tường gần nhất (theo 2 phương khác nhau) */
export function wallClearances(room: Room, p: Point): { foot: Point; d: number; segIdx: number }[] {
  const b = room.boundary;
  const all = b.segments.map((_, i) => {
    const [a, c] = segEnds(b, i);
    const r = distToSegment(p, a, c);
    return { foot: r.foot, d: r.d, segIdx: i, dir: norm(sub(c, a)) };
  });
  all.sort((m, n) => m.d - n.d);
  const out: typeof all = [];
  for (const x of all) {
    if (out.length >= 2) break;
    if (out.some((o) => Math.abs(o.dir.x * x.dir.y - o.dir.y * x.dir.x) < 0.2)) continue; // bỏ tường song song đã có
    out.push(x);
  }
  return out;
}
