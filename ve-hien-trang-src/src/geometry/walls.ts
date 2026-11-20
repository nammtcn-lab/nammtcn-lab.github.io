import type { Boundary, Point } from '../model/types';
import { add, cross, dist, dot, lineIntersect, mul, perpLeft, perpRight } from './vec';
import { isOpeningKind, isSolidKind, outwardSide, segDir, segEnds } from './boundary';

/** Giới hạn vát góc: nếu điểm giao offset xa đỉnh hơn MITER_LIMIT × bề dày thì cắt vát */
export const MITER_LIMIT = 8;

export interface SegWallGeom {
  index: number;
  /** Điểm trên đường biên trong (dữ liệu đo gốc) */
  innerStart: Point;
  innerEnd: Point;
  /** Điểm trên đường biên ngoài (sinh ra từ bề dày tường) */
  outerStart: Point;
  outerEnd: Point;
  thickness: number;
  /** Pháp tuyến đơn vị hướng ra ngoài phòng */
  normal: Point;
  dir: Point;
}

export interface WallRun {
  /** Chỉ số các đoạn đặc (tường/vách) liên tiếp */
  segs: number[];
  /** true khi toàn bộ chu vi khép kín đều là tường (không có ô mở) */
  ring: boolean;
  /** Polyline biên trong của dải tường */
  inner: Point[];
  /** Polyline biên ngoài, gồm cả hai đường cạnh khuôn (jamb) ở hai đầu nếu không phải vòng kín */
  outer: Point[];
  /** Tam giác góc cần tô thêm khi cửa nằm sát góc phòng (khuôn cửa vuông góc) */
  caps: Point[][];
}

export interface WallGeometry {
  segs: SegWallGeom[];
  runs: WallRun[];
  /** Đường biên ngoài đầy đủ (kể cả qua vị trí cửa), dùng cho tính toán */
  outerRing: Point[];
  side: 1 | -1;
}

export interface ThicknessOptions {
  defaultThickness: number;
  partitionThickness?: number;
}

/**
 * Bề dày hiệu lực của đoạn i:
 * - Có giá trị riêng → dùng giá trị riêng.
 * - Cửa / ô mở chưa đặt → lấy theo tường chứa cửa (đoạn đặc gần nhất hai phía, giá trị lớn hơn).
 * - Vách ngăn chưa đặt → bề dày vách mặc định.
 */
export function effectiveThickness(b: Boundary, i: number, opt: ThicknessOptions): number {
  const s = b.segments[i];
  if (s.thickness != null && s.thickness > 0) return s.thickness;
  if (s.kind === 'partition') return opt.partitionThickness ?? opt.defaultThickness;
  if (isOpeningKind(s.kind)) {
    // tường chứa cửa: đoạn đặc gần nhất phía trước và phía sau, lấy giá trị lớn hơn
    const n = b.segments.length;
    const found: number[] = [];
    for (const step of [-1, 1]) {
      for (let k = 1; k < n; k++) {
        let j = i + step * k;
        if (b.closed) j = ((j % n) + n) % n;
        else if (j < 0 || j >= n) break;
        const o = b.segments[j];
        if (isSolidKind(o.kind)) {
          found.push(o.thickness != null && o.thickness > 0 ? o.thickness : o.kind === 'partition' ? opt.partitionThickness ?? opt.defaultThickness : opt.defaultThickness);
          break;
        }
      }
    }
    if (found.length) return Math.max(...found);
  }
  return opt.defaultThickness;
}

/**
 * Tạo hình bề dày tường ra phía NGOÀI đường biên trong.
 * Đường biên trong (dữ liệu đo gốc) không bao giờ bị thay đổi.
 * Xử lý: góc vuông, góc lồi/lõm, cạnh chéo, đoạn thẳng hàng có bề dày khác nhau (tạo bậc).
 */
export function computeWallGeometry(b: Boundary, opt: ThicknessOptions): WallGeometry {
  const n = b.segments.length;
  const side = outwardSide(b);
  const segs: SegWallGeom[] = [];
  for (let i = 0; i < n; i++) {
    const [a, c] = segEnds(b, i);
    const dir = segDir(b, i);
    const normal = side === 1 ? perpRight(dir) : perpLeft(dir);
    const t = effectiveThickness(b, i, opt);
    segs.push({
      index: i,
      innerStart: a,
      innerEnd: c,
      outerStart: add(a, mul(normal, t)),
      outerEnd: add(c, mul(normal, t)),
      thickness: t,
      normal,
      dir,
    });
  }
  // nối góc giữa đoạn i và đoạn kế tiếp
  const joints = b.closed ? n : n - 1;
  for (let i = 0; i < joints; i++) {
    const p = segs[i];
    const q = segs[(i + 1) % n];
    const V = p.innerEnd;
    const cr = cross(p.dir, q.dir);
    const dt = dot(p.dir, q.dir);
    if (Math.abs(cr) < 1e-7) {
      // thẳng hàng hoặc ngược chiều: giữ điểm vuông góc của mỗi đoạn (bậc nếu bề dày khác nhau)
      if (dt > 0 && Math.abs(p.thickness - q.thickness) < 1e-6) {
        const X = add(V, mul(p.normal, p.thickness));
        p.outerEnd = X;
        q.outerStart = X;
      }
      continue;
    }
    const X = lineIntersect(p.outerStart, p.dir, q.outerEnd, q.dir);
    if (!X) continue;
    if (dist(X, V) > MITER_LIMIT * Math.max(p.thickness, q.thickness)) continue; // góc quá nhọn → để vát
    p.outerEnd = X;
    q.outerStart = X;
  }

  // đường biên ngoài đầy đủ
  const outerRing: Point[] = [];
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    if (!outerRing.length || dist(outerRing[outerRing.length - 1], s.outerStart) > 1e-6) outerRing.push(s.outerStart);
    outerRing.push(s.outerEnd);
  }
  if (b.closed && outerRing.length > 1 && dist(outerRing[0], outerRing[outerRing.length - 1]) < 1e-6) outerRing.pop();

  return { segs, runs: buildRuns(b, segs), outerRing, side };
}

function buildRuns(b: Boundary, segs: SegWallGeom[]): WallRun[] {
  const n = b.segments.length;
  if (!n) return [];
  const solid = b.segments.map((s) => isSolidKind(s.kind));
  if (b.closed && solid.every(Boolean)) {
    const inner = b.vertices.slice();
    const outer: Point[] = [];
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      if (!outer.length || dist(outer[outer.length - 1], s.outerStart) > 1e-6) outer.push(s.outerStart);
      outer.push(s.outerEnd);
    }
    if (dist(outer[0], outer[outer.length - 1]) < 1e-6) outer.pop();
    return [{ segs: segs.map((s) => s.index), ring: true, inner: dedupe(inner), outer: dedupe(outer), caps: [] }];
  }
  // điểm xuất phát: đoạn đặc mà đoạn trước nó không đặc (hoặc đầu chuỗi hở)
  const order: number[] = [];
  if (b.closed) {
    let start = solid.findIndex((v, i) => v && !solid[(i - 1 + n) % n]);
    if (start < 0) start = 0;
    for (let k = 0; k < n; k++) order.push((start + k) % n);
  } else for (let i = 0; i < n; i++) order.push(i);

  const runs: WallRun[] = [];
  let cur: number[] = [];
  const neighbor = (i: number, step: 1 | -1): SegWallGeom | null => {
    const j = i + step;
    if (b.closed) return segs[(j + n) % n];
    return j >= 0 && j < n ? segs[j] : null;
  };
  const flush = () => {
    if (!cur.length) return;
    const first = segs[cur[0]];
    const last = segs[cur[cur.length - 1]];
    const caps: Point[][] = [];
    const inner: Point[] = [first.innerStart];
    const outer: Point[] = [first.innerStart];
    // cửa sát góc: khuôn cửa vuông góc theo đoạn cửa, rồi mới tới điểm góc ngoài của tường
    const prev = neighbor(cur[0], -1);
    if (prev && Math.abs(cross(prev.dir, first.dir)) > 1e-7) {
      const jamb = add(first.innerStart, mul(prev.normal, prev.thickness));
      outer.push(jamb);
      caps.push([first.innerStart, jamb, first.outerStart]);
    }
    outer.push(first.outerStart);
    for (const i of cur) {
      const s = segs[i];
      inner.push(s.innerEnd);
      if (dist(outer[outer.length - 1], s.outerStart) > 1e-6) outer.push(s.outerStart);
      outer.push(s.outerEnd);
    }
    const next = neighbor(cur[cur.length - 1], 1);
    if (next && Math.abs(cross(last.dir, next.dir)) > 1e-7) {
      const jamb = add(last.innerEnd, mul(next.normal, next.thickness));
      outer.push(jamb);
      caps.push([last.innerEnd, last.outerEnd, jamb]);
    }
    outer.push(last.innerEnd);
    runs.push({ segs: cur, ring: false, inner: dedupe(inner), outer: dedupe(outer), caps });
    cur = [];
  };
  for (const i of order) {
    if (solid[i]) cur.push(i);
    else flush();
  }
  flush();
  return runs;
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > 1e-6) out.push(p);
  return out;
}
