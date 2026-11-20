/**
 * BỘ TẠO BẢN VẼ: chuyển dữ liệu hình học phòng → danh sách đối tượng vẽ (line, polyline, arc, text, dim)
 * theo tọa độ thực mm. Dùng chung cho hiển thị, PNG/JPG, PDF và DXF.
 */
import type { Floor, Point, Room } from '../model/types';
import { HEIGHT_TYPE_LABEL } from '../model/types';
import type { Drawing, Layer, Prim } from './primitives';
import { computeWallGeometry, type SegWallGeom } from '../geometry/walls';
import { edges, innerArea, isOpeningKind, isSolidKind, segLength, totalLength } from '../geometry/boundary';
import { add, angleDeg, dist, lerp, mul, sub, norm } from '../geometry/vec';
import { labelPoint } from '../geometry/polygon';

export interface DrawOptions {
  dims: boolean;
  labels: boolean;
  zones: boolean;
  fill: boolean;
  axis: boolean;
  /** Chiều cao chữ (mm thực). 125 ≈ 2,5 mm khi in tỷ lệ 1:50 */
  textHeight: number;
  partitionThickness: number;
}

export const DEFAULT_DRAW: DrawOptions = { dims: true, labels: true, zones: true, fill: true, axis: true, textHeight: 125, partitionThickness: 100 };

export const fmtMM = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
};
export const fmtM2 = (mm2: number) => (mm2 / 1e6).toFixed(2).replace('.', ',') + ' m²';

export function buildRoomPrims(room: Room, o: DrawOptions): Prim[] {
  const prims: Prim[] = [];
  const b = room.boundary;
  if (b.vertices.length < 2 || !b.segments.length) return prims;
  const g = computeWallGeometry(b, { defaultThickness: room.defaultThickness, partitionThickness: o.partitionThickness });

  // 1) Thân tường (tô nền) — chỉ đoạn đặc
  if (o.fill) {
    for (const s of g.segs) if (isSolidKind(b.segments[s.index].kind)) prims.push({ t: 'fill', layer: 'WALL_FILL', pts: [s.innerStart, s.innerEnd, s.outerEnd, s.outerStart] });
  }
  if (o.fill) for (const run of g.runs) for (const c of run.caps) prims.push({ t: 'fill', layer: 'WALL_FILL', pts: c });
  // 2) Đường biên trong & ngoài theo từng dải tường liên tục (ngắt tại vị trí cửa)
  for (const run of g.runs) {
    prims.push({ t: 'poly', layer: 'WALL_INNER', pts: run.inner, closed: run.ring });
    prims.push({ t: 'poly', layer: 'WALL_OUTER', pts: run.outer, closed: run.ring });
  }
  // 3) Cửa đi, cửa sổ, ô mở
  for (const s of g.segs) {
    const seg = b.segments[s.index];
    if (!isOpeningKind(seg.kind)) continue;
    prims.push(...openingPrims(room, s, o));
  }
  // 4) Kích thước
  if (o.dims) prims.push(...dimPrims(room, g.segs, o));
  // 5) Vùng trần
  if (o.zones) {
    for (const z of room.zones) {
      if (z.polygon.length < 3) continue;
      prims.push({ t: 'poly', layer: 'CEILING', pts: z.polygon, closed: true });
      const lv = room.heights.find((h) => h.id === z.levelId);
      // nhãn vùng đặt ở góc trên-trái của vùng để không đè nhãn phòng
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      const pad = o.textHeight * 0.6;
      prims.push({ t: 'text', layer: 'CEILING', p: { x: Math.min(...xs) + pad, y: Math.max(...ys) - pad }, text: `${z.name}${lv ? ` — ${lv.label}: ${lv.value != null ? '+' + fmtMM(lv.value) : 'chưa đo'}` : ''}`, h: o.textHeight * 0.75, rot: 0, align: 'left', valign: 'top' });
    }
  }
  // 6) Nhãn phòng
  if (o.labels && b.closed && b.vertices.length >= 3) {
    const lp = labelPoint(b.vertices);
    const lines = [room.name, `S = ${fmtM2(innerArea(b))} · P = ${fmtMM(totalLength(b))}`];
    const hs = room.heights.filter((h) => h.value != null && !room.zones.some((z) => z.levelId === h.id));
    for (const h of hs.slice(0, 3)) lines.push(`${h.label || HEIGHT_TYPE_LABEL[h.type]}: +${fmtMM(h.value!)}`);
    const th = o.textHeight;
    lines.forEach((t, k) => {
      prims.push({ t: 'text', layer: 'TEXT', p: { x: lp.x, y: lp.y + ((lines.length - 1) / 2 - k) * th * 1.6 }, text: t, h: k === 0 ? th * 1.2 : th * 0.85, rot: 0, align: 'center', valign: 'middle' });
    });
  }
  return prims;
}

function openingPrims(room: Room, s: SegWallGeom, o: DrawOptions): Prim[] {
  const seg = room.boundary.segments[s.index];
  const out: Prim[] = [];
  const a = s.innerStart;
  const b = s.innerEnd;
  const N = s.normal;
  const t = s.thickness;
  const w = dist(a, b);
  const oa = add(a, mul(N, t));
  const ob = add(b, mul(N, t));
  const at = (k: number): [Point, Point] => [add(a, mul(N, t * k)), add(b, mul(N, t * k))];
  const L = (layer: Layer, p: Point, q: Point) => out.push({ t: 'line', layer, a: p, b: q });

  if (seg.kind === 'window') {
    L('WINDOW', a, b);
    L('WINDOW', oa, ob);
    const [m1, m2] = at(0.42);
    const [n1, n2] = at(0.58);
    L('WINDOW', m1, m2);
    L('WINDOW', n1, n2);
  } else if (seg.kind === 'opening') {
    L('OPENING', a, b);
    L('OPENING', oa, ob);
  } else if (seg.kind === 'door') {
    const d = seg.door!;
    const style = d.style ?? 'single';
    const inward = d.swing !== 'out';
    const leafDir = inward ? mul(N, -1) : N;
    const face: [Point, Point] = inward ? [a, b] : [oa, ob];
    // ngưỡng cửa mảnh trên mặt tường phía mở
    if (style === 'sliding') {
      const mid = lerp(a, b, 0.5);
      const dir = s.dir;
      const p1a = a;
      const p1b = add(mid, mul(dir, 50));
      const p2a = sub(mid, mul(dir, 50));
      const p2b = b;
      const panel = (pa: Point, pb: Point, k: number) => {
        const off = mul(N, t * k);
        const dep = mul(N, Math.min(40, t * 0.25));
        out.push({ t: 'poly', layer: 'DOOR', pts: [add(pa, off), add(pb, off), add(add(pb, off), dep), add(add(pa, off), dep)], closed: true });
      };
      panel(p1a, p1b, 0.25);
      panel(p2a, p2b, 0.55);
    } else if (style === 'double') {
      const half = w / 2;
      leaf(out, face[0], face[1], leafDir, half);
      leaf(out, face[1], face[0], leafDir, half);
    } else {
      const [h, far] = d.hinge === 'end' ? [face[1], face[0]] : [face[0], face[1]];
      leaf(out, h, far, leafDir, w);
    }
  }
  // nhãn cửa đặt phía trong phòng (phía ngoài dành cho kích thước)
  if (o.labels) {
    const mid = lerp(a, b, 0.5);
    const p = add(mid, mul(N, -o.textHeight * 1.2));
    let txt = '';
    if (seg.kind === 'door') txt = `Cửa đi ${fmtMM(w)}${seg.door?.height != null ? ' × ' + fmtMM(seg.door.height) : ''}`;
    else if (seg.kind === 'window') {
      txt = `Cửa sổ ${fmtMM(w)}`;
      if (seg.window?.height != null) txt += ` × ${fmtMM(seg.window.height)}`;
      if (seg.window?.sillHeight != null) txt += ` (bậu ${fmtMM(seg.window.sillHeight)})`;
    } else txt = `Ô mở ${fmtMM(w)}${seg.opening?.height != null ? ' × ' + fmtMM(seg.opening.height) : ''}`;
    out.push({ t: 'text', layer: 'TEXT', p, text: txt, h: o.textHeight * 0.75, rot: readableAngle(angleDeg(s.dir)), align: 'center', valign: 'middle' });
  }
  return out;
}

/** Cánh cửa mở 90° + cung quét */
function leaf(out: Prim[], hinge: Point, far: Point, leafDir: Point, w: number) {
  const tip = add(hinge, mul(leafDir, w));
  out.push({ t: 'line', layer: 'DOOR', a: hinge, b: tip });
  const A = angleDeg(sub(tip, hinge));
  const farPt = add(hinge, mul(norm(sub(far, hinge)), w));
  const B = angleDeg(sub(farPt, hinge));
  const sweep = (B - A + 360) % 360;
  if (sweep <= 180) out.push({ t: 'arc', layer: 'DOOR', c: hinge, r: w, a0: A, a1: B });
  else out.push({ t: 'arc', layer: 'DOOR', c: hinge, r: w, a0: B, a1: A });
}

/** Góc chữ đọc được (không lộn ngược) */
export function readableAngle(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  if (a > 90.01 && a <= 270.01) a -= 180;
  if (a > 180) a -= 360;
  return a;
}

/**
 * Kích thước: đặt phía NGOÀI tường (theo thói quen bản vẽ kiến trúc), số ghi là kích thước thông thủy
 * đo theo mặt trong tường (số đo gốc).
 * - Cạnh có nhiều đoạn (tường + cửa + tường): hàng trong là chuỗi từng đoạn, hàng ngoài là tổng cạnh.
 * - Cạnh một đoạn: một kích thước duy nhất.
 * Đường gióng bắt đầu từ mặt ngoài tường, không cắt qua thân tường.
 */
function dimPrims(room: Room, segs: SegWallGeom[], o: DrawOptions): Prim[] {
  const b = room.boundary;
  const out: Prim[] = [];
  const th = o.textHeight * 0.8;
  const o1 = o.textHeight * 2.6;
  const o2 = o.textHeight * 4.8;
  for (const e of edges(b)) {
    const N = segs[e.segs[0]].normal;
    const tMax = Math.max(...e.segs.map((i) => segs[i].thickness));
    const start = tMax + o.textHeight * 0.4;
    if (e.segs.length > 1) {
      for (const i of e.segs) {
        const s = segs[i];
        out.push({ t: 'dim', layer: 'DIMENSION', a: s.innerStart, b: s.innerEnd, off: mul(N, tMax + o1), text: fmtMM(segLength(b, i)), h: th, start });
      }
      out.push({ t: 'dim', layer: 'DIMENSION', a: e.start, b: e.end, off: mul(N, tMax + o2), text: fmtMM(e.length), h: th, start });
    } else {
      out.push({ t: 'dim', layer: 'DIMENSION', a: e.start, b: e.end, off: mul(N, tMax + o1), text: fmtMM(e.length), h: th, start });
    }
  }
  return out;
}

/** Tách kích thước thành các nét cơ bản: đường gióng, đường kích thước, nét gạch chéo, chữ */
export function explodeDim(d: Extract<Prim, { t: 'dim' }>): Prim[] {
  const out: Prim[] = [];
  const offLen = Math.hypot(d.off.x, d.off.y);
  const n = offLen > 0 ? mul(d.off, 1 / offLen) : { x: 0, y: 0 };
  const gap = d.start != null ? Math.min(d.start, offLen - d.h * 0.3) : Math.min(offLen * 0.15, d.h * 0.6);
  const ext = d.h * 0.5;
  const pa = add(d.a, d.off);
  const pb = add(d.b, d.off);
  out.push({ t: 'line', layer: d.layer, a: add(d.a, mul(n, gap)), b: add(pa, mul(n, ext)) });
  out.push({ t: 'line', layer: d.layer, a: add(d.b, mul(n, gap)), b: add(pb, mul(n, ext)) });
  out.push({ t: 'line', layer: d.layer, a: pa, b: pb });
  const dir = norm(sub(d.b, d.a));
  const tick = mul(norm(add(dir, n)), d.h * 0.45);
  for (const p of [pa, pb]) out.push({ t: 'line', layer: d.layer, a: sub(p, tick), b: add(p, tick) });
  const rot = readableAngle(angleDeg(dir));
  // chữ nằm phía xa tường của đường kích thước
  const mid = lerp(pa, pb, 0.5);
  out.push({ t: 'text', layer: d.layer, p: add(mid, mul(n, d.h * 0.25)), text: d.text, h: d.h, rot, align: 'center', valign: textValign(rot, dir, n) });
  return out;
}

/** Căn chữ sao cho chữ nằm về phía pháp tuyến n so với đường kích thước */
function textValign(rot: number, _dir: Point, n: Point): 'bottom' | 'top' {
  const r = (rot * Math.PI) / 180;
  const up = { x: -Math.sin(r), y: Math.cos(r) };
  return up.x * n.x + up.y * n.y >= 0 ? 'bottom' : 'top';
}

export function axisPrims(len = 1000, h = 125): Prim[] {
  return [
    { t: 'line', layer: 'AXIS', a: { x: 0, y: 0 }, b: { x: len, y: 0 } },
    { t: 'line', layer: 'AXIS', a: { x: 0, y: 0 }, b: { x: 0, y: len } },
    { t: 'line', layer: 'AXIS', a: { x: len, y: 0 }, b: { x: len - 120, y: 50 } },
    { t: 'line', layer: 'AXIS', a: { x: len, y: 0 }, b: { x: len - 120, y: -50 } },
    { t: 'line', layer: 'AXIS', a: { x: 0, y: len }, b: { x: 50, y: len - 120 } },
    { t: 'line', layer: 'AXIS', a: { x: 0, y: len }, b: { x: -50, y: len - 120 } },
    { t: 'text', layer: 'AXIS', p: { x: len + 60, y: 0 }, text: 'X', h, rot: 0, align: 'left', valign: 'middle' },
    { t: 'text', layer: 'AXIS', p: { x: 0, y: len + 60 }, text: 'Y', h, rot: 0, align: 'center', valign: 'bottom' },
  ];
}

export function buildDrawing(rooms: Room[], o: DrawOptions = DEFAULT_DRAW): Drawing {
  const prims: Prim[] = [];
  for (const r of rooms) prims.push(...buildRoomPrims(r, o));
  if (o.axis) prims.push(...axisPrims(1000, o.textHeight));
  return { prims, bounds: primsBounds(prims) };
}

export function buildFloorDrawing(floor: Floor, o: DrawOptions = DEFAULT_DRAW): Drawing {
  return buildDrawing(floor.rooms, o);
}

export function primsBounds(prims: Prim[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const addP = (p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const p of prims) {
    if (p.t === 'line') {
      addP(p.a);
      addP(p.b);
    } else if (p.t === 'poly' || p.t === 'fill') p.pts.forEach(addP);
    else if (p.t === 'arc') {
      addP({ x: p.c.x - p.r, y: p.c.y - p.r });
      addP({ x: p.c.x + p.r, y: p.c.y + p.r });
    } else if (p.t === 'text') addP(p.p);
    else if (p.t === 'dim') {
      addP(add(p.a, p.off));
      addP(add(p.b, p.off));
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** Danh sách nét đã tách kích thước — dùng cho exporter */
export function flatten(prims: Prim[]): Prim[] {
  const out: Prim[] = [];
  for (const p of prims) {
    if (p.t === 'dim') out.push(...explodeDim(p));
    else out.push(p);
  }
  return out;
}
