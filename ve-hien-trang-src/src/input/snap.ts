/**
 * BẮT ĐIỂM / BẮT GÓC / KHÓA PHƯƠNG cho đoạn đang vẽ.
 * Bắt điểm chỉ áp dụng cho thao tác kéo; số đo nhập bằng bàn phím luôn được giữ nguyên.
 */
import type { Point } from '../model/types';
import { add, dist, fromAngle, len, sub } from '../geometry/vec';

export interface SnapInput {
  from: Point;
  /** vector kéo thô (mm) */
  raw: Point;
  ortho: boolean;
  snap: boolean;
  step: number;
  /** bán kính bắt điểm theo mm (tương ứng ~ 14px trên màn hình) */
  tol: number;
  /** các đỉnh có thể bắt (đỉnh đầu chuỗi đứng đầu danh sách) */
  targets: Point[];
  closeTarget: Point | null;
}

export interface SnapResult {
  to: Point;
  mark: { p: Point; type: 'vertex' | 'align' | 'grid' | 'close' } | null;
  guides: { a: Point; b: Point }[];
}

const ANGLE_STEP = 15;

export function snapSegment(i: SnapInput): SnapResult {
  const guides: SnapResult['guides'] = [];
  const rawEnd = add(i.from, i.raw);
  // 1) bắt điểm khép kín / đỉnh có sẵn
  if (i.snap || i.closeTarget) {
    if (i.closeTarget && dist(rawEnd, i.closeTarget) <= i.tol * 1.3) return { to: i.closeTarget, mark: { p: i.closeTarget, type: 'close' }, guides };
    if (i.snap) {
      for (const t of i.targets) {
        if (dist(rawEnd, t) <= i.tol) return { to: t, mark: { p: t, type: 'vertex' }, guides };
      }
    }
  }
  let L = len(i.raw);
  if (L < 1e-9) return { to: i.from, mark: null, guides };
  let ang = (Math.atan2(i.raw.y, i.raw.x) * 180) / Math.PI;
  if (i.ortho) ang = Math.round(ang / 90) * 90;
  else if (i.snap) {
    const s = Math.round(ang / ANGLE_STEP) * ANGLE_STEP;
    if (Math.abs(s - ang) < 4) ang = s;
  }
  const dir = fromAngle(ang);
  // chiều dài theo hình chiếu khi khóa phương
  if (i.ortho || Math.abs(Math.round(ang / ANGLE_STEP) * ANGLE_STEP - ang) < 1e-9) L = i.raw.x * dir.x + i.raw.y * dir.y;
  if (L < 0) L = 0;
  // 2) dóng thẳng hàng với các đỉnh khác (theo X hoặc Y)
  if (i.snap && (Math.abs(dir.x) < 1e-9 || Math.abs(dir.y) < 1e-9)) {
    const horizontal = Math.abs(dir.y) < 1e-9;
    for (const t of i.targets) {
      const want = horizontal ? (t.x - i.from.x) / dir.x : (t.y - i.from.y) / dir.y;
      if (want > 0 && Math.abs(want - L) <= i.tol) {
        const to = add(i.from, { x: dir.x * want, y: dir.y * want });
        guides.push({ a: t, b: to });
        return { to, mark: { p: to, type: 'align' }, guides };
      }
    }
  }
  // 3) làm tròn theo bước bắt điểm
  if (i.snap && i.step > 0) L = Math.round(L / i.step) * i.step;
  const to = add(i.from, { x: dir.x * L, y: dir.y * L });
  return { to, mark: null, guides };
}

/** Bắt một điểm đơn lẻ (điểm đầu, kéo đỉnh, vẽ vùng trần) */
export function snapPoint(p: Point, opt: { snap: boolean; step: number; tol: number; targets: Point[] }): { p: Point; mark: SnapResult['mark'] } {
  if (opt.snap) {
    for (const t of opt.targets) if (dist(p, t) <= opt.tol) return { p: t, mark: { p: t, type: 'vertex' } };
    const q = { x: Math.round(p.x / opt.step) * opt.step, y: Math.round(p.y / opt.step) * opt.step };
    return { p: q, mark: { p: q, type: 'grid' } };
  }
  return { p, mark: null };
}

export const vecFrom = (a: Point, b: Point) => sub(b, a);
