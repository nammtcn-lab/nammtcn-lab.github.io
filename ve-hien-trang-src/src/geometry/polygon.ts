import type { Point } from '../model/types';
import { cross, sub } from './vec';

/** Diện tích có dấu (mm²). > 0 khi các đỉnh xếp ngược chiều kim đồng hồ (CCW). */
export function signedArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const area = (pts: Point[]) => Math.abs(signedArea(pts));

export function perimeter(pts: Point[], closed = true): number {
  let s = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

export function centroid(pts: Point[]): Point {
  const A = signedArea(pts);
  if (Math.abs(A) < 1e-9) {
    const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / Math.max(1, pts.length), y: s.y / Math.max(1, pts.length) };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

export function pointInPolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Điểm đặt nhãn nằm trong đa giác (trọng tâm, nếu rơi ra ngoài thì lấy trung điểm đường quét ngang dài nhất) */
export function labelPoint(pts: Point[]): Point {
  const c = centroid(pts);
  if (pts.length < 3 || pointInPolygon(c, pts)) return c;
  let best = c;
  let bestW = -1;
  const ys = pts.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let k = 1; k < 40; k++) {
    const y = minY + ((maxY - minY) * k) / 40;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      if (w > bestW) {
        bestW = w;
        best = { x: (xs[i] + xs[i + 1]) / 2, y };
      }
    }
  }
  return best;
}

/** Góc trong tại đỉnh i của đa giác (độ), có tính chiều đa giác */
export function interiorAngle(pts: Point[], i: number): number {
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const cur = pts[i];
  const next = pts[(i + 1) % n];
  const a = sub(prev, cur);
  const b = sub(next, cur);
  let ang = (Math.atan2(cross(b, a), a.x * b.x + a.y * b.y) * 180) / Math.PI;
  if (signedArea(pts) < 0) ang = -ang;
  if (ang < 0) ang += 360;
  return ang;
}

export function bbox(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!pts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
