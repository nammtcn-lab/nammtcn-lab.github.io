import type { Boundary, Point, Project, Room, Segment, SegmentKind } from './types';
import { newFloor, newHeight, newProject, newRoom, uid } from './factory';
import { appendByLength, closeChain, startChain } from './ops';

type Step = [length: number, angleDeg: number, kind?: SegmentKind, patch?: Partial<Segment>];

/** Dựng chu vi từ danh sách bước (chiều dài, hướng), giống thao tác nhập số tại công trình */
export function buildBoundary(start: Point, steps: Step[], close = true): Boundary {
  let b: Boundary = startChain({ vertices: [], segments: [], closed: false }, start).boundary;
  for (const [L, a, kind, patch] of steps) {
    b = appendByLength(b, L, a, kind ?? 'wall').boundary;
    if (patch) {
      const i = b.segments.length - 1;
      b.segments[i] = { ...b.segments[i], ...patch } as Segment;
    }
  }
  if (close && !b.closed) b = closeChain(b).boundary;
  return b;
}

function room(name: string, b: Boundary, mod?: (r: Room) => void): Room {
  const r = newRoom(name);
  r.boundary = b;
  mod?.(r);
  return r;
}

/** Dự án mẫu để thử ngay */
export function sampleProject(): Project {
  const p = newProject('Nhà mẫu — Khảo sát hiện trạng');
  p.address = '12 Ngõ Mẫu, Hà Nội';
  p.surveyor = 'Nam';
  p.notes = 'Dữ liệu mẫu để thử nghiệm ứng dụng.';
  const f1 = newFloor('Tầng 1', 0);
  const f2 = newFloor('Tầng 2', 3600);

  // 1. Phòng chữ nhật 4000 × 5000
  f1.rooms.push(
    room('P1 — Phòng chữ nhật', buildBoundary({ x: 0, y: 0 }, [[4000, 0], [5000, 90], [4000, 180]]), (r) => {
      r.heights.push(newHeight('slab', 3300));
    }),
  );

  // 2. Phòng có cạnh chéo (vát góc 45°)
  f1.rooms.push(
    room(
      'P2 — Phòng cạnh chéo',
      buildBoundary({ x: 4500, y: 0 }, [[3600, 0], [3000, 90], [Math.SQRT2 * 1000, 135], [2600, 180]]),
      (r) => r.heights.push(newHeight('slab', 3300), newHeight('falseCeiling', 2900)),
    ),
  );

  // 3. Phòng có cửa đi: cạnh dưới = tường 600 + cửa đi 900 + tường 1700
  f1.rooms.push(
    room(
      'P3 — Phòng ngủ (cửa đi)',
      buildBoundary({ x: 0, y: 5500 }, [
        [600, 0],
        [900, 0, 'door', { door: { height: 2200, style: 'single', hinge: 'start', swing: 'in', note: 'Cửa gỗ' } }],
        [1700, 0],
        [3600, 90],
        [3200, 180],
      ]),
      (r) => r.heights.push(newHeight('slab', 3250)),
    ),
  );

  // 4. Phòng có cửa sổ: cạnh 4500 = tường 1200 + cửa sổ 1500 + tường 1800
  f1.rooms.push(
    room(
      'P4 — Phòng làm việc (cửa sổ)',
      buildBoundary({ x: 3700, y: 5500 }, [
        [4500, 0],
        [3400, 90],
        [1800, 180],
        [1500, 180, 'window', { window: { sillHeight: null, height: null, style: 'sliding', note: 'Chưa đo cao độ bậu' } }],
        [1200, 180],
        [800, 270],
        [900, 270, 'door', { door: { height: null, style: 'single', hinge: 'end', swing: 'in', note: '' } }],
        [1700, 270],
      ]),
      (r) => r.heights.push(newHeight('slab', 3200)),
    ),
  );

  // 5. Phòng có trần giật cấp (tầng 2)
  const living = room(
    'P5 — Phòng khách (trần giật cấp)',
    buildBoundary({ x: 0, y: 0 }, [
      [6000, 0],
      [2000, 90],
      [1000, 90, 'opening', { opening: { height: 2400, note: 'Ô mở sang bếp' } }],
      [2000, 90],
      [6000, 180],
      [1200, 270],
      [1800, 270, 'window', { window: { sillHeight: 900, height: 1400, style: 'casement', note: '' } }],
      [2000, 270],
    ]),
    (r) => {
      const slab = newHeight('slab', 3400);
      const fc = newHeight('falseCeiling', 3000);
      const s1 = newHeight('stepped', 2800, 'Giật cấp 1');
      const s2 = newHeight('stepped', 2650, 'Giật cấp 2');
      const beam = newHeight('beam', 2950, 'Dầm D1');
      r.heights.push(slab, fc, s1, s2, beam);
      r.zones.push(
        { id: uid('z'), name: 'Vùng giật cấp 1', levelId: s1.id, polygon: rect(600, 600, 4800, 3800) },
        { id: uid('z'), name: 'Vùng giật cấp 2', levelId: s2.id, polygon: rect(0, 0, 6000, 400) },
      );
      r.notes = 'Trần thạch cao giật 2 cấp, đèn hắt.';
    },
  );
  f2.rooms.push(living);

  // 6. Phòng chữ L (góc lõm), tường bao 220
  f2.rooms.push(
    room('P6 — Bếp chữ L (góc lõm)', buildBoundary({ x: 6500, y: 0 }, [[3000, 0], [2000, 90], [-0 + 1500, 180], [3000, 90], [1500, 180]]), (r) => {
      r.defaultThickness = 220;
      r.boundary.segments[1].thickness = 110;
    }),
  );

  p.floors = [f1, f2];
  return p;
}

function rect(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}
