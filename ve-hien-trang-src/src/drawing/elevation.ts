/**
 * MẶT ĐỨNG MẢNG TƯỜNG — nhìn từ trong phòng ra tường.
 * Trục x: từ góc bên trái (khi đứng trong phòng nhìn vào tường) sang phải; trục y: cao độ từ sàn hoàn thiện.
 * Thể hiện: khung tường, sàn, các cao độ trần/dầm, cửa đi, cửa sổ, ô mở, len chân tường,
 * thiết bị trên tường (ổ cắm, công tắc, điều hòa, lavabo, vòi sen…) và ghi chú.
 */
import type { ElevationInfo, Fixture, Point, Room } from '../model/types';
import { FIXTURES, HEIGHT_TYPE_LABEL, MEASURE_REF_LABEL } from '../model/types';
import type { Prim } from './primitives';
import { edges, segEnds, segLength, type Edge } from '../geometry/boundary';
import { dist, dot, norm, sub } from '../geometry/vec';
import { fixtureTag, fmtMM } from './buildDrawing';
import { fixturePos, startIsRight } from '../geometry/fixtures';

export const DEFAULT_WALL_H = 3000;

export function edgeKey(room: Room, e: Edge): string {
  return room.boundary.segments[e.segs[0]].id;
}

export function edgeOf(room: Room, segIdx: number): Edge | null {
  return edges(room.boundary).find((x) => x.segs.includes(segIdx)) ?? null;
}

export function elevationInfo(room: Room, e: Edge): ElevationInfo {
  return room.elevations[edgeKey(room, e)] ?? { baseboard: null, notes: [] };
}

/** Thiết bị gắn trên mảng tường (cạnh) này */
export function fixturesOnEdge(room: Room, e: Edge): Fixture[] {
  const ids = new Set(e.segs.map((i) => room.boundary.segments[i].id));
  return room.fixtures.filter((f) => f.mount === 'wall' && f.segId && ids.has(f.segId));
}

/** Tâm thiết bị theo hệ tọa độ mặt đứng (y = null khi chưa đo cao độ) */
export function fixtureElevCenter(f: Fixture): { y: number; known: boolean } {
  const def = FIXTURES[f.type];
  const h = f.height ?? def.suggest;
  const known = f.height != null;
  const base = h ?? 1000;
  const y = f.heightRef === 'bottom' ? base + f.h / 2 : f.heightRef === 'top' ? base - f.h / 2 : base;
  return { y, known };
}

export function buildElevation(room: Room, segIdx: number, textHeight = 100): { prims: Prim[]; length: number; height: number; title: string } {
  const out: Prim[] = [];
  const e = edgeOf(room, segIdx);
  if (!e) return { prims: out, length: 0, height: 0, title: '' };
  const b = room.boundary;
  const L = e.length;
  const dir = norm(sub(e.end, e.start));
  // nhìn từ trong phòng ra tường: với phòng vẽ ngược chiều kim đồng hồ, đầu cạnh nằm bên phải
  const flip = startIsRight(room);
  const X = (p: Point) => (flip ? L - dot(sub(p, e.start), dir) : dot(sub(p, e.start), dir));
  const levels = room.heights.filter((h) => h.value != null && h.value > 0);
  const slab = levels.find((h) => h.type === 'slab');
  const H = slab?.value ?? Math.max(DEFAULT_WALL_H, ...levels.map((h) => h.value!));
  const th = textHeight;
  const P = (x: number, y: number): Point => ({ x, y });
  const line = (a: Point, c: Point, layer: Prim['layer'] = 'ELEV') => out.push({ t: 'line', layer, a, b: c });
  const rect = (x0: number, y0: number, x1: number, y1: number, layer: Prim['layer'], dashed = false) =>
    out.push({ t: 'poly', layer: dashed ? 'OPENING' : layer, pts: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], closed: true });
  const text = (p: Point, s: string, h = th, align: 'left' | 'center' | 'right' = 'center', layer: Prim['layer'] = 'TEXT', valign: 'bottom' | 'middle' | 'top' = 'middle') =>
    out.push({ t: 'text', layer, p, text: s, h, rot: 0, align, valign });
  const vdim = (x: number, y0: number, y1: number, label?: string) => {
    if (Math.abs(y1 - y0) < 1) return;
    out.push({ t: 'dim', layer: 'DIMENSION', a: P(x, y0), b: P(x, y1), off: P(th * 1.2, 0), text: label ?? fmtMM(y1 - y0), h: th * 0.8 });
  };

  // khung tường + sàn
  line(P(-th * 3, 0), P(L + th * 3, 0));
  line(P(0, 0), P(0, H));
  line(P(L, 0), P(L, H));
  line(P(0, H), P(L, H));
  text(P(L / 2, H + th * 1.6), `MẶT ĐỨNG ${room.name.toUpperCase()} — dài ${fmtMM(L)}`, th * 1.3, 'center', 'TEXT', 'bottom');
  // các cao độ trần / dầm
  levels
    .filter((h) => h !== slab)
    .forEach((h, k) => {
      const y = h.value!;
      out.push({ t: 'line', layer: 'CEILING', a: P(0, y), b: P(L, y) });
      text(P(th * 0.4 + k * 0, y - th * 0.3), `${h.label || HEIGHT_TYPE_LABEL[h.type]} +${fmtMM(y)}`, th * 0.8, 'left', 'CEILING', 'top');
    });
  // cao độ trần (bên phải)
  [...levels].sort((p, q) => q.value! - p.value!).forEach((h, k) => {
    out.push({ t: 'dim', layer: 'DIMENSION', a: P(L, 0), b: P(L, h.value!), off: P(th * (2.5 + k * 2.6), 0), text: fmtMM(h.value!), h: th * 0.8, start: th * 0.5 });
  });
  if (slab) text(P(L - th * 0.4, H - th * 0.3), `${slab.label || 'Trần bê tông'} +${fmtMM(H)}`, th * 0.8, 'right', 'TEXT', 'top');
  else text(P(L - th * 0.4, H - th * 0.3), `Chiều cao tường giả định ${fmtMM(H)} (chưa đo trần)`, th * 0.75, 'right', 'CEILING', 'top');

  // cửa, cửa sổ, ô mở
  const breaks: number[] = [0, L];
  const doorSpans: [number, number][] = [];
  for (const i of e.segs) {
    const seg = b.segments[i];
    if (seg.kind === 'wall' || seg.kind === 'partition') continue;
    const [p, q] = segEnds(b, i);
    const x0 = Math.min(X(p), X(q));
    const x1 = Math.max(X(p), X(q));
    const w = dist(p, q);
    breaks.push(x0, x1);
    if (seg.kind === 'door') {
      const hh = seg.door?.height;
      const known = hh != null;
      const top = hh ?? 2100;
      rect(x0, 0, x1, top, 'DOOR', !known);
      doorSpans.push([x0, x1]);
      // cánh cửa: đường chéo chỉ hướng bản lề
      const hingeLeft = (seg.door?.hinge === 'end') !== (X(p) > X(q));
      line(P(hingeLeft ? x0 : x1, 0), P(hingeLeft ? x1 : x0, top / 2), 'DOOR');
      line(P(hingeLeft ? x1 : x0, top / 2), P(hingeLeft ? x0 : x1, top), 'DOOR');
      const ref = seg.door?.measureRef ? ` (${MEASURE_REF_LABEL[seg.door.measureRef].toLowerCase()})` : '';
      text(P((x0 + x1) / 2, top + th * 0.9), `Cửa đi ${fmtMM(w)} × ${known ? fmtMM(top) : '?'}${ref}`, th * 0.8, 'center', 'DOOR', 'bottom');
      if (known) vdim(x1, 0, top);
    } else if (seg.kind === 'window') {
      const sill = seg.window?.sillHeight;
      const hh = seg.window?.height;
      const known = sill != null && hh != null;
      const y0 = sill ?? 900;
      const y1 = y0 + (hh ?? 1400);
      rect(x0, y0, x1, y1, 'WINDOW', !known);
      line(P((x0 + x1) / 2, y0), P((x0 + x1) / 2, y1), 'WINDOW');
      const ref = seg.window?.measureRef ? ` (${MEASURE_REF_LABEL[seg.window.measureRef].toLowerCase()})` : '';
      text(P((x0 + x1) / 2, y1 + th * 0.9), `Cửa sổ ${fmtMM(w)} × ${hh != null ? fmtMM(hh) : '?'}${ref}`, th * 0.8, 'center', 'WINDOW', 'bottom');
      if (!known) text(P((x0 + x1) / 2, (y0 + y1) / 2), 'chưa đo cao độ', th * 0.7, 'center', 'OPENING');
      if (sill != null) vdim(x1, 0, sill);
      if (sill != null && hh != null) vdim(x1 + th * 2.6, 0, sill + hh);
    } else {
      const hh = seg.opening?.height;
      rect(x0, 0, x1, hh ?? 2100, 'OPENING', true);
      text(P((x0 + x1) / 2, (hh ?? 2100) + th * 0.9), `Ô mở ${fmtMM(w)} × ${hh != null ? fmtMM(hh) : '?'}`, th * 0.8, 'center', 'OPENING', 'bottom');
      doorSpans.push([x0, x1]);
    }
  }

  // len chân tường
  const info = elevationInfo(room, e);
  if (info.baseboard != null && info.baseboard > 0) {
    const bb = info.baseboard;
    const spans = [...doorSpans].sort((p, q) => p[0] - q[0]);
    let x = 0;
    for (const [s0, s1] of [...spans, [L, L] as [number, number]]) {
      if (s0 > x + 1) line(P(x, bb), P(s0, bb), 'ELEV');
      x = Math.max(x, s1);
    }
    text(P(th * 0.4, bb + th * 0.3), `Len chân tường cao ${fmtMM(bb)}`, th * 0.7, 'left', 'TEXT', 'bottom');
    vdim(-th * 1.5 - th * 1.2, 0, bb);
  }

  // thiết bị trên tường
  const fx = fixturesOnEdge(room, e);
  const stagger = new Map<number, number>();
  for (const f of fx) {
    const p = fixturePos(room, f);
    const x = X(p);
    const { y, known } = fixtureElevCenter(f);
    breaks.push(x);
    rect(x - f.w / 2, y - f.h / 2, x + f.w / 2, y + f.h / 2, 'FIXTURE', !known);
    const r = Math.min(40, Math.max(15, Math.min(f.w, f.h) / 4));
    line(P(x - r * 2, y), P(x + r * 2, y), 'FIXTURE');
    line(P(x, y - r * 2), P(x, y + r * 2), 'FIXTURE');
    text(P(x, y + f.h / 2 + th * 0.5), fixtureTag(room, f) + (known ? '' : ' (chưa đo cao)'), th * 0.75, 'center', 'FIXTURE', 'bottom');
    if (known) {
      const refY = f.heightRef === 'bottom' ? y - f.h / 2 : f.heightRef === 'top' ? y + f.h / 2 : y;
      const k = stagger.get(Math.round(x / 200)) ?? 0;
      stagger.set(Math.round(x / 200), k + 1);
      vdim(x + f.w / 2 + th * 0.5 + k * th * 2.4, 0, refY);
    }
  }

  // ghi chú
  for (const n of info.notes) {
    out.push({ t: 'arc', layer: 'TEXT', c: P(n.x, n.y), r: th * 0.25, a0: 0, a1: 360 });
    text(P(n.x + th * 0.6, n.y), n.text, th * 0.8, 'left', 'TEXT');
  }

  // chuỗi kích thước ngang dưới chân tường + tổng
  const xs = [...new Set(breaks.map((v) => Math.round(v * 10) / 10))].sort((p, q) => p - q);
  for (let k = 0; k + 1 < xs.length; k++) {
    if (xs[k + 1] - xs[k] < 1) continue;
    out.push({ t: 'dim', layer: 'DIMENSION', a: P(xs[k], 0), b: P(xs[k + 1], 0), off: P(0, -th * 2.6), text: fmtMM(xs[k + 1] - xs[k]), h: th * 0.8, start: th * 0.4 });
  }
  if (xs.length > 2) out.push({ t: 'dim', layer: 'DIMENSION', a: P(0, 0), b: P(L, 0), off: P(0, -th * 5), text: fmtMM(L), h: th * 0.8, start: th * 0.4 });

  return { prims: out, length: L, height: H, title: `${room.name} — tường dài ${fmtMM(L)}` };
}

/** Số thứ tự mảng tường (theo danh sách cạnh) */
export function wallNumber(room: Room, segIdx: number): number {
  return edges(room.boundary).findIndex((x) => x.segs.includes(segIdx)) + 1;
}

export const segLen = segLength;
