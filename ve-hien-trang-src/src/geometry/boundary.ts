import type { Boundary, Point, Segment, SegmentKind } from '../model/types';
import { angleDeg, cross, dist, dot, norm, sub } from './vec';
import { area, perimeter, signedArea } from './polygon';

/** Đoạn i: điểm đầu, điểm cuối */
export function segEnds(b: Boundary, i: number): [Point, Point] {
  const n = b.vertices.length;
  return [b.vertices[i], b.vertices[(i + 1) % n]];
}

export function segLength(b: Boundary, i: number): number {
  const [a, c] = segEnds(b, i);
  return dist(a, c);
}

export function segDir(b: Boundary, i: number): Point {
  const [a, c] = segEnds(b, i);
  return norm(sub(c, a));
}

export function segAngle(b: Boundary, i: number): number {
  const [a, c] = segEnds(b, i);
  return angleDeg(sub(c, a));
}

export const isSolidKind = (k: SegmentKind) => k === 'wall' || k === 'partition';
export const isOpeningKind = (k: SegmentKind) => k === 'door' || k === 'window' || k === 'opening';

/** Điểm cuối hiện tại của chuỗi (để vẽ tiếp) */
export function chainEnd(b: Boundary): Point | null {
  if (!b.vertices.length) return null;
  return b.closed ? b.vertices[0] : b.vertices[b.vertices.length - 1];
}

/** Tổng chiều dài các đoạn (mm) */
export function totalLength(b: Boundary): number {
  if (b.vertices.length < 2) return 0;
  return perimeter(b.vertices, b.closed);
}

/** Diện tích lòng phòng (mm²) theo đường biên trong — chỉ khi đã khép kín */
export function innerArea(b: Boundary): number {
  return b.closed && b.vertices.length >= 3 ? area(b.vertices) : 0;
}

/** Sai số khép kín: vector từ điểm cuối về điểm đầu của chuỗi hở */
export function closureGap(b: Boundary): Point | null {
  if (b.closed || b.vertices.length < 3) return null;
  return sub(b.vertices[0], b.vertices[b.vertices.length - 1]);
}

/**
 * Chiều pháp tuyến hướng ra ngoài phòng: +1 = bên phải hướng đi của đoạn, -1 = bên trái.
 * Đa giác CCW → phía trong nằm bên trái → ngoài là bên phải.
 */
export function outwardSide(b: Boundary): 1 | -1 {
  if (b.vertices.length < 3) return 1;
  return signedArea(b.vertices) >= 0 ? 1 : -1;
}

/** Hai đoạn liên tiếp có thẳng hàng cùng chiều không */
export function collinearNext(b: Boundary, i: number, j: number, angTolDeg = 0.05): boolean {
  const d1 = segDir(b, i);
  const d2 = segDir(b, j);
  return dot(d1, d2) > 0 && Math.abs(cross(d1, d2)) < Math.sin((angTolDeg * Math.PI) / 180);
}

export interface Edge {
  /** Chỉ số các đoạn thẳng hàng liên tiếp tạo thành một cạnh phòng */
  segs: number[];
  start: Point;
  end: Point;
  length: number;
}

/**
 * Gom các đoạn thẳng hàng liên tiếp thành "cạnh phòng".
 * Ví dụ cạnh 4.500 = tường 1.200 + cửa sổ 1.500 + tường 1.800.
 */
export function edges(b: Boundary): Edge[] {
  const n = b.segments.length;
  if (!n) return [];
  let startIdx = 0;
  if (b.closed && n > 1) {
    // bắt đầu từ đoạn không thẳng hàng với đoạn trước
    startIdx = -1;
    for (let i = 0; i < n; i++) {
      if (!collinearNext(b, (i - 1 + n) % n, i)) {
        startIdx = i;
        break;
      }
    }
    if (startIdx < 0) startIdx = 0;
  }
  const result: Edge[] = [];
  let cur: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (startIdx + k) % n;
    if (cur.length && !collinearNext(b, cur[cur.length - 1], i)) {
      result.push(mkEdge(b, cur));
      cur = [];
    }
    cur.push(i);
  }
  if (cur.length) result.push(mkEdge(b, cur));
  return result;
}

function mkEdge(b: Boundary, segs: number[]): Edge {
  const start = segEnds(b, segs[0])[0];
  const end = segEnds(b, segs[segs.length - 1])[1];
  return { segs, start, end, length: segs.reduce((s, i) => s + segLength(b, i), 0) };
}

export function segmentIndexById(b: Boundary, id: string): number {
  return b.segments.findIndex((s: Segment) => s.id === id);
}
