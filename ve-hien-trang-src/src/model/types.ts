/**
 * MÔ HÌNH DỮ LIỆU — mọi kích thước hình học đều lưu theo milimét (mm), tọa độ thực.
 * Trục X hướng sang phải, trục Y hướng lên trên (giống AutoCAD).
 * Không bao giờ lưu pixel màn hình trong mô hình.
 */

export const SCHEMA_VERSION = 1;

export interface Point {
  x: number; // mm
  y: number; // mm
}

/** Loại đoạn trong chuỗi chu vi phòng. Có thể mở rộng thêm sau. */
export type SegmentKind = 'wall' | 'door' | 'window' | 'opening' | 'partition';

export type DoorStyle = 'single' | 'double' | 'sliding' | 'folding' | 'other';
/** Bản lề ở đầu đoạn (start) hay cuối đoạn (end) */
export type DoorHinge = 'start' | 'end';
/** Mở vào trong phòng hay ra ngoài */
export type DoorSwing = 'in' | 'out';

export type WindowStyle = 'casement' | 'sliding' | 'fixed' | 'awning' | 'other';

export interface DoorProps {
  /** Chiều cao cửa, null = chưa đo / bỏ trống */
  height: number | null;
  style: DoorStyle | null;
  hinge: DoorHinge;
  swing: DoorSwing;
  note: string;
}

export interface WindowProps {
  /** Cao độ bậu cửa so với sàn hoàn thiện, null = chưa đo */
  sillHeight: number | null;
  /** Chiều cao cửa sổ, null = chưa đo */
  height: number | null;
  style: WindowStyle | null;
  note: string;
}

export interface OpeningProps {
  /** Chiều cao ô mở (đáy lanh tô), null = chưa đo */
  height: number | null;
  note: string;
}

/**
 * Thuộc tính của một đoạn. Hình học của đoạn i là từ vertices[i] đến vertices[i+1]
 * (hoặc vertices[0] với đoạn cuối khi chu vi đã khép kín).
 * Chiều dài/chiều rộng đoạn luôn được suy ra từ tọa độ — không lưu trùng lặp.
 */
export interface Segment {
  id: string;
  kind: SegmentKind;
  /** Bề dày tường riêng của đoạn (mm). null = dùng bề dày mặc định của phòng (giá trị quy ước, chưa xác nhận). */
  thickness: number | null;
  door?: DoorProps;
  window?: WindowProps;
  opening?: OpeningProps;
  note?: string;
}

/**
 * Đường biên đo gốc: mặt trong của tường (tiếp xúc không gian bên trong phòng).
 * vertices.length = segments.length + 1 khi chuỗi hở, = segments.length khi đã khép kín.
 */
export interface Boundary {
  vertices: Point[];
  segments: Segment[];
  closed: boolean;
}

/** Các loại cao độ ghi nhận ở cấp phòng */
export type HeightType = 'slab' | 'falseCeiling' | 'stepped' | 'beam' | 'other';

export interface HeightLevel {
  id: string;
  type: HeightType;
  /** Tên hiển thị, ví dụ "Giật cấp 1", "Dầm D1" */
  label: string;
  /** Cao độ tính từ sàn hoàn thiện (mm). null = chưa đo */
  value: number | null;
  note: string;
}

/** Vùng trong phòng gán với một mức cao độ (trần giật cấp, vùng dầm...) */
export interface CeilingZone {
  id: string;
  name: string;
  levelId: string;
  /** Đa giác vùng, tọa độ thực (mm) cùng hệ với chu vi phòng */
  polygon: Point[];
}

export interface Room {
  id: string;
  name: string;
  boundary: Boundary;
  /** Bề dày tường mặc định của phòng (mm) — giá trị quy ước dùng để biểu diễn */
  defaultThickness: number;
  heights: HeightLevel[];
  zones: CeilingZone[];
  notes: string;
  /** Dự phòng mở rộng: ảnh hiện trạng, vật liệu, thiết bị, mặt đứng, mặt cắt... */
  photos: PhotoRef[];
  extra: Record<string, unknown>;
}

export interface PhotoRef {
  id: string;
  name: string;
  /** Khóa dữ liệu ảnh trong kho lưu trữ (giai đoạn sau) */
  blobKey: string;
  note: string;
}

export interface Floor {
  id: string;
  name: string;
  /** Cao độ sàn tầng (mm) so với mốc ±0.000 */
  elevation: number;
  rooms: Room[];
}

export interface ProjectSettings {
  /** Bề dày tường mặc định cho phòng mới (mm), quy ước 140 */
  defaultThickness: number;
  /** Bề dày vách ngăn mặc định (mm) */
  partitionThickness: number;
  /** Bước bắt điểm (mm) */
  snapStep: number;
}

export interface Project {
  schema: number;
  id: string;
  name: string;
  address: string;
  surveyor: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
  floors: Floor[];
}

export const SEGMENT_KIND_LABEL: Record<SegmentKind, string> = {
  wall: 'Tường',
  door: 'Cửa đi',
  window: 'Cửa sổ',
  opening: 'Ô mở',
  partition: 'Vách ngăn',
};

export const HEIGHT_TYPE_LABEL: Record<HeightType, string> = {
  slab: 'Trần bê tông',
  falseCeiling: 'Trần giả',
  stepped: 'Trần giật cấp',
  beam: 'Đáy dầm',
  other: 'Cao độ khác',
};

export const DOOR_STYLE_LABEL: Record<DoorStyle, string> = {
  single: 'Cánh đơn',
  double: 'Hai cánh',
  sliding: 'Cửa lùa',
  folding: 'Cửa xếp',
  other: 'Khác',
};

export const WINDOW_STYLE_LABEL: Record<WindowStyle, string> = {
  casement: 'Mở quay',
  sliding: 'Mở lùa',
  fixed: 'Vách kính cố định',
  awning: 'Mở hất',
  other: 'Khác',
};

/** Giá trị GỢI Ý — chỉ điền khi người dùng chủ động bấm, không tự coi là số đo xác nhận */
export const SUGGEST = {
  doorHeight: 2200,
  windowSill: 900,
  windowHeight: 1400,
  wallThickness: 140,
  partitionThickness: 100,
};
