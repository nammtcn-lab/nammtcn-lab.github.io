import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildTemplateRooms } from '../src/model/templates';
import { newFixture, newRoom } from '../src/model/factory';
import { buildBoundary } from '../src/model/sample';
import { attachToWall, cornerDistances, fixturePos, startIsRight } from '../src/geometry/fixtures';
import { moveEdge } from '../src/model/ops';
import { buildElevation, fixturesOnEdge, edgeOf } from '../src/drawing/elevation';
import { buildDrawing, DEFAULT_DRAW } from '../src/drawing/buildDrawing';
import { writeDxf } from '../src/export/dxf';
import { segEnds } from '../src/geometry/boundary';
import { mkdirSync, writeFileSync } from 'node:fs';

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

function bedroom() {
  const r = newRoom('Phòng ngủ');
  r.boundary = buildBoundary({ x: 0, y: 0 }, [[300, 0], [900, 0, 'door'], [2100, 0], [3600, 90], [950, 180], [1400, 180, 'window'], [950, 180], [3600, 270]]);
  return r;
}

describe('Thiết bị theo tim', () => {
  it('gắn ổ cắm vào tường gần nhất, tính khoảng cách tới 2 góc', () => {
    const r = bedroom();
    const at = attachToWall(r, { x: 3290, y: 1000 })!;
    const f = newFixture('socket', at.point, at.segId, at.offset);
    f.height = 400;
    r.fixtures.push(f);
    expect(fixturePos(r, f)).toEqual({ x: 3300, y: 1000 });
    const cd = cornerDistances(r, f)!;
    close(cd.fromStart, 1000);
    close(cd.fromEnd, 2600);
  });
  it('thiết bị đi theo tường khi kéo cạnh', () => {
    const r = bedroom();
    const at = attachToWall(r, { x: 3300, y: 1000 })!;
    const f = newFixture('switch', at.point, at.segId, at.offset);
    r.fixtures.push(f);
    const i = r.boundary.segments.findIndex((s) => s.id === at.segId);
    r.boundary = moveEdge(r.boundary, i, 500).boundary;
    expect(fixturePos(r, f)).toEqual({ x: 3800, y: 1000 });
  });
  it('lắp ngang/dọc: kích thước mặt khác nhau trên mặt đứng', () => {
    const f = newFixture('socket', { x: 0, y: 0 });
    expect([f.w, f.h]).toEqual([120, 70]);
    expect(f.height).toBeNull(); // không tự điền cao độ gợi ý
  });
  it('mặt bằng có ký hiệu thiết bị trên layer FIXTURE và DXF hợp lệ', () => {
    const r = bedroom();
    const at = attachToWall(r, { x: 3300, y: 1000 })!;
    r.fixtures.push(newFixture('ac', at.point, at.segId, at.offset));
    r.fixtures.push(newFixture('wc', { x: 1500, y: 3200 }));
    const prims = buildDrawing([r], DEFAULT_DRAW).prims;
    expect(prims.filter((p) => p.layer === 'FIXTURE').length).toBeGreaterThan(6);
    const dxf = writeDxf(prims);
    expect(dxf).toMatch(/\n  8\nFIXTURE\n/);
  });
});

describe('Mặt đứng mảng tường', () => {
  it('nhìn từ trong phòng: tường có cửa sổ, thiết bị và len chân tường', () => {
    const r = bedroom();
    r.heights.push({ id: 'h1', type: 'slab', label: 'Trần bê tông', value: 3200, note: '' });
    const winIdx = r.boundary.segments.findIndex((s) => s.kind === 'window');
    r.boundary.segments[winIdx].window = { sillHeight: 900, height: 1400, style: null, note: '', measureRef: 'trimOuter' };
    const at = attachToWall(r, { x: 300, y: 3600 })!;
    const f = newFixture('socket', at.point, at.segId, at.offset);
    f.height = 400;
    r.fixtures.push(f);
    const e = edgeOf(r, winIdx)!;
    r.elevations[r.boundary.segments[e.segs[0]].id] = { baseboard: 100, notes: [{ id: 'n', text: 'Ống nước nổi', x: 1000, y: 600 }] };
    expect(fixturesOnEdge(r, e).length).toBe(1);
    const el = buildElevation(r, winIdx, 100);
    close(el.length, 3300);
    expect(el.height).toBe(3200);
    const texts = el.prims.filter((p) => p.t === 'text').map((p: any) => p.text);
    expect(texts.some((t) => t.includes('Cửa sổ 1400 × 1400') && t.includes('ngoài nẹp khuôn'))).toBe(true);
    expect(texts.some((t) => t.includes('Len chân tường cao 100'))).toBe(true);
    expect(texts).toContain('Ống nước nổi');
    // ổ cắm ở x=300 trên mặt bằng (cạnh trên đi từ phải sang trái) → nhìn từ trong phòng nằm bên phải: x_elev = 3300 - 300?
    expect(startIsRight(r)).toBe(true);
    const fx = el.prims.find((p) => p.t === 'poly' && p.layer === 'FIXTURE') as any;
    const cx = (fx.pts[0].x + fx.pts[1].x) / 2;
    const cy = (fx.pts[0].y + fx.pts[2].y) / 2;
    close(cx, 300); // cạnh trên đi từ (3300,3600) về (0,3600): điểm x=300 cách đầu cạnh 3000 → x_elev = 3300-3000
    close(cy, 400);
    mkdirSync('tests/out', { recursive: true });
    writeFileSync('tests/out/elevation.dxf', writeDxf(el.prims));
  });
});

describe('Mẫu phòng ngủ + WC trong phòng', () => {
  it('2 phòng, cửa WC trùng vị trí lỗ cửa phía phòng ngủ, vách 100', () => {
    const t = TEMPLATES.find((x) => x.id === 'ensuite')!;
    const rooms = buildTemplateRooms(t, 4200, 4500);
    expect(rooms.length).toBe(2);
    const [bed, wc] = rooms;
    expect(bed.boundary.closed && wc.boundary.closed).toBe(true);
    const oi = bed.boundary.segments.findIndex((s) => s.kind === 'opening');
    const di = wc.boundary.segments.findIndex((s) => s.kind === 'door');
    const [o0, o1] = segEnds(bed.boundary, oi);
    const [d0, d1] = segEnds(wc.boundary, di);
    close(o0.x - d0.x, 100);
    close(Math.min(o0.y, o1.y), Math.min(d0.y, d1.y));
    close(Math.max(o0.y, o1.y), Math.max(d0.y, d1.y));
    expect(wc.fixtures.map((f) => f.type).sort()).toEqual(['floorDrain', 'lavabo', 'shower', 'wc']);
    expect(wc.fixtures.filter((f) => f.mount === 'wall').every((f) => f.segId)).toBe(true);
  });
});
