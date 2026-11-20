import {
  SCHEMA_VERSION,
  SUGGEST,
  type Floor,
  type HeightLevel,
  type HeightType,
  type Project,
  type Room,
  type Segment,
  type SegmentKind,
} from './types';
import { HEIGHT_TYPE_LABEL } from './types';

let counter = 0;
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

export function newSegment(kind: SegmentKind = 'wall'): Segment {
  const s: Segment = { id: uid('s'), kind, thickness: null };
  return applyKindDefaults(s, kind);
}

/** Khởi tạo bộ thuộc tính khi chuyển loại đoạn. Các trường không bắt buộc để trống (null). */
export function applyKindDefaults(s: Segment, kind: SegmentKind): Segment {
  const out: Segment = { ...s, kind };
  if (kind === 'door' && !out.door) out.door = { height: null, style: null, hinge: 'start', swing: 'in', note: '' };
  if (kind === 'window' && !out.window) out.window = { sillHeight: null, height: null, style: null, note: '' };
  if (kind === 'opening' && !out.opening) out.opening = { height: null, note: '' };
  return out;
}

export function newRoom(name: string, defaultThickness = SUGGEST.wallThickness): Room {
  return {
    id: uid('r'),
    name,
    boundary: { vertices: [], segments: [], closed: false },
    defaultThickness,
    heights: [],
    zones: [],
    notes: '',
    photos: [],
    extra: {},
  };
}

export function newFloor(name: string, elevation = 0): Floor {
  return { id: uid('f'), name, elevation, rooms: [] };
}

export function newHeight(type: HeightType, value: number | null = null, label?: string): HeightLevel {
  return { id: uid('h'), type, label: label ?? HEIGHT_TYPE_LABEL[type], value, note: '' };
}

export function newProject(name: string): Project {
  const now = Date.now();
  const floor = newFloor('Tầng 1', 0);
  floor.rooms.push(newRoom('Phòng 1'));
  return {
    schema: SCHEMA_VERSION,
    id: uid('p'),
    name,
    address: '',
    surveyor: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    settings: { defaultThickness: SUGGEST.wallThickness, partitionThickness: SUGGEST.partitionThickness, snapStep: 10 },
    floors: [floor],
  };
}

/** Kiểm tra & chuẩn hóa dữ liệu nhập từ JSON (sao lưu) */
export function normalizeProject(raw: any): Project {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.floors)) throw new Error('File không đúng định dạng dự án Vẽ Hiện Trạng');
  const p: Project = {
    schema: SCHEMA_VERSION,
    id: String(raw.id || uid('p')),
    name: String(raw.name || 'Dự án'),
    address: String(raw.address || ''),
    surveyor: String(raw.surveyor || ''),
    notes: String(raw.notes || ''),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    settings: {
      defaultThickness: Number(raw.settings?.defaultThickness) || SUGGEST.wallThickness,
      partitionThickness: Number(raw.settings?.partitionThickness) || SUGGEST.partitionThickness,
      snapStep: Number(raw.settings?.snapStep) || 10,
    },
    floors: raw.floors.map((f: any) => ({
      id: String(f.id || uid('f')),
      name: String(f.name || 'Tầng'),
      elevation: Number(f.elevation) || 0,
      rooms: (f.rooms || []).map((r: any) => {
        const vertices = (r.boundary?.vertices || []).map((v: any) => ({ x: Number(v.x), y: Number(v.y) }));
        const segments = (r.boundary?.segments || []).map((s: any) => applyKindDefaults({ ...s, id: String(s.id || uid('s')), thickness: s.thickness ?? null }, s.kind || 'wall'));
        const closed = !!r.boundary?.closed;
        const expected = closed ? vertices.length : Math.max(0, vertices.length - 1);
        if (segments.length !== expected) throw new Error(`Phòng "${r.name}" có dữ liệu chu vi không hợp lệ`);
        return {
          id: String(r.id || uid('r')),
          name: String(r.name || 'Phòng'),
          boundary: { vertices, segments, closed },
          defaultThickness: Number(r.defaultThickness) || SUGGEST.wallThickness,
          heights: (r.heights || []).map((h: any) => ({ id: String(h.id || uid('h')), type: h.type || 'other', label: String(h.label || ''), value: h.value == null ? null : Number(h.value), note: String(h.note || '') })),
          zones: (r.zones || []).map((z: any) => ({ id: String(z.id || uid('z')), name: String(z.name || 'Vùng'), levelId: String(z.levelId || ''), polygon: (z.polygon || []).map((v: any) => ({ x: Number(v.x), y: Number(v.y) })) })),
          notes: String(r.notes || ''),
          photos: Array.isArray(r.photos) ? r.photos : [],
          extra: r.extra && typeof r.extra === 'object' ? r.extra : {},
        } as Room;
      }),
    })),
  };
  return p;
}
