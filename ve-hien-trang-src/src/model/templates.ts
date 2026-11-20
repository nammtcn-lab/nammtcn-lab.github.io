/**
 * THƯ VIỆN MẶT BẰNG MẪU — chọn mẫu, nhập kích thước bao, chèn vào bản vẽ rồi co kéo cho khớp hiện trạng.
 * Mỗi mẫu là hàm dựng chu vi theo bề rộng W (trục X) và chiều sâu D (trục Y), vẽ ngược chiều kim đồng hồ
 * từ góc dưới trái: cạnh dưới → cạnh phải → cạnh trên → cạnh trái.
 * Cửa đi / cửa sổ là đoạn trong chuỗi chu vi như khi vẽ tay. Cao độ để trống (chưa đo).
 */
import type { Boundary, Fixture, FixtureType, Point, Segment, SegmentKind } from './types';
import { newFixture } from './factory';
import { attachToWall } from '../geometry/fixtures';
import { buildBoundary } from './sample';

type Step = [number, number, SegmentKind?, Partial<Segment>?];

export interface RoomTemplate {
  id: string;
  name: string;
  desc: string;
  w: number;
  d: number;
  /** kích thước nhỏ nhất cho phép (mm) */
  minW: number;
  minD: number;
  build: (w: number, d: number) => Step[];
  /** Thiết bị mẫu (tọa độ tương đối góc dưới trái). Thiết bị tường tự bám vào tường gần nhất. */
  fixtures?: (w: number, d: number) => FixSpec[];
  /** Mẫu nhiều phòng (VD phòng ngủ + WC trong phòng): mỗi phòng có gốc riêng */
  extra?: (w: number, d: number) => { name: string; origin: Point; steps: Step[]; thickness?: number; fixtures?: FixSpec[] }[];
}

export type FixSpec = [FixtureType, number, number];

const door = (style: 'single' | 'double' | 'sliding' = 'single', hinge: 'start' | 'end' = 'start'): Partial<Segment> => ({
  door: { height: null, style, hinge, swing: 'in', note: '' },
});
const win = (style: 'casement' | 'sliding' | 'fixed' = 'casement'): Partial<Segment> => ({
  window: { sillHeight: null, height: null, style, note: '' },
});

/** Cạnh có một ô cửa cách đầu cạnh `off`, rộng `w`, hướng `ang` */
function side(L: number, ang: number, off: number, w: number, kind: SegmentKind, patch?: Partial<Segment>): Step[] {
  const out: Step[] = [];
  const o = Math.max(0, Math.min(off, L - w));
  if (o > 0.5) out.push([o, ang]);
  out.push([Math.min(w, L), ang, kind, patch]);
  const rest = L - o - w;
  if (rest > 0.5) out.push([rest, ang]);
  return out;
}
const centered = (L: number, ang: number, w: number, kind: SegmentKind, patch?: Partial<Segment>) => side(L, ang, (L - w) / 2, w, kind, patch);

export const TEMPLATES: RoomTemplate[] = [
  {
    id: 'bedroom',
    name: 'Phòng ngủ',
    desc: 'Cửa đi 900 sát góc, cửa sổ 1400 giữa tường đối diện',
    w: 3300,
    d: 3600,
    minW: 1800,
    minD: 1800,
    build: (W, D) => [...side(W, 0, 200, 900, 'door', door()), [D, 90], ...centered(W, 180, 1400, 'window', win()), [D, 270]],
    fixtures: (W, D) => [['switch', 1250, 0], ['socket', 350, D], ['socket', W - 350, D], ['ac', 0, D / 2], ['socket', 0, 400]],
  },
  {
    id: 'master',
    name: 'Phòng ngủ master',
    desc: 'Cửa đi 900, cửa sổ lớn 1800, thêm cửa sổ 1200 tường bên',
    w: 4000,
    d: 4500,
    minW: 2600,
    minD: 2600,
    build: (W, D) => [...side(W, 0, 250, 900, 'door', door()), ...centered(D, 90, 1200, 'window', win()), ...centered(W, 180, 1800, 'window', win('sliding')), [D, 270]],
  },
  {
    id: 'wc',
    name: 'Phòng vệ sinh',
    desc: 'Cửa đi 700, ô cửa sổ thông gió 600',
    w: 1600,
    d: 2200,
    minW: 900,
    minD: 1200,
    build: (W, D) => [...side(W, 0, 150, 700, 'door', door()), [D, 90], ...centered(W, 180, 600, 'window', win('fixed')), [D, 270]],
    fixtures: (W, D) => [['lavabo', W, 650], ['wc', W / 2, D - 350], ['shower', 0, D - 700], ['floorDrain', 350, D - 900], ['switch', W - 30, 0]],
  },
  {
    id: 'bath',
    name: 'Vệ sinh + tắm đứng',
    desc: 'Cửa đi 750, cửa sổ 600 phía tắm',
    w: 2000,
    d: 2600,
    minW: 1200,
    minD: 1600,
    build: (W, D) => [...side(W, 0, 150, 750, 'door', door()), ...side(D, 90, D - 900, 600, 'window', win('fixed')), [W, 180], [D, 270]],
    fixtures: (W, D) => [['lavabo', 0, 700], ['wc', W / 2 - 200, D - 350], ['shower', W, D - 450], ['floorDrain', W - 450, D - 450], ['switch', W - 100, 0]],
  },
  {
    id: 'living',
    name: 'Phòng khách',
    desc: 'Cửa chính 2 cánh 1400, cửa sổ 2400, ô mở 1200 sang bếp',
    w: 4500,
    d: 6000,
    minW: 2800,
    minD: 3200,
    build: (W, D) => [...centered(W, 0, 1400, 'door', door('double')), ...side(D, 90, D - 1600, 1200, 'opening', { opening: { height: null, note: '' } }), ...centered(W, 180, 2400, 'window', win('sliding')), [D, 270]],
    fixtures: (W, D) => [['switch', W / 2 - 900, 0], ['ac', 0, D / 2], ['socket', 0, D / 2 - 900], ['socket', 0, D / 2 + 900], ['socket', W, 600]],
  },
  {
    id: 'kitchen',
    name: 'Bếp',
    desc: 'Ô mở 1000 không cánh, cửa sổ 1200 trên bàn bếp',
    w: 3000,
    d: 3600,
    minW: 1600,
    minD: 1800,
    build: (W, D) => [...side(W, 0, 300, 1000, 'opening', { opening: { height: null, note: '' } }), [D, 90], ...centered(W, 180, 1200, 'window', win()), [D, 270]],
    fixtures: (W, D) => [['socket', 500, D], ['socket', W - 500, D], ['water', W / 2 - 300, D], ['socket', W, D - 600]],
  },
  {
    id: 'study',
    name: 'Phòng làm việc',
    desc: 'Cửa đi 800, cửa sổ 1500',
    w: 3000,
    d: 3300,
    minW: 1800,
    minD: 1800,
    build: (W, D) => [...side(W, 0, 200, 800, 'door', door()), [D, 90], ...centered(W, 180, 1500, 'window', win()), [D, 270]],
  },
  {
    id: 'balcony',
    name: 'Ban công / lô gia',
    desc: 'Cửa lùa kính 2400 ra ban công',
    w: 3600,
    d: 1200,
    minW: 2600,
    minD: 600,
    build: (W, D) => [[W, 0], [D, 90], ...centered(W, 180, 2400, 'door', door('sliding')), [D, 270]],
  },
  {
    id: 'corridor',
    name: 'Hành lang',
    desc: 'Hai ô mở 900 ở hai đầu',
    w: 1200,
    d: 4500,
    minW: 800,
    minD: 2000,
    build: (W, D) => [...centered(W, 0, 900, 'opening', { opening: { height: null, note: '' } }), [D, 90], ...centered(W, 180, 900, 'opening', { opening: { height: null, note: '' } }), [D, 270]],
  },
  {
    id: 'ensuite',
    name: 'Phòng ngủ + WC trong phòng',
    desc: 'Phòng ngủ chữ L ôm khối WC 1600×2200 ở góc, cửa WC mở từ phòng ngủ, vách 100',
    w: 4200,
    d: 4500,
    minW: 3200,
    minD: 3400,
    build: (W, D) => {
      const wcW = 1600;
      const wcD = 2200;
      const t = 100;
      // cạnh vách phía phòng ngủ (đi xuống) có lỗ cửa WC 700
      const down = wcD + t;
      const offTop = wcD - 200 - 700; // từ đỉnh vách xuống tới mép trên cửa WC
      return [
        ...side(W, 0, 250, 900, 'door', door()),
        ...centered(D, 90, 1400, 'window', win()),
        [W - wcW - t, 180],
        [offTop, 270, 'partition', { thickness: t }],
        [700, 270, 'opening', { opening: { height: null, note: 'Lỗ cửa WC (cánh vẽ ở phòng WC)' }, thickness: t }],
        [down - offTop - 700, 270, 'partition', { thickness: t }],
        [wcW + t, 180, 'partition', { thickness: t }],
        [D - wcD - t, 270],
      ];
    },
    fixtures: (W, D) => [['switch', 1350, 0], ['ac', W, D / 2 + 900], ['socket', W - 300, 0], ['socket', 1700 + 350, D]],
    extra: (_W, D) => [
      {
        name: 'WC trong phòng ngủ',
        origin: { x: 0, y: D - 2200 },
        thickness: 140,
        // WC 1600×2200: cửa 700 trên vách phải (giáp phòng ngủ), mở vào WC
        steps: [[1600, 0, 'partition', { thickness: 100 }], [200, 90, 'partition', { thickness: 100 }], [700, 90, 'door', { door: { height: null, style: 'single', hinge: 'start', swing: 'in', note: '' }, thickness: 100 }], [1300, 90, 'partition', { thickness: 100 }], ...centered(1600, 180, 600, 'window', win('fixed')), [2200, 270]],
        fixtures: [['lavabo', 0, 600], ['wc', 800, 2200 - 350], ['shower', 0, 1700], ['floorDrain', 400, 1300]],
      },
    ],
  },
  {
    id: 'bed-balcony',
    name: 'Phòng ngủ + ban công',
    desc: 'Cửa lùa 2400 ra ban công sâu 1200, tường ngăn 220',
    w: 3600,
    d: 3800,
    minW: 2800,
    minD: 2600,
    build: (W, D) => [...side(W, 0, 200, 900, 'door', door()), [D, 90], ...centered(W, 180, 2400, 'door', door('sliding')), [D, 270]],
    fixtures: (W, D) => [['switch', 1250, 0], ['ac', W, D / 2], ['socket', 300, D], ['socket', W - 300, D]],
    extra: (W, D) => [
      {
        name: 'Ban công',
        origin: { x: 0, y: D + 220 },
        steps: [...centered(W, 0, 2400, 'opening', { opening: { height: null, note: 'Cửa lùa ra ban công' } }), [1200, 90], [W, 180], [1200, 270]],
      },
    ],
  },
  {
    id: 'lshape',
    name: 'Phòng chữ L',
    desc: 'Có góc lõm, cửa đi 900, cửa sổ 1200',
    w: 4500,
    d: 5000,
    minW: 2400,
    minD: 2400,
    build: (W, D) => {
      const w2 = Math.round(W * 0.5);
      const d2 = Math.round(D * 0.45);
      return [...side(W, 0, 200, 900, 'door', door()), [d2, 90], [W - w2, 180], [D - d2, 90], ...centered(w2, 180, Math.min(1200, w2 - 200), 'window', win()), [D, 270]];
    },
  },
  {
    id: 'blank',
    name: 'Phòng trống',
    desc: 'Hình chữ nhật, chưa có cửa — tự chèn cửa sau',
    w: 3000,
    d: 4000,
    minW: 300,
    minD: 300,
    build: (W, D) => [[W, 0], [D, 90], [W, 180]],
  },
];

export interface BuiltRoom {
  name: string;
  boundary: Boundary;
  fixtures: Fixture[];
  thickness?: number;
}

function placeFixtures(b: Boundary, specs: FixSpec[], origin: Point): Fixture[] {
  const holder = { boundary: b } as any;
  return specs.map(([type, x, y]) => {
    const p = { x: origin.x + x, y: origin.y + y };
    const f = newFixture(type, p);
    if (f.mount === 'wall') {
      const at = attachToWall(holder, p);
      if (at) {
        f.segId = at.segId;
        f.offset = Math.round(at.offset);
        f.pos = at.point;
      }
    }
    return f;
  });
}

/** Dựng tất cả phòng của mẫu (mẫu nhiều phòng như phòng ngủ + WC) */
export function buildTemplateRooms(t: RoomTemplate, w: number, d: number, origin: Point = { x: 0, y: 0 }, name = t.name): BuiltRoom[] {
  const W = Math.max(t.minW, w);
  const D = Math.max(t.minD, d);
  const main = buildBoundary(origin, t.build(W, D), true);
  const out: BuiltRoom[] = [{ name, boundary: main, fixtures: placeFixtures(main, t.fixtures?.(W, D) ?? [], origin) }];
  for (const x of t.extra?.(W, D) ?? []) {
    const o = { x: origin.x + x.origin.x, y: origin.y + x.origin.y };
    const b = buildBoundary(o, x.steps, true);
    out.push({ name: x.name, boundary: b, fixtures: placeFixtures(b, x.fixtures ?? [], o), thickness: x.thickness });
  }
  return out;
}

/** Dựng chu vi của mẫu tại vị trí `origin` (góc dưới trái, mặt trong tường) */
export function buildTemplate(t: RoomTemplate, w: number, d: number, origin: Point = { x: 0, y: 0 }): Boundary {
  const W = Math.max(t.minW, w);
  const D = Math.max(t.minD, d);
  return buildBoundary(origin, t.build(W, D), true);
}
