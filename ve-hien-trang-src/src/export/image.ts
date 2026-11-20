/** XUẤT ẢNH PNG/JPG chất lượng cao (vector → raster độ phân giải lớn) */
import type { Prim } from '../drawing/primitives';
import { primsBounds } from '../drawing/buildDrawing';
import { paintPrims, SCREEN_STYLE, type PaintStyle } from '../render/paint';

export const PRINT_STYLE: PaintStyle = {
  ...SCREEN_STYLE,
  color: { ...SCREEN_STYLE.color, WALL_INNER: '#000000', WALL_OUTER: '#222222', TEXT: '#111111', DIMENSION: '#0b5d2c' },
  wallFill: '#bfc6ce',
  textPx: (h) => h,
};

export async function renderImage(prims: Prim[], opts: { format: 'png' | 'jpeg'; longSide: number; title?: string }): Promise<Blob> {
  const bb = primsBounds(prims) ?? { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const pad = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY) * 0.05 + 200;
  const W = bb.maxX - bb.minX + pad * 2;
  const H = bb.maxY - bb.minY + pad * 2;
  const titleH = opts.title ? 0.06 : 0;
  const s = Math.min(opts.longSide / W, opts.longSide / (H * (1 + titleH)));
  const cw = Math.round(W * s);
  const top = Math.round(H * s * titleH);
  const ch = Math.round(H * s) + top;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  const ox = (pad - bb.minX) * s;
  const oy = top + (bb.maxY + pad) * s;
  const lineK = Math.max(1, opts.longSide / 1600);
  const style: PaintStyle = {
    ...PRINT_STYLE,
    width: Object.fromEntries(Object.entries(PRINT_STYLE.width).map(([k, v]) => [k, v * lineK])) as PaintStyle['width'],
    dash: Object.fromEntries(Object.entries(PRINT_STYLE.dash).map(([k, v]) => [k, v!.map((x) => x * lineK)])),
  };
  paintPrims(ctx, prims, { scale: s, toScreen: (p) => ({ x: ox + p.x * s, y: oy - p.y * s }) }, style);
  if (opts.title) {
    ctx.fillStyle = '#111';
    ctx.font = `600 ${Math.round(top * 0.45)}px system-ui, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.title, Math.round(top * 0.4), top * 0.6);
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), opts.format === 'png' ? 'image/png' : 'image/jpeg', 0.92));
}
