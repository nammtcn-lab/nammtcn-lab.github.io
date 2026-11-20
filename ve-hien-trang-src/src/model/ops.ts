/**
 * CÁC THAO TÁC CHỈNH SỬA CHUỖI CHU VI — hàm thuần, trả về Boundary mới, không sửa đầu vào.
 * Mọi thao tác làm thay đổi đoạn khác đều trả về thông điệp mô tả để báo cho người dùng.
 */
import type { Boundary, Point, Segment, SegmentKind } from './types';
import { applyKindDefaults, newSegment, uid } from './factory';
import { add, dist, eq, fromAngle, lerp, mul, roundPt, sub } from '../geometry/vec';
import { collinearNext, segDir, segEnds, segLength } from '../geometry/boundary';

export interface OpResult {
  boundary: Boundary;
  message?: string;
}

const clone = (b: Boundary): Boundary => ({
  vertices: b.vertices.map((v) => ({ ...v })),
  segments: b.segments.map((s) => structuredClone(s)),
  closed: b.closed,
});

export class OpError extends Error {}

export function startChain(b: Boundary, p: Point): OpResult {
  if (b.segments.length) throw new OpError('Phòng đã có chu vi. Hãy xóa chu vi cũ trước khi đặt điểm đầu mới.');
  return { boundary: { vertices: [roundPt(p)], segments: [], closed: false } };
}

/** Thêm đoạn từ điểm cuối chuỗi đến điểm p. Tự khép kín nếu p trùng điểm đầu. */
export function appendSegment(b: Boundary, p: Point, kind: SegmentKind = 'wall', closeTol = 1): OpResult {
  if (b.closed) throw new OpError('Chu vi đã khép kín. Mở chu vi hoặc chọn đoạn để chỉnh sửa.');
  if (!b.vertices.length) throw new OpError('Chưa có điểm đầu.');
  const last = b.vertices[b.vertices.length - 1];
  const q = roundPt(p);
  if (dist(last, q) < 1) throw new OpError('Đoạn quá ngắn (< 1 mm).');
  const out = clone(b);
  if (out.vertices.length >= 3 && dist(q, out.vertices[0]) <= closeTol) {
    out.segments.push(newSegment(kind));
    out.closed = true;
    return { boundary: out, message: 'Đã khép kín chu vi phòng.' };
  }
  out.vertices.push(q);
  out.segments.push(newSegment(kind));
  return { boundary: out };
}

export function appendByLength(b: Boundary, length: number, angleDeg: number, kind: SegmentKind = 'wall'): OpResult {
  if (!(length > 0)) throw new OpError('Chiều dài phải lớn hơn 0.');
  const last = b.vertices[b.vertices.length - 1];
  if (!last) throw new OpError('Chưa có điểm đầu.');
  return appendSegment(b, add(last, fromAngle(angleDeg, length)), kind, 0.5);
}

/**
 * Khép kín chu vi. Nếu điểm cuối trùng điểm đầu (sai số ≤ tol) thì gộp điểm;
 * ngược lại tạo đoạn tường khép kín nối điểm cuối về điểm đầu.
 */
export function closeChain(b: Boundary, tol = 1): OpResult {
  if (b.closed) return { boundary: b };
  if (b.vertices.length < 3) throw new OpError('Cần ít nhất 2 đoạn để khép kín chu vi.');
  const out = clone(b);
  const first = out.vertices[0];
  const last = out.vertices[out.vertices.length - 1];
  const gap = dist(first, last);
  if (gap <= tol) {
    out.vertices.pop();
    out.closed = true;
    return { boundary: out, message: 'Đã khép kín chu vi (điểm cuối trùng điểm đầu).' };
  }
  out.segments.push(newSegment('wall'));
  out.closed = true;
  return { boundary: out, message: `Đã thêm đoạn khép kín dài ${fmt(gap)} mm. Hãy kiểm tra lại số đo nếu đây là sai số đo.` };
}

/** Mở chu vi tại đoạn i (đoạn i bị loại bỏ) */
export function openAt(b: Boundary, i: number): OpResult {
  if (!b.closed) return { boundary: b };
  const n = b.segments.length;
  const vertices: Point[] = [];
  const segments: Segment[] = [];
  for (let k = 1; k <= n; k++) vertices.push({ ...b.vertices[(i + k) % n] });
  for (let k = 1; k < n; k++) segments.push(structuredClone(b.segments[(i + k) % n]));
  return { boundary: { vertices, segments, closed: false }, message: 'Đã mở chu vi tại đoạn được chọn.' };
}

/** Mở chu vi tại đoạn cuối cùng (đoạn khép kín) */
export function openChain(b: Boundary): OpResult {
  return openAt(b, b.segments.length - 1);
}

export function deleteSegment(b: Boundary, i: number): OpResult {
  const n = b.segments.length;
  if (i < 0 || i >= n) throw new OpError('Đoạn không tồn tại.');
  if (b.closed) {
    const r = openAt(b, i);
    return { ...r, message: 'Đã xóa đoạn. Chu vi chuyển sang trạng thái hở tại vị trí này.' };
  }
  const out = clone(b);
  if (i === n - 1) {
    out.vertices.pop();
    out.segments.pop();
    if (!out.segments.length) out.vertices = out.vertices.slice(0, 1);
    return { boundary: out };
  }
  if (i === 0) {
    out.vertices.shift();
    out.segments.shift();
    return { boundary: out, message: 'Đã xóa đoạn đầu. Điểm đầu chuỗi chuyển sang đỉnh kế tiếp.' };
  }
  out.vertices.splice(i + 1, 1);
  out.segments.splice(i, 1);
  return { boundary: out, message: `Đã xóa đoạn. Đoạn kế tiếp được nối trực tiếp từ đỉnh ${i + 1} (hình học đoạn kế tiếp thay đổi).` };
}

export type LengthMode = 'shift' | 'moveEnd';

/**
 * Đổi chiều dài đoạn i, giữ nguyên điểm đầu và hướng.
 * - 'shift': dời toàn bộ các đỉnh phía sau theo hướng đoạn (các đoạn sau giữ nguyên chiều dài, hướng).
 *    Với chu vi khép kín: đoạn khép kín cuối cùng (nối về điểm đầu) sẽ thay đổi.
 * - 'moveEnd': chỉ dời điểm cuối của đoạn; đoạn kế tiếp thay đổi theo.
 */
export function setSegmentLength(b: Boundary, i: number, L: number, mode: LengthMode = 'shift'): OpResult {
  if (!(L > 0)) throw new OpError('Chiều dài phải lớn hơn 0.');
  const n = b.segments.length;
  const cur = segLength(b, i);
  if (Math.abs(cur - L) < 1e-6) return { boundary: b };
  const d = segDir(b, i);
  const delta = mul(d, L - cur);
  const out = clone(b);
  const nv = out.vertices.length;
  const before = lengths(b);
  if (mode === 'moveEnd' || (b.closed && i === n - 1)) {
    const j = (i + 1) % nv;
    out.vertices[j] = roundPt(add(out.vertices[j], delta));
  } else {
    for (let j = i + 1; j <= nv - 1; j++) out.vertices[j] = roundPt(add(out.vertices[j], delta));
  }
  const msg = describeChanges(before, lengths(out), i);
  return { boundary: out, message: msg };
}

function lengths(b: Boundary): number[] {
  return b.segments.map((_, k) => segLength(b, k));
}

function describeChanges(before: number[], after: number[], self: number): string | undefined {
  const changed: string[] = [];
  for (let k = 0; k < after.length; k++) {
    if (k === self) continue;
    if (Math.abs(before[k] - after[k]) > 0.05) changed.push(`đoạn ${k + 1}: ${fmt(before[k])} → ${fmt(after[k])}`);
  }
  if (!changed.length) return undefined;
  return 'Lưu ý, các đoạn khác thay đổi theo: ' + changed.join('; ');
}

export const fmt = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
};

/** Đặt tọa độ một đỉnh (hai đoạn kề thay đổi theo) */
export function setVertex(b: Boundary, j: number, p: Point): OpResult {
  const out = clone(b);
  out.vertices[j] = roundPt(p);
  // không cho phép trùng đỉnh kề
  const nv = out.vertices.length;
  const prev = out.vertices[(j - 1 + nv) % nv];
  const next = out.vertices[(j + 1) % nv];
  if ((j > 0 || b.closed) && eq(prev, out.vertices[j], 0.5)) throw new OpError('Đỉnh trùng với đỉnh kề trước.');
  if ((j < nv - 1 || b.closed) && eq(next, out.vertices[j], 0.5)) throw new OpError('Đỉnh trùng với đỉnh kề sau.');
  return { boundary: out };
}

/** Đặt điểm đầu/cuối của đoạn i bằng tọa độ */
export function setSegmentEnds(b: Boundary, i: number, a: Point, c: Point): OpResult {
  const nv = b.vertices.length;
  let r = setVertex(b, i, a);
  r = setVertex(r.boundary, (i + 1) % nv, c);
  return { boundary: r.boundary, message: 'Đã cập nhật tọa độ. Hai đoạn kề với đoạn này thay đổi theo.' };
}

/** Chia đoạn i tại các khoảng cách tính từ điểm đầu (mm) */
export function splitSegment(b: Boundary, i: number, distances: number[]): OpResult {
  const L = segLength(b, i);
  const ds = [...new Set(distances.map((d) => Math.round(d * 1000) / 1000))].filter((d) => d > 0.5 && d < L - 0.5).sort((m, n) => m - n);
  if (!ds.length) throw new OpError('Vị trí chia không hợp lệ (phải nằm trong đoạn).');
  const [a, c] = segEnds(b, i);
  const out = clone(b);
  const newPts = ds.map((d) => roundPt(lerp(a, c, d / L)));
  const base = out.segments[i];
  const newSegs: Segment[] = ds.map(() => ({ ...structuredClone(base), id: uid('s') }));
  out.vertices.splice(i + 1, 0, ...newPts);
  out.segments.splice(i + 1, 0, ...newSegs);
  return { boundary: out };
}

export function splitEqual(b: Boundary, i: number, parts: number): OpResult {
  if (parts < 2 || parts > 50) throw new OpError('Số phần chia từ 2 đến 50.');
  const L = segLength(b, i);
  return splitSegment(b, i, Array.from({ length: parts - 1 }, (_, k) => (L * (k + 1)) / parts));
}

/**
 * Chèn cửa/ô mở vào đoạn tường i: cách điểm đầu `offset` mm, rộng `width` mm.
 * Kết quả: tường | cửa | tường — tổng chiều dài cạnh không đổi.
 */
export function insertOpening(b: Boundary, i: number, offset: number, width: number, kind: SegmentKind): OpResult {
  const L = segLength(b, i);
  if (!(width > 0)) throw new OpError('Chiều rộng cửa bắt buộc và phải lớn hơn 0.');
  if (offset < 0 || offset + width > L + 1e-6) throw new OpError(`Cửa vượt quá chiều dài đoạn (${fmt(L)} mm).`);
  const cuts = [offset, offset + width].filter((d) => d > 0.5 && d < L - 0.5);
  let out = cuts.length ? splitSegment(b, i, cuts).boundary : clone(b);
  const target = offset > 0.5 ? i + 1 : i;
  const s = out.segments[target];
  out.segments[target] = applyKindDefaults({ ...s, id: uid('s'), door: undefined, window: undefined, opening: undefined }, kind);
  return { boundary: out, message: undefined };
}

/** Gộp đoạn i với đoạn kế tiếp (phải thẳng hàng và cùng loại) */
export function mergeWithNext(b: Boundary, i: number): OpResult {
  const n = b.segments.length;
  if (!b.closed && i >= n - 1) throw new OpError('Không có đoạn kế tiếp để gộp.');
  const j = (i + 1) % n;
  if (n < (b.closed ? 4 : 2)) throw new OpError('Chu vi quá ít đoạn để gộp.');
  if (b.segments[i].kind !== b.segments[j].kind) throw new OpError('Chỉ gộp được hai đoạn cùng loại.');
  if (!collinearNext(b, i, j, 0.5)) throw new OpError('Chỉ gộp được hai đoạn thẳng hàng.');
  const out = clone(b);
  const vIdx = (i + 1) % out.vertices.length;
  out.vertices.splice(vIdx, 1);
  out.segments.splice(j, 1);
  return { boundary: out };
}

export function setKind(b: Boundary, i: number, kind: SegmentKind): OpResult {
  const out = clone(b);
  out.segments[i] = applyKindDefaults(out.segments[i], kind);
  return { boundary: out };
}

export function updateSegment(b: Boundary, i: number, patch: Partial<Segment>): OpResult {
  const out = clone(b);
  out.segments[i] = { ...out.segments[i], ...structuredClone(patch) };
  return { boundary: out };
}

export function translateBoundary(b: Boundary, d: Point): Boundary {
  const out = clone(b);
  out.vertices = out.vertices.map((v) => roundPt(add(v, d)));
  return out;
}

export function translatePoints(pts: Point[], d: Point): Point[] {
  return pts.map((v) => roundPt(add(v, d)));
}

/** Hướng của đoạn cuối cùng (độ), để gợi ý khi nhập bằng bàn phím */
export function lastDirection(b: Boundary): number | null {
  if (!b.segments.length) return null;
  const [a, c] = segEnds(b, b.segments.length - 1);
  const v = sub(c, a);
  return ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360;
}
