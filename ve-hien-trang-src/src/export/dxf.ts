/**
 * XUẤT DXF (AutoCAD R2000 / AC1015) — bản vẽ vector thật, đơn vị mm, tỷ lệ 1:1.
 * Khung file (HEADER, TABLES, BLOCKS, OBJECTS) lấy từ mẫu chuẩn sinh bởi ezdxf, đảm bảo AutoCAD mở được.
 * Thực thể: LINE, LWPOLYLINE, ARC, TEXT trên các layer riêng.
 */
import template from './dxf-template-r2000.dxf?raw';
import type { Prim } from '../drawing/primitives';
import { LAYERS } from '../drawing/primitives';
import { flatten, primsBounds } from '../drawing/buildDrawing';

/** Handle của LAYER table và *Model_Space block record trong file mẫu */
const LAYER_TABLE_HANDLE = '1';
const MODEL_SPACE_HANDLE = '17';
const PLOTSTYLE_NORMAL_HANDLE = '13';

const num = (v: number) => {
  if (!Number.isFinite(v)) return '0.0';
  const r = Math.round(v * 10000) / 10000;
  const s = String(r === 0 ? 0 : r);
  return s.includes('.') || s.includes('e') ? s : s + '.0';
};

/** Mã hóa chữ Unicode (tiếng Việt) theo quy ước DXF \U+XXXX */
export function dxfText(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFC')) {
    const c = ch.codePointAt(0)!;
    if (c < 128) out += ch === '\n' ? ' ' : ch;
    else if (c <= 0xffff) out += '\\U+' + c.toString(16).toUpperCase().padStart(4, '0');
    else out += '?';
  }
  return out;
}

export interface DxfOptions {
  /** Bỏ qua lớp tô nền tường (DXF không cần) */
  includeFill?: boolean;
}

export function writeDxf(prims: Prim[], _opt: DxfOptions = {}): string {
  let handle = 0x100;
  const H = () => (handle++).toString(16).toUpperCase();
  const lines: string[] = [];
  const g = (code: number, value: string | number) => {
    lines.push(code < 10 ? '  ' + code : code < 100 ? ' ' + code : String(code));
    lines.push(typeof value === 'number' ? num(value) : value);
  };

  // --- layer ---
  const layerOut: string[] = [];
  {
    const save = lines.length;
    for (const L of LAYERS) {
      g(0, 'LAYER');
      g(5, H());
      g(330, LAYER_TABLE_HANDLE);
      g(100, 'AcDbSymbolTableRecord');
      g(100, 'AcDbLayerTableRecord');
      g(2, L.name);
      g(70, '0');
      g(62, String(L.color));
      g(6, L.ltype ?? 'Continuous');
      g(370, String(L.lw));
      g(390, PLOTSTYLE_NORMAL_HANDLE);
    }
    layerOut.push(...lines.splice(save));
  }

  // --- entities ---
  const ent = (type: string, layer: string) => {
    g(0, type);
    g(5, H());
    g(330, MODEL_SPACE_HANDLE);
    g(100, 'AcDbEntity');
    g(8, layer);
  };
  const flat = flatten(prims).filter((p) => p.t !== 'fill');
  for (const p of flat) {
    switch (p.t) {
      case 'line':
        if (Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) < 1e-6) break;
        ent('LINE', p.layer);
        g(100, 'AcDbLine');
        g(10, p.a.x);
        g(20, p.a.y);
        g(30, 0);
        g(11, p.b.x);
        g(21, p.b.y);
        g(31, 0);
        break;
      case 'poly': {
        if (p.pts.length < 2) break;
        ent('LWPOLYLINE', p.layer);
        g(100, 'AcDbPolyline');
        g(90, String(p.pts.length));
        g(70, p.closed ? '1' : '0');
        g(43, 0);
        for (const v of p.pts) {
          g(10, v.x);
          g(20, v.y);
        }
        break;
      }
      case 'arc':
        ent('ARC', p.layer);
        g(100, 'AcDbCircle');
        g(10, p.c.x);
        g(20, p.c.y);
        g(30, 0);
        g(40, p.r);
        g(100, 'AcDbArc');
        g(50, p.a0);
        g(51, p.a1);
        break;
      case 'text': {
        const ha = p.align === 'left' ? 0 : p.align === 'center' ? 1 : 2;
        const va = p.valign === 'bottom' ? 1 : p.valign === 'middle' ? 2 : 3;
        ent('TEXT', p.layer);
        g(100, 'AcDbText');
        g(10, p.p.x);
        g(20, p.p.y);
        g(30, 0);
        g(40, p.h);
        g(1, dxfText(p.text));
        if (p.rot) g(50, p.rot);
        g(7, 'Standard');
        g(72, String(ha));
        g(11, p.p.x);
        g(21, p.p.y);
        g(31, 0);
        g(100, 'AcDbText');
        g(73, String(va));
        break;
      }
      default:
        break;
    }
  }
  const entOut = lines.splice(0);

  const bb = primsBounds(flat) ?? { minX: 0, minY: 0, maxX: 6000, maxY: 8000 };
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  const join = (arr: string[]) => (arr.length ? arr.join('\n') + '\n' : '');
  return template
    .replace('{{LAYERS}}', join(layerOut))
    .replace('{{ENTITIES}}', join(entOut))
    .replace('{{HANDSEED}}', H())
    .replace('{{EXTMINX}}', num(bb.minX))
    .replace('{{EXTMINY}}', num(bb.minY))
    .replace('{{EXTMAXX}}', num(bb.maxX))
    .replace('{{EXTMAXY}}', num(bb.maxY))
    .replace('{{VCX}}', num(bb.minX + w / 2))
    .replace('{{VCY}}', num(bb.minY + h / 2))
    .replace('{{VH}}', num(Math.max(h, w / 1.34) * 1.15 || 1000));
}
