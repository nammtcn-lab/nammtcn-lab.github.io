import type { Point } from '../model/types';

/** Dung sai hình học (mm) */
export const EPS = 1e-6;
/** Dung sai coi hai điểm trùng nhau khi khảo sát (mm) */
export const MERGE_TOL = 0.5;

export const pt = (x: number, y: number): Point => ({ x, y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
export const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
export const len = (a: Point) => Math.hypot(a.x, a.y);
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const norm = (a: Point): Point => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Pháp tuyến trái (quay +90°) */
export const perpLeft = (a: Point): Point => ({ x: -a.y, y: a.x });
/** Pháp tuyến phải (quay -90°) */
export const perpRight = (a: Point): Point => ({ x: a.y, y: -a.x });
export const eq = (a: Point, b: Point, tol = MERGE_TOL) => dist(a, b) <= tol;
export const fromAngle = (deg: number, l = 1): Point => {
  const r = (deg * Math.PI) / 180;
  return { x: Math.cos(r) * l, y: Math.sin(r) * l };
};
/** Góc hướng của vector, độ, trong [0,360) */
export const angleDeg = (a: Point) => {
  let d = (Math.atan2(a.y, a.x) * 180) / Math.PI;
  if (d < 0) d += 360;
  if (d >= 360 - 1e-9) d = 0;
  return d;
};
/** Làm tròn số để tránh nhiễu dấu phẩy động (mặc định 0.001 mm) */
export const round = (v: number, step = 0.001) => Math.round(v / step) * step;
export const roundPt = (p: Point, step = 0.001): Point => ({ x: round(p.x, step) + 0, y: round(p.y, step) + 0 });

/** Giao điểm hai đường thẳng (p1 + t*d1) và (p2 + s*d2). null nếu song song. */
export function lineIntersect(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const c = cross(d1, d2);
  if (Math.abs(c) < 1e-9) return null;
  const t = cross(sub(p2, p1), d2) / c;
  return add(p1, mul(d1, t));
}

/** Khoảng cách từ điểm đến đoạn thẳng, kèm tham số t ∈ [0,1] của điểm chiếu */
export function distToSegment(p: Point, a: Point, b: Point): { d: number; t: number; foot: Point } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < EPS ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const foot = add(a, mul(ab, t));
  return { d: dist(p, foot), t, foot };
}
