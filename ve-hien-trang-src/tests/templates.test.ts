import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildTemplate } from '../src/model/templates';
import { edges, innerArea, segLength } from '../src/geometry/boundary';
import { moveEdge, stretchRoom } from '../src/model/ops';
import { buildBoundary } from '../src/model/sample';
import { buildDrawing, DEFAULT_DRAW } from '../src/drawing/buildDrawing';
import { newRoom } from '../src/model/factory';
import { pointInPolygon } from '../src/geometry/polygon';
import { add } from '../src/geometry/vec';
import { makeZip, crc32 } from '../src/export/zip';

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('Thư viện mặt bằng mẫu', () => {
  for (const t of TEMPLATES) {
    it(`${t.name}: khép kín, đúng kích thước bao, cửa đúng bề rộng`, () => {
      const b = buildTemplate(t, t.w, t.d);
      expect(b.closed).toBe(true);
      const xs = b.vertices.map((v) => v.x);
      const ys = b.vertices.map((v) => v.y);
      close(Math.max(...xs) - Math.min(...xs), t.w, 1e-3);
      close(Math.max(...ys) - Math.min(...ys), t.d, 1e-3);
      expect(innerArea(b)).toBeGreaterThan(0);
      // co giãn theo kích thước khác vẫn hợp lệ
      const b2 = buildTemplate(t, t.w + 700, t.d + 500);
      expect(b2.closed).toBe(true);
    });
  }
  it('Phòng ngủ: cửa đi 900 + cửa sổ 1400', () => {
    const b = buildTemplate(TEMPLATES.find((x) => x.id === 'bedroom')!, 3300, 3600);
    const door = b.segments.findIndex((s) => s.kind === 'door');
    const win = b.segments.findIndex((s) => s.kind === 'window');
    close(segLength(b, door), 900);
    close(segLength(b, win), 1400);
    expect(b.segments[win].window!.sillHeight).toBeNull(); // chưa đo, không tự điền gợi ý
  });
});

describe('Co kéo', () => {
  const base = buildBoundary({ x: 0, y: 0 }, [[300, 0], [900, 0, 'door'], [2100, 0], [3600, 90], [3300, 180]]);
  it('kéo cạnh trên ra ngoài 400: phòng sâu thêm 400, cửa không đổi', () => {
    const top = base.segments.length - 2; // đoạn 3300 hướng 180
    const r = moveEdge(base, top, 400).boundary;
    close(innerArea(r), 3300 * 4000);
    close(segLength(r, 1), 900);
    expect(r.vertices[0]).toEqual({ x: 0, y: 0 });
  });
  it('kéo cạnh có cửa: cả cạnh (tường + cửa + tường) dời cùng nhau', () => {
    const r = moveEdge(base, 1, -200).boundary; // chạm vào đoạn cửa
    close(innerArea(r), 3300 * 3400);
    expect(edges(r).find((e) => e.segs.length === 3)!.start.y).toBe(200); // thu vào 200 = cạnh dưới dời lên
  });
  it('co giãn cả phòng theo X không cắt qua cửa', () => {
    const room = { boundary: structuredClone(base), zones: [] as { polygon: { x: number; y: number }[] }[] };
    stretchRoom(room, 'x', 4000);
    close(innerArea(room.boundary), 4000 * 3600);
    close(segLength(room.boundary, 1), 900);
    expect(() => stretchRoom(room, 'x', 50)).toThrow();
  });
});

describe('Kích thước nằm ngoài tường', () => {
  it('mọi đường kích thước của phòng chữ nhật đều ở ngoài đường biên ngoài', () => {
    const r = newRoom('t');
    r.boundary = buildBoundary({ x: 0, y: 0 }, [[4000, 0], [5000, 90], [4000, 180]]);
    const dims = buildDrawing([r], { ...DEFAULT_DRAW, axis: false }).prims.filter((p) => p.t === 'dim') as any[];
    expect(dims.length).toBe(4);
    for (const d of dims) {
      const p = add(d.a, d.off);
      expect(pointInPolygon(p, [{ x: -140, y: -140 }, { x: 4140, y: -140 }, { x: 4140, y: 5140 }, { x: -140, y: 5140 }])).toBe(false);
    }
  });
});

describe('ZIP', () => {
  it('CRC32 chuẩn và cấu trúc file', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const z = makeZip([{ name: 'a.dxf', data: new TextEncoder().encode('hello') }]);
    expect(z[0]).toBe(0x50);
    expect(z[1]).toBe(0x4b);
  });
});
