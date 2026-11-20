import type { Point } from '../model/types';

/** Lớp bản vẽ — trùng tên layer khi xuất DXF */
export type Layer = 'WALL_INNER' | 'WALL_OUTER' | 'WALL_FILL' | 'DOOR' | 'WINDOW' | 'OPENING' | 'DIMENSION' | 'TEXT' | 'AXIS' | 'CEILING';

export const LAYERS: { name: Layer; color: number; ltype?: string; desc: string; lw: number }[] = [
  { name: 'WALL_INNER', color: 7, desc: 'Đường biên trong (đo gốc)', lw: 50 },
  { name: 'WALL_OUTER', color: 8, desc: 'Đường biên ngoài (theo bề dày)', lw: 35 },
  { name: 'DOOR', color: 30, desc: 'Cửa đi', lw: 25 },
  { name: 'WINDOW', color: 4, desc: 'Cửa sổ', lw: 25 },
  { name: 'OPENING', color: 6, ltype: 'DASHED', desc: 'Ô mở', lw: 18 },
  { name: 'DIMENSION', color: 3, desc: 'Kích thước', lw: 13 },
  { name: 'TEXT', color: 2, desc: 'Chú thích', lw: 18 },
  { name: 'AXIS', color: 1, desc: 'Trục tọa độ', lw: 13 },
  { name: 'CEILING', color: 5, ltype: 'DASHED', desc: 'Vùng trần / cao độ', lw: 13 },
];

export type Prim =
  | { t: 'line'; layer: Layer; a: Point; b: Point }
  | { t: 'poly'; layer: Layer; pts: Point[]; closed: boolean }
  | { t: 'arc'; layer: Layer; c: Point; r: number; a0: number; a1: number } // độ, quét ngược chiều kim đồng hồ từ a0 đến a1
  | { t: 'text'; layer: Layer; p: Point; text: string; h: number; rot: number; align: 'left' | 'center' | 'right'; valign: 'bottom' | 'middle' | 'top' }
  | { t: 'fill'; layer: Layer; pts: Point[] }
  /** start: khoảng cách (mm) từ điểm đo tới đầu đường gióng — để đường gióng bắt đầu từ mặt ngoài tường */
  | { t: 'dim'; layer: Layer; a: Point; b: Point; off: Point; text: string; h: number; start?: number };

export interface Drawing {
  prims: Prim[];
  /** Khung bao (mm) */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}
