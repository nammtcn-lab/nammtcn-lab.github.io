/**
 * BỘ MÁY HIỂN THỊ màn hình: lưới, thước, các phòng, đối tượng chọn, bản xem trước khi vẽ.
 * Chỉ đọc dữ liệu — không thay đổi mô hình.
 */
import type { Floor, Point, Room, SegmentKind } from '../model/types';
import type { Selection } from '../store/store';
import { buildRoomPrims, DEFAULT_DRAW, fmtMM } from '../drawing/buildDrawing';
import type { Prim } from '../drawing/primitives';
import { paintPrims, SCREEN_STYLE } from './paint';
import { RULER, Viewport } from './viewport';
import { closureGap, segEnds, segLength } from '../geometry/boundary';
import { angleDeg, dist, lerp, sub } from '../geometry/vec';

export interface Scene {
  floor: Floor | null;
  activeRoomId: string | null;
  selection: Selection;
  grid: boolean;
  minorGrid: boolean;
  dims: boolean;
  showOtherRooms: boolean;
  partitionThickness: number;
  preview: { from: Point; to: Point; kind: SegmentKind } | null;
  snapMark: { p: Point; type: 'vertex' | 'align' | 'grid' | 'close' } | null;
  guides: { a: Point; b: Point }[];
  zoneRect: { a: Point; b: Point } | null;
  hoverSeg: { roomId: string; index: number } | null;
}

const KIND_COLOR: Record<SegmentKind, string> = {
  wall: '#16202c',
  partition: '#6b4f2a',
  door: '#d9730d',
  window: '#0a8fc2',
  opening: '#a347b8',
};

const cache = new WeakMap<Room, { key: string; prims: Prim[] }>();
function roomPrims(r: Room, dims: boolean, pt: number): Prim[] {
  const key = `${dims}|${pt}`;
  const c = cache.get(r);
  if (c && c.key === key) return c.prims;
  const prims = buildRoomPrims(r, { ...DEFAULT_DRAW, dims, partitionThickness: pt });
  cache.set(r, { key, prims });
  return prims;
}

export function render(ctx: CanvasRenderingContext2D, vp: Viewport, sc: Scene, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#fbfcfd';
  ctx.fillRect(0, 0, vp.w, vp.h);
  if (sc.grid) drawGrid(ctx, vp, sc.minorGrid);
  drawOrigin(ctx, vp);

  const floor = sc.floor;
  const active = floor?.rooms.find((r) => r.id === sc.activeRoomId) ?? null;
  if (floor) {
    for (const r of floor.rooms) {
      if (r === active) continue;
      if (!sc.showOtherRooms) continue;
      paintPrims(ctx, roomPrims(r, false, sc.partitionThickness), vp, SCREEN_STYLE, 0.38);
    }
  }
  if (active) {
    paintPrims(ctx, roomPrims(active, sc.dims, sc.partitionThickness), vp, SCREEN_STYLE, 1);
    drawRoomOverlay(ctx, vp, active, sc);
  }
  if (sc.zoneRect) {
    const a = vp.toScreen(sc.zoneRect.a);
    const b = vp.toScreen(sc.zoneRect.b);
    ctx.fillStyle = 'rgba(53,87,196,0.12)';
    ctx.strokeStyle = '#3557c4';
    ctx.setLineDash([6, 4]);
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.setLineDash([]);
    label(ctx, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, `${fmtMM(Math.abs(sc.zoneRect.b.x - sc.zoneRect.a.x))} × ${fmtMM(Math.abs(sc.zoneRect.b.y - sc.zoneRect.a.y))}`, '#3557c4');
  }
  drawPreview(ctx, vp, sc);
  drawRulers(ctx, vp);
}

function niceStep(minWorld: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  return steps.find((s) => s >= minWorld) ?? 100000;
}

function drawGrid(ctx: CanvasRenderingContext2D, vp: Viewport, minor: boolean) {
  const w = vp.visibleWorld();
  const lines = (step: number, color: string, width: number) => {
    const sp = step * vp.scale;
    if (sp < 5) return false;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let x = Math.ceil(w.minX / step) * step; x <= w.maxX; x += step) {
      const s = Math.round(vp.ox + x * vp.scale) + 0.5;
      ctx.moveTo(s, 0);
      ctx.lineTo(s, vp.h);
    }
    for (let y = Math.ceil(w.minY / step) * step; y <= w.maxY; y += step) {
      const s = Math.round(vp.oy - y * vp.scale) + 0.5;
      ctx.moveTo(0, s);
      ctx.lineTo(vp.w, s);
    }
    ctx.stroke();
    return true;
  };
  // lưới phụ 10 mm, lưới chính 100 mm, đường mét 1000 mm
  if (minor) lines(10, '#eef1f4', 1);
  if (!lines(100, minor ? '#e1e6eb' : '#e6eaee', 1)) {
    // thu nhỏ quá: lưới chính hiển thị thưa hơn
    lines(500, '#e6eaee', 1);
  }
  lines(1000, '#cfd6de', 1);
}

function drawOrigin(ctx: CanvasRenderingContext2D, vp: Viewport) {
  const o = vp.toScreen({ x: 0, y: 0 });
  ctx.strokeStyle = 'rgba(210,59,59,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(o.x + 40, o.y);
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(o.x, o.y - 40);
  ctx.stroke();
  ctx.fillStyle = 'rgba(210,59,59,0.8)';
  ctx.beginPath();
  ctx.arc(o.x, o.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoomOverlay(ctx: CanvasRenderingContext2D, vp: Viewport, r: Room, sc: Scene) {
  const b = r.boundary;
  // tô nhẹ đoạn không phải tường để nhận diện nhanh
  for (let i = 0; i < b.segments.length; i++) {
    const k = b.segments[i].kind;
    const [p, q] = segEnds(b, i);
    const a = vp.toScreen(p);
    const c = vp.toScreen(q);
    const hovered = sc.hoverSeg?.roomId === r.id && sc.hoverSeg.index === i;
    if (k !== 'wall' || hovered) {
      ctx.strokeStyle = hovered ? 'rgba(37,99,235,0.35)' : KIND_COLOR[k];
      ctx.lineWidth = hovered ? 8 : 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
  }
  // vùng trần được chọn
  const sel = sc.selection;
  if (sel?.kind === 'zone' && sel.roomId === r.id) {
    const z = r.zones.find((zz) => zz.id === sel.zoneId);
    if (z) {
      ctx.fillStyle = 'rgba(53,87,196,0.15)';
      ctx.strokeStyle = '#3557c4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      z.polygon.forEach((v, i) => {
        const s = vp.toScreen(v);
        if (i) ctx.lineTo(s.x, s.y);
        else ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // đoạn được chọn
  if (sel?.kind === 'segment' && sel.roomId === r.id && sel.index < b.segments.length) {
    const [p, q] = segEnds(b, sel.index);
    const a = vp.toScreen(p);
    const c = vp.toScreen(q);
    ctx.strokeStyle = 'rgba(37,99,235,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    // mũi tên chiều đoạn
    const m = lerp(a, c, 0.5);
    const ang = Math.atan2(c.y - a.y, c.x - a.x);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(m.x + Math.cos(ang) * 9, m.y + Math.sin(ang) * 9);
    ctx.lineTo(m.x + Math.cos(ang + 2.5) * 8, m.y + Math.sin(ang + 2.5) * 8);
    ctx.lineTo(m.x + Math.cos(ang - 2.5) * 8, m.y + Math.sin(ang - 2.5) * 8);
    ctx.fill();
    label(ctx, { x: m.x, y: m.y - 16 }, `#${sel.index + 1} · ${fmtMM(segLength(b, sel.index))}`, '#2563eb');
  }
  // đỉnh
  b.vertices.forEach((v, i) => {
    const s = vp.toScreen(v);
    const selected = sel?.kind === 'vertex' && sel.roomId === r.id && sel.index === i;
    ctx.fillStyle = selected ? '#2563eb' : i === 0 ? '#16a34a' : '#ffffff';
    ctx.strokeStyle = selected ? '#1e40af' : '#16202c';
    ctx.lineWidth = 1.3;
    const R = selected ? 6 : i === 0 ? 5 : 4;
    ctx.beginPath();
    if (i === 0) ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
    else ctx.rect(s.x - R, s.y - R, R * 2, R * 2);
    ctx.fill();
    ctx.stroke();
  });
  // điểm cuối chuỗi (nơi vẽ tiếp)
  if (!b.closed && b.vertices.length) {
    const e = vp.toScreen(b.vertices[b.vertices.length - 1]);
    ctx.strokeStyle = '#d23b3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    // sai số khép kín
    const gap = closureGap(b);
    if (gap && Math.hypot(gap.x, gap.y) > 0.5) {
      const s0 = vp.toScreen(b.vertices[0]);
      ctx.strokeStyle = 'rgba(210,59,59,0.6)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(s0.x, s0.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawPreview(ctx: CanvasRenderingContext2D, vp: Viewport, sc: Scene) {
  for (const g of sc.guides) {
    const a = vp.toScreen(g.a);
    const b = vp.toScreen(g.b);
    ctx.strokeStyle = 'rgba(234,88,12,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (sc.preview) {
    const a = vp.toScreen(sc.preview.from);
    const b = vp.toScreen(sc.preview.to);
    ctx.strokeStyle = KIND_COLOR[sc.preview.kind] === '#16202c' ? '#2563eb' : KIND_COLOR[sc.preview.kind];
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const L = dist(sc.preview.from, sc.preview.to);
    const ang = angleDeg(sub(sc.preview.to, sc.preview.from));
    const m = lerp(a, b, 0.5);
    label(ctx, { x: m.x, y: m.y - 20 }, `${fmtMM(L)} mm · ${Math.round(ang * 10) / 10}°`, '#1e3a8a', 14);
  }
  if (sc.snapMark) {
    const s = vp.toScreen(sc.snapMark.p);
    ctx.strokeStyle = sc.snapMark.type === 'close' ? '#16a34a' : sc.snapMark.type === 'vertex' ? '#ea580c' : '#ea580c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (sc.snapMark.type === 'close' || sc.snapMark.type === 'vertex') ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    else {
      ctx.moveTo(s.x - 7, s.y - 7);
      ctx.lineTo(s.x + 7, s.y + 7);
      ctx.moveTo(s.x + 7, s.y - 7);
      ctx.lineTo(s.x - 7, s.y + 7);
    }
    ctx.stroke();
  }
}

function label(ctx: CanvasRenderingContext2D, p: Point, text: string, color: string, size = 12) {
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const w = ctx.measureText(text).width + 10;
  const h = size + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect?.(p.x - w / 2, p.y - h / 2, w, h, 4);
  if (!ctx.roundRect) ctx.rect(p.x - w / 2, p.y - h / 2, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, p.y + 0.5);
}

function drawRulers(ctx: CanvasRenderingContext2D, vp: Viewport) {
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(0, 0, vp.w, RULER);
  ctx.fillRect(0, 0, RULER, vp.h);
  ctx.strokeStyle = '#b8c2cc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER + 0.5);
  ctx.lineTo(vp.w, RULER + 0.5);
  ctx.moveTo(RULER + 0.5, 0);
  ctx.lineTo(RULER + 0.5, vp.h);
  ctx.stroke();
  const major = niceStep(70 / vp.scale);
  const minorStep = major / (String(major).startsWith('5') ? 5 : String(major).startsWith('2') ? 4 : 10);
  const w = vp.visibleWorld();
  ctx.fillStyle = '#4b5866';
  ctx.font = '10px system-ui, Arial, sans-serif';
  ctx.strokeStyle = '#8a96a3';
  ctx.beginPath();
  // trục X
  for (let x = Math.floor(w.minX / minorStep) * minorStep; x <= w.maxX; x += minorStep) {
    const s = Math.round(vp.ox + x * vp.scale) + 0.5;
    if (s < RULER) continue;
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    ctx.moveTo(s, RULER);
    ctx.lineTo(s, RULER - (isMajor ? 10 : 4));
    if (isMajor) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(fmtMM(Math.round(x)), s + 2, 2);
    }
  }
  // trục Y
  for (let y = Math.floor(w.minY / minorStep) * minorStep; y <= w.maxY; y += minorStep) {
    const s = Math.round(vp.oy - y * vp.scale) + 0.5;
    if (s < RULER) continue;
    const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    ctx.moveTo(RULER, s);
    ctx.lineTo(RULER - (isMajor ? 10 : 4), s);
    if (isMajor) {
      ctx.save();
      ctx.translate(2, s - 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(fmtMM(Math.round(y)), 0, 0);
      ctx.restore();
    }
  }
  ctx.stroke();
  ctx.fillStyle = '#dde3e9';
  ctx.fillRect(0, 0, RULER, RULER);
  ctx.fillStyle = '#4b5866';
  ctx.font = '600 9px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('mm', RULER / 2, RULER / 2);
}
