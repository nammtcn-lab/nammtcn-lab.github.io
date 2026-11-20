/**
 * Vẽ danh sách đối tượng bản vẽ (mm) lên Canvas 2D thông qua một phép biến đổi khung nhìn.
 * Dùng cho cả màn hình và xuất ảnh PNG/JPG.
 */
import type { Layer, Prim } from '../drawing/primitives';
import { explodeDim } from '../drawing/buildDrawing';
import type { Point } from '../model/types';

export interface Xf {
  toScreen(p: Point): Point;
  scale: number; // px/mm
}

export interface PaintStyle {
  color: Record<Layer, string>;
  width: Record<Layer, number>;
  dash: Partial<Record<Layer, number[]>>;
  wallFill: string;
  /** Kích thước chữ px từ chiều cao chữ mm */
  textPx: (h: number, layer: Layer) => number;
  font: string;
}

export const SCREEN_STYLE: PaintStyle = {
  color: {
    WALL_INNER: '#16202c',
    WALL_OUTER: '#4b5866',
    WALL_FILL: '#c9d1da',
    DOOR: '#d9730d',
    WINDOW: '#0a8fc2',
    OPENING: '#a347b8',
    DIMENSION: '#1d7f45',
    TEXT: '#1f2a37',
    AXIS: '#d23b3b',
    CEILING: '#3557c4',
  },
  width: { WALL_INNER: 2, WALL_OUTER: 1.2, WALL_FILL: 0, DOOR: 1.4, WINDOW: 1.2, OPENING: 1.2, DIMENSION: 0.9, TEXT: 1, AXIS: 1.2, CEILING: 1 },
  dash: { OPENING: [6, 4], CEILING: [8, 5] },
  wallFill: '#c9d1da',
  textPx: (h, layer) => {
    if (h < (layer === 'DIMENSION' || layer === 'CEILING' ? 4.5 : 3)) return 0;
    const min = layer === 'DIMENSION' ? 10 : 10.5;
    const max = layer === 'TEXT' ? 17 : 14;
    return Math.max(min, Math.min(max, h));
  },
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
};

export function paintPrims(ctx: CanvasRenderingContext2D, prims: Prim[], xf: Xf, st: PaintStyle, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  // tô nền trước
  ctx.fillStyle = st.wallFill;
  for (const p of prims) {
    if (p.t !== 'fill') continue;
    ctx.beginPath();
    p.pts.forEach((v, i) => {
      const s = xf.toScreen(v);
      if (i) ctx.lineTo(s.x, s.y);
      else ctx.moveTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.fill();
    // khử khe hở giữa các tứ giác
    ctx.strokeStyle = st.wallFill;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  for (const p0 of prims) {
    const list = p0.t === 'dim' ? explodeDim(p0) : [p0];
    for (const p of list) {
      if (p.t === 'fill' || p.t === 'dim') continue;
      ctx.strokeStyle = st.color[p.layer];
      ctx.fillStyle = st.color[p.layer];
      ctx.lineWidth = st.width[p.layer];
      ctx.setLineDash(st.dash[p.layer] ?? []);
      if (p.t === 'line') {
        const a = xf.toScreen(p.a);
        const b = xf.toScreen(p.b);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (p.t === 'poly') {
        ctx.beginPath();
        p.pts.forEach((v, i) => {
          const s = xf.toScreen(v);
          if (i) ctx.lineTo(s.x, s.y);
          else ctx.moveTo(s.x, s.y);
        });
        if (p.closed) ctx.closePath();
        ctx.stroke();
      } else if (p.t === 'arc') {
        const c = xf.toScreen(p.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, p.r * xf.scale, (-p.a0 * Math.PI) / 180, (-p.a1 * Math.PI) / 180, true);
        ctx.stroke();
      } else if (p.t === 'text') {
        const s = xf.toScreen(p.p);
        const px = st.textPx(p.h * xf.scale, p.layer);
        if (!px) continue;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate((-p.rot * Math.PI) / 180);
        ctx.font = `${p.layer === 'TEXT' && p.h > 130 ? '600 ' : ''}${px}px ${st.font}`;
        ctx.textAlign = p.align;
        ctx.textBaseline = p.valign === 'bottom' ? 'bottom' : p.valign === 'top' ? 'top' : 'middle';
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}
