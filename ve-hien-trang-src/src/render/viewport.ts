/**
 * KHUNG NHÌN: chuyển đổi tọa độ thực (mm, trục Y hướng lên) ↔ tọa độ màn hình (px CSS, trục Y hướng xuống).
 * Đây là nơi DUY NHẤT pixel xuất hiện — mô hình dữ liệu không bao giờ chứa pixel.
 */
import type { Point } from '../model/types';

export const RULER = 22; // bề rộng thước tọa độ (px)
export const MIN_SCALE = 0.002; // px/mm
export const MAX_SCALE = 20;

export class Viewport {
  /** px trên mỗi mm */
  scale = 0.1;
  /** vị trí màn hình của gốc tọa độ (0,0) */
  ox = 40;
  oy = 400;
  w = 800;
  h = 600;

  toScreen(p: Point): Point {
    return { x: this.ox + p.x * this.scale, y: this.oy - p.y * this.scale };
  }
  toWorld(sx: number, sy: number): Point {
    return { x: (sx - this.ox) / this.scale, y: (this.oy - sy) / this.scale };
  }
  /** chiều dài màn hình (px) → mm */
  px(mmOrPx: number) {
    return mmOrPx / this.scale;
  }
  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }
  pan(dx: number, dy: number) {
    this.ox += dx;
    this.oy += dy;
  }
  zoomAt(sx: number, sy: number, factor: number) {
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    const k = ns / this.scale;
    this.ox = sx - (sx - this.ox) * k;
    this.oy = sy - (sy - this.oy) * k;
    this.scale = ns;
  }
  /** Hiển thị trọn vùng (mm) vào khung nhìn, chừa lề */
  fit(b: { minX: number; minY: number; maxX: number; maxY: number }, marginPx = 40, insets = { top: 0, bottom: 0, left: 0, right: 0 }) {
    const availW = Math.max(50, this.w - RULER - insets.left - insets.right - marginPx * 2);
    const availH = Math.max(50, this.h - RULER - insets.top - insets.bottom - marginPx * 2);
    const bw = Math.max(1, b.maxX - b.minX);
    const bh = Math.max(1, b.maxY - b.minY);
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availW / bw, availH / bh)));
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const scx = RULER + insets.left + marginPx + availW / 2;
    const scy = RULER + insets.top + marginPx + availH / 2;
    this.ox = scx - cx * this.scale;
    this.oy = scy + cy * this.scale;
  }
  visibleWorld() {
    const a = this.toWorld(0, this.h);
    const b = this.toWorld(this.w, 0);
    return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
  }
}
