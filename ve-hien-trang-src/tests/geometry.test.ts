import { describe, expect, it } from 'vitest';
import { buildBoundary, sampleProject } from '../src/model/sample';
import { closureGap, edges, innerArea, segLength, totalLength } from '../src/geometry/boundary';
import { computeWallGeometry } from '../src/geometry/walls';
import { area, interiorAngle, signedArea } from '../src/geometry/polygon';
import {
  appendByLength,
  closeChain,
  deleteSegment,
  insertOpening,
  mergeWithNext,
  setKind,
  setSegmentLength,
  splitEqual,
  startChain,
  updateSegment,
} from '../src/model/ops';
import { buildDrawing, DEFAULT_DRAW, flatten } from '../src/drawing/buildDrawing';
import { writeDxf } from '../src/export/dxf';
import { newHeight, newRoom, normalizeProject } from '../src/model/factory';
import type { Room } from '../src/model/types';

const T = { defaultThickness: 140, partitionThickness: 100 };
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

function roomOf(b: Room['boundary'], thickness = 140): Room {
  const r = newRoom('Test', thickness);
  r.boundary = b;
  return r;
}

describe('Bài 1 — Phòng chữ nhật 4000 × 5000, tường 140', () => {
  const b = buildBoundary({ x: 0, y: 0 }, [[4000, 0], [5000, 90], [4000, 180]]);
  it('tọa độ các điểm', () => {
    expect(b.closed).toBe(true);
    expect(b.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 5000 },
      { x: 0, y: 5000 },
    ]);
    expect(b.segments.length).toBe(4);
    close(segLength(b, 3), 5000);
  });
  it('chu vi và diện tích', () => {
    close(totalLength(b), 18000);
    close(innerArea(b), 20_000_000);
  });
  it('offset tường ra ngoài 140 mm, không đổi đường biên trong', () => {
    const before = JSON.stringify(b.vertices);
    const g = computeWallGeometry(b, T);
    expect(JSON.stringify(b.vertices)).toBe(before);
    const outer = g.outerRing.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
    expect(outer).toEqual([
      { x: -140, y: -140 },
      { x: 4140, y: -140 },
      { x: 4140, y: 5140 },
      { x: -140, y: 5140 },
    ]);
    close(area(g.outerRing), 4280 * 5280, 1e-3);
    expect(g.runs.length).toBe(1);
    expect(g.runs[0].ring).toBe(true);
  });
  it('vẽ theo chiều kim đồng hồ vẫn offset ra ngoài', () => {
    const cw = buildBoundary({ x: 0, y: 0 }, [[5000, 90], [4000, 0], [5000, 270]]);
    expect(signedArea(cw.vertices)).toBeLessThan(0);
    const g = computeWallGeometry(cw, T);
    close(area(g.outerRing), 4280 * 5280, 1e-3);
  });
});

describe('Bài 2 — Phòng có cửa sổ: cạnh 4500 = 1200 + 1500 + 1800', () => {
  const b = buildBoundary({ x: 0, y: 0 }, [[1200, 0], [1500, 0, 'window'], [1800, 0], [3000, 90], [4500, 180]]);
  it('tổng chiều dài cạnh và vị trí cửa sổ', () => {
    const e = edges(b);
    expect(e.length).toBe(4);
    const bottom = e.find((x) => x.segs.length === 3)!;
    close(bottom.length, 4500);
    expect(b.segments[1].kind).toBe('window');
    expect(b.vertices[1]).toEqual({ x: 1200, y: 0 });
    expect(b.vertices[2]).toEqual({ x: 2700, y: 0 });
    close(segLength(b, 1), 1500);
  });
  it('khoảng mở trên hình tường: tường bị ngắt tại cửa sổ', () => {
    const g = computeWallGeometry(b, T);
    expect(g.runs.length).toBe(1); // một dải tường, hở tại cửa sổ
    const run = g.runs[0];
    expect(run.ring).toBe(false);
    // dải tường bắt đầu tại mép cửa sổ (2700,0) và kết thúc tại mép còn lại (1200,0)
    expect(run.inner[0]).toEqual({ x: 2700, y: 0 });
    expect(run.inner[run.inner.length - 1]).toEqual({ x: 1200, y: 0 });
    // biên ngoài có hai cạnh khuôn cửa vuông góc dài đúng 140
    expect(run.outer[0]).toEqual({ x: 2700, y: 0 });
    expect(run.outer[1]).toEqual({ x: 2700, y: -140 });
    expect(run.outer[run.outer.length - 2]).toEqual({ x: 1200, y: -140 });
    // cửa sổ có 4 nét song song trong bề dày tường
    const d = flatten(buildDrawing([roomOf(b)], { ...DEFAULT_DRAW, dims: false, labels: false, axis: false }).prims);
    const win = d.filter((p) => p.layer === 'WINDOW');
    expect(win.length).toBe(4);
  });
  it('chiều rộng cửa sổ khi lưu không cần cao độ bậu, chiều cao', () => {
    expect(b.segments[1].window).toEqual({ sillHeight: null, height: null, style: null, note: '' });
  });
});

describe('Bài 3 — Phòng có cửa đi', () => {
  const b = buildBoundary({ x: 0, y: 0 }, [[600, 0], [900, 0, 'door'], [1700, 0], [3600, 90], [3200, 180]]);
  it('cửa đi đúng vị trí và không phải đoạn tường kín', () => {
    expect(b.segments[1].kind).toBe('door');
    expect(b.vertices[1]).toEqual({ x: 600, y: 0 });
    expect(b.vertices[2]).toEqual({ x: 1500, y: 0 });
    const g = computeWallGeometry(b, T);
    // không đoạn tường nào đi qua khoảng (600..1500, 0)
    for (const run of g.runs) {
      for (let k = 0; k + 1 < run.inner.length; k++) {
        const p = run.inner[k];
        const q = run.inner[k + 1];
        const onBottom = p.y === 0 && q.y === 0;
        if (onBottom) {
          const lo = Math.min(p.x, q.x);
          const hi = Math.max(p.x, q.x);
          expect(hi <= 600 || lo >= 1500).toBe(true);
        }
      }
    }
    const prims = buildDrawing([roomOf(b)], { ...DEFAULT_DRAW, dims: false, labels: false, axis: false }).prims;
    const door = prims.filter((p) => p.layer === 'DOOR');
    expect(door.some((p) => p.t === 'arc')).toBe(true);
    const arc = door.find((p) => p.t === 'arc') as any;
    close(arc.r, 900);
    expect(arc.c).toEqual({ x: 600, y: 0 });
    const sweep = (arc.a1 - arc.a0 + 360) % 360;
    close(sweep, 90, 1e-6);
  });
  it('DXF: cửa xuất trên layer DOOR, tường không liền qua cửa', () => {
    const dxf = writeDxf(buildDrawing([roomOf(b)], { ...DEFAULT_DRAW, axis: false }).prims);
    expect(dxf).toContain('AC1015');
    expect(dxf).toMatch(/\n  8\nDOOR\n/);
    expect(dxf).toMatch(/\nARC\n/);
    expect(dxf).not.toContain('{{');
  });
});

describe('Bài 3b — Cửa đi sát góc phòng', () => {
  it('khuôn cửa vuông góc, góc tường ngoài được giữ', () => {
    const b = buildBoundary({ x: 0, y: 0 }, [[2700, 0], [1300, 0, 'door'], [5000, 90], [4000, 180]]);
    const g = computeWallGeometry(b, T);
    const run = g.runs[0];
    // dải tường bắt đầu sau cửa tại góc (4000,0): khuôn cửa (4000,-140) rồi góc ngoài (4140,-140)
    expect(run.inner[0]).toEqual({ x: 4000, y: 0 });
    expect(run.outer.slice(0, 3)).toEqual([{ x: 4000, y: 0 }, { x: 4000, y: -140 }, { x: 4140, y: -140 }]);
    expect(run.caps.length).toBe(1);
  });
});

describe('Bài 4 — Phòng có cạnh chéo', () => {
  const b = buildBoundary({ x: 0, y: 0 }, [[3600, 0], [3000, 90], [Math.SQRT2 * 1000, 135], [2600, 180]]);
  it('tọa độ, góc, diện tích', () => {
    expect(b.vertices[3]).toEqual({ x: 2600, y: 4000 });
    close(segLength(b, 2), Math.SQRT2 * 1000, 1e-3);
    close(interiorAngle(b.vertices, 2), 135, 1e-6);
    close(interiorAngle(b.vertices, 3), 135, 1e-6);
    close(innerArea(b), 3600 * 4000 - 500_000, 1e-3);
  });
  it('offset tường tại cạnh chéo: khoảng cách vuông góc đúng 140', () => {
    const g = computeWallGeometry(b, T);
    const s = g.segs[2];
    // khoảng cách từ đường biên ngoài đến đường biên trong của cạnh chéo
    const dx = s.outerStart.x - s.innerStart.x;
    const dy = s.outerStart.y - s.innerStart.y;
    close(Math.abs(dx * s.normal.x + dy * s.normal.y), 140, 1e-6);
    // góc 135° ngoài: điểm giao miter = 140 / cos(22.5°)
    close(Math.hypot(dx, dy), 140 / Math.cos(Math.PI / 8), 1e-6);
    // không tự giao: diện tích ngoài > diện tích trong
    expect(area(g.outerRing)).toBeGreaterThan(innerArea(b));
  });
  it('phòng chữ L có góc lõm', () => {
    const L = buildBoundary({ x: 0, y: 0 }, [[3000, 0], [2000, 90], [1500, 180], [3000, 90], [1500, 180]]);
    const g = computeWallGeometry(L, T);
    // góc lõm tại (1500,2000): điểm ngoài = (1640, 2140)
    const reflex = g.segs[3].outerStart;
    expect(g.segs[2].outerEnd).toEqual(reflex);
    close(reflex.x, 1640);
    close(reflex.y, 2140);
  });
});

describe('Bài 5 — Chỉnh sửa', () => {
  const base = buildBoundary({ x: 0, y: 0 }, [[4000, 0], [3000, 90], [4000, 180]]);
  it('đổi chiều dài (dời phần phía sau) — báo đoạn khép kín thay đổi', () => {
    const r = setSegmentLength(base, 0, 4500, 'shift');
    close(segLength(r.boundary, 0), 4500);
    close(segLength(r.boundary, 1), 3000);
    close(segLength(r.boundary, 2), 4000);
    expect(r.message).toMatch(/đoạn 4/);
  });
  it('đổi chiều dài (chỉ dời điểm cuối)', () => {
    const r = setSegmentLength(base, 0, 4500, 'moveEnd');
    close(segLength(r.boundary, 0), 4500);
    expect(r.boundary.vertices[2]).toEqual({ x: 4000, y: 3000 });
  });
  it('chuyển đoạn tường thành cửa sổ & chèn cửa sổ vào tường', () => {
    const r1 = setKind(base, 2, 'window');
    expect(r1.boundary.segments[2].kind).toBe('window');
    const r2 = insertOpening(base, 0, 1200, 1500, 'window');
    expect(r2.boundary.segments.length).toBe(6);
    expect(r2.boundary.segments.map((s) => s.kind).slice(0, 3)).toEqual(['wall', 'window', 'wall']);
    close(segLength(r2.boundary, 0), 1200);
    close(segLength(r2.boundary, 1), 1500);
    close(segLength(r2.boundary, 2), 1300);
    // tổng cạnh không đổi
    close(edges(r2.boundary)[0].length, 4000);
  });
  it('đổi bề dày tường riêng một đoạn → bậc trên biên ngoài, biên trong giữ nguyên', () => {
    const b = insertOpening(base, 0, 1200, 1500, 'window').boundary;
    const b2 = updateSegment(b, 2, { thickness: 220 }).boundary;
    expect(b2.vertices).toEqual(b.vertices);
    const g = computeWallGeometry(b2, T);
    expect(g.segs[2].thickness).toBe(220);
    close(g.segs[2].outerEnd.y, -220);
    // cửa sổ lấy bề dày tường chứa nó gần nhất có giá trị riêng
    expect(g.segs[1].thickness).toBe(220);
  });
  it('chia, gộp, xóa đoạn, khép kín lại', () => {
    const s = splitEqual(base, 0, 4).boundary;
    expect(s.segments.length).toBe(7);
    let m = s;
    for (let k = 0; k < 3; k++) m = mergeWithNext(m, 0).boundary;
    expect(m.segments.length).toBe(4);
    close(segLength(m, 0), 4000);
    const d = deleteSegment(base, 3);
    expect(d.boundary.closed).toBe(false);
    expect(closureGap(d.boundary)).toEqual({ x: 0, y: -3000 });
    const c = closeChain(d.boundary);
    expect(c.boundary.closed).toBe(true);
    close(innerArea(c.boundary), 12_000_000);
  });
  it('vẽ bằng nhập số có sai số khép kín', () => {
    let b = startChain({ vertices: [], segments: [], closed: false }, { x: 0, y: 0 }).boundary;
    b = appendByLength(b, 4000, 0).boundary;
    b = appendByLength(b, 3000, 90).boundary;
    b = appendByLength(b, 3990, 180).boundary;
    b = appendByLength(b, 2995, 270).boundary;
    expect(closureGap(b)).toEqual({ x: -10, y: -5 });
    const c = closeChain(b);
    expect(c.message).toMatch(/khép kín/);
    expect(c.boundary.segments.length).toBe(5);
  });
});

describe('Bài 6 — Cao độ', () => {
  it('lưu nhiều mức cao độ và vùng trần giật cấp, qua sao lưu JSON', () => {
    const p = sampleProject();
    const room = p.floors[1].rooms[0];
    expect(room.heights.map((h) => h.type)).toEqual(['slab', 'falseCeiling', 'stepped', 'stepped', 'beam']);
    expect(room.zones.length).toBe(2);
    expect(room.zones.every((z) => room.heights.some((h) => h.id === z.levelId))).toBe(true);
    const restored = normalizeProject(JSON.parse(JSON.stringify(p)));
    expect(restored).toEqual(p);
    // cao độ chưa đo được lưu null (không lấy giá trị gợi ý)
    const h = newHeight('beam');
    expect(h.value).toBeNull();
  });
  it('dữ liệu mẫu hợp lệ & xuất DXF không lỗi', () => {
    const p = sampleProject();
    for (const f of p.floors) {
      const dxf = writeDxf(buildDrawing(f.rooms).prims);
      expect(dxf.startsWith('  0\nSECTION')).toBe(true);
      expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
      for (const r of f.rooms) {
        const b = r.boundary;
        expect(b.segments.length).toBe(b.closed ? b.vertices.length : b.vertices.length - 1);
      }
    }
  });
});
