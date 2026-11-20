/**
 * THƯ VIỆN MẶT BẰNG MẪU — chọn mẫu, nhập kích thước bao, chèn vào bản vẽ rồi co kéo cho khớp hiện trạng.
 * Mỗi mẫu là hàm dựng chu vi theo bề rộng W (trục X) và chiều sâu D (trục Y), vẽ ngược chiều kim đồng hồ
 * từ góc dưới trái: cạnh dưới → cạnh phải → cạnh trên → cạnh trái.
 * Cửa đi / cửa sổ là đoạn trong chuỗi chu vi như khi vẽ tay. Cao độ để trống (chưa đo).
 */
import type { Boundary, Point, Segment, SegmentKind } from './types';
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
}

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

/** Dựng chu vi của mẫu tại vị trí `origin` (góc dưới trái, mặt trong tường) */
export function buildTemplate(t: RoomTemplate, w: number, d: number, origin: Point = { x: 0, y: 0 }): Boundary {
  const W = Math.max(t.minW, w);
  const D = Math.max(t.minD, d);
  return buildBoundary(origin, t.build(W, D), true);
}
