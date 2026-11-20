/**
 * XUẤT PDF VECTOR theo tỷ lệ in: khổ A4/A3, hướng giấy, tỷ lệ 1:N, căn giữa, khung tên cơ bản.
 * Phông chữ có dấu tiếng Việt (Liberation Sans, giấy phép SIL OFL) được nhúng vào PDF.
 */
import fontUrl from '../assets/vn-sans.ttf?url';
import type { Prim } from '../drawing/primitives';
import { explodeDim, primsBounds } from '../drawing/buildDrawing';
import type { Point } from '../model/types';

export type Paper = 'A4' | 'A3';
export type Orientation = 'portrait' | 'landscape';

export const PAPER_MM: Record<Paper, [number, number]> = { A4: [210, 297], A3: [297, 420] };
export const SCALES = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500];

export interface PdfOptions {
  paper: Paper;
  orientation: Orientation;
  /** Mẫu số tỷ lệ (50 → 1:50). 0 = tự chọn tỷ lệ lớn nhất vừa khổ giấy */
  scale: number;
  titleBlock: boolean;
  info: { project: string; address: string; sheet: string; surveyor: string; date: string; note?: string };
}

const MARGIN = 10;
const TB_H = 28;

export function pageSize(o: Pick<PdfOptions, 'paper' | 'orientation'>): [number, number] {
  const [a, b] = PAPER_MM[o.paper];
  return o.orientation === 'portrait' ? [a, b] : [b, a];
}

/** Vùng giấy dành cho bản vẽ (mm giấy) */
export function drawArea(o: Pick<PdfOptions, 'paper' | 'orientation' | 'titleBlock'>) {
  const [W, H] = pageSize(o);
  const left = MARGIN + 10; // lề đóng gáy
  const bottom = MARGIN + (o.titleBlock ? TB_H : 0);
  return { x: left, y: MARGIN, w: W - left - MARGIN, h: H - MARGIN - bottom };
}

/** Chọn tỷ lệ tiêu chuẩn lớn nhất vừa vùng vẽ */
export function autoScale(bounds: { minX: number; minY: number; maxX: number; maxY: number }, o: Pick<PdfOptions, 'paper' | 'orientation' | 'titleBlock'>): number {
  const a = drawArea(o);
  const need = Math.max((bounds.maxX - bounds.minX) / (a.w - 8), (bounds.maxY - bounds.minY) / (a.h - 8));
  return SCALES.find((s) => s >= need) ?? Math.ceil(need / 100) * 100;
}

let fontB64: string | null = null;
async function loadFont(): Promise<string> {
  if (fontB64) return fontB64;
  const buf = new Uint8Array(await (await fetch(fontUrl)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  fontB64 = btoa(bin);
  return fontB64;
}

/** Tạo PDF. prims phải được dựng với chiều cao chữ = 2,5 mm × tỷ lệ để chữ in ra đúng cỡ. */
export async function writePdf(prims: Prim[], o: PdfOptions): Promise<{ blob: Blob; scale: number; fits: boolean }> {
  const { jsPDF } = await import('jspdf');
  const [W, H] = pageSize(o);
  const doc = new jsPDF({ unit: 'mm', format: o.paper.toLowerCase(), orientation: o.orientation, compress: true });
  doc.addFileToVFS('vn-sans.ttf', await loadFont());
  doc.addFont('vn-sans.ttf', 'VN', 'normal');
  doc.setFont('VN', 'normal');
  doc.setProperties({ title: `${o.info.project} — ${o.info.sheet}`, creator: 'Vẽ Hiện Trạng' });

  const bb = primsBounds(prims) ?? { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const area = drawArea(o);
  const scale = o.scale > 0 ? o.scale : autoScale(bb, o);
  const k = 1 / scale;
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const pcx = area.x + area.w / 2;
  const pcy = area.y + area.h / 2;
  const P = (p: Point): [number, number] => [pcx + (p.x - cx) * k, pcy - (p.y - cy) * k];
  const fits = (bb.maxX - bb.minX) * k <= area.w + 0.01 && (bb.maxY - bb.minY) * k <= area.h + 0.01;

  const LW: Record<string, number> = { WALL_INNER: 0.5, WALL_OUTER: 0.35, DOOR: 0.25, WINDOW: 0.25, OPENING: 0.18, DIMENSION: 0.13, TEXT: 0.18, AXIS: 0.13, CEILING: 0.13 };
  const COL: Record<string, [number, number, number]> = {
    WALL_INNER: [0, 0, 0],
    WALL_OUTER: [40, 40, 40],
    DOOR: [190, 90, 0],
    WINDOW: [0, 110, 160],
    OPENING: [140, 50, 160],
    DIMENSION: [10, 100, 50],
    TEXT: [20, 20, 20],
    AXIS: [200, 40, 40],
    CEILING: [50, 80, 190],
  };

  // vùng cắt: bản vẽ nằm trong khung
  doc.saveGraphicsState();
  doc.rect(area.x, area.y, area.w, area.h, null as any);
  (doc as any).clip();
  (doc as any).discardPath();

  // tô tường
  doc.setFillColor(200, 205, 212);
  for (const p of prims) {
    if (p.t !== 'fill') continue;
    const pts = p.pts.map(P);
    poly(doc, pts, true, 'F');
  }
  for (const p0 of prims) {
    const list = p0.t === 'dim' ? explodeDim(p0) : [p0];
    for (const p of list) {
      if (p.t === 'fill' || p.t === 'dim') continue;
      const c = COL[p.layer] ?? [0, 0, 0];
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setTextColor(c[0], c[1], c[2]);
      doc.setLineWidth(LW[p.layer] ?? 0.18);
      doc.setLineDashPattern(p.layer === 'OPENING' || p.layer === 'CEILING' ? [1.5, 1] : [], 0);
      if (p.t === 'line') {
        const [x1, y1] = P(p.a);
        const [x2, y2] = P(p.b);
        doc.line(x1, y1, x2, y2);
      } else if (p.t === 'poly') poly(doc, p.pts.map(P), p.closed, 'S');
      else if (p.t === 'arc') {
        const pts: [number, number][] = [];
        let sweep = (p.a1 - p.a0 + 360) % 360;
        if (sweep === 0) sweep = 360;
        const n = Math.max(8, Math.ceil(sweep / 3));
        for (let i = 0; i <= n; i++) {
          const a = ((p.a0 + (sweep * i) / n) * Math.PI) / 180;
          pts.push(P({ x: p.c.x + Math.cos(a) * p.r, y: p.c.y + Math.sin(a) * p.r }));
        }
        poly(doc, pts, false, 'S');
      } else if (p.t === 'text') {
        const [x, y] = P(p.p);
        const hPaper = p.h * k;
        doc.setFontSize(hPaper / 0.3528 / 0.72);
        // tự căn ngang theo hướng chữ (jsPDF không căn giữa đúng khi chữ xoay)
        const tw = doc.getTextWidth(p.text);
        const shift = p.align === 'center' ? tw / 2 : p.align === 'right' ? tw : 0;
        const r = (p.rot * Math.PI) / 180;
        doc.text(p.text, x - Math.cos(r) * shift, y + Math.sin(r) * shift, { angle: p.rot, baseline: p.valign === 'bottom' ? 'bottom' : p.valign === 'top' ? 'top' : 'middle' } as any);
      }
    }
  }
  doc.restoreGraphicsState();
  doc.setLineDashPattern([], 0);

  // khung bản vẽ
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN + 10, MARGIN, W - MARGIN * 2 - 10, H - MARGIN * 2);
  if (o.titleBlock) titleBlock(doc, W, H, scale, o);
  else {
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`Tỷ lệ 1:${scale}`, W - MARGIN - 2, H - MARGIN - 2, { align: 'right' });
  }
  return { blob: doc.output('blob'), scale, fits };
}

function poly(doc: any, pts: [number, number][], closed: boolean, style: 'S' | 'F') {
  if (pts.length < 2) return;
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], style, closed);
}

function titleBlock(doc: any, W: number, H: number, scale: number, o: PdfOptions) {
  const x0 = MARGIN + 10;
  const x1 = W - MARGIN;
  const y1 = H - MARGIN;
  const y0 = y1 - TB_H;
  doc.setLineWidth(0.35);
  doc.setDrawColor(0, 0, 0);
  doc.line(x0, y0, x1, y0);
  const wTotal = x1 - x0;
  const c1 = x0 + wTotal * 0.42;
  const c2 = x0 + wTotal * 0.72;
  doc.line(c1, y0, c1, y1);
  doc.line(c2, y0, c2, y1);
  doc.setLineWidth(0.18);
  doc.line(c2, y0 + TB_H / 2, x1, y0 + TB_H / 2);
  doc.setTextColor(0, 0, 0);
  const label = (t: string, x: number, y: number) => {
    doc.setFontSize(6.5);
    doc.setTextColor(90, 90, 90);
    doc.text(t, x, y);
    doc.setTextColor(0, 0, 0);
  };
  const fitText = (t: string, x: number, y: number, maxW: number, size: number) => {
    doc.setFontSize(size);
    let s = t;
    while (s.length > 3 && doc.getTextWidth(s) > maxW) s = s.slice(0, -2);
    doc.text(s === t ? t : s + '…', x, y);
  };
  label('CÔNG TRÌNH', x0 + 2, y0 + 4);
  fitText(o.info.project, x0 + 2, y0 + 10, c1 - x0 - 4, 11);
  fitText(o.info.address, x0 + 2, y0 + 16, c1 - x0 - 4, 8);
  label('Người khảo sát: ' + (o.info.surveyor || '—'), x0 + 2, y0 + 23);
  label('BẢN VẼ', c1 + 2, y0 + 4);
  fitText('MẶT BẰNG HIỆN TRẠNG', c1 + 2, y0 + 10, c2 - c1 - 4, 10);
  fitText(o.info.sheet, c1 + 2, y0 + 16, c2 - c1 - 4, 8.5);
  if (o.info.note) fitText(o.info.note, c1 + 2, y0 + 23, c2 - c1 - 4, 6.5);
  label('TỶ LỆ', c2 + 2, y0 + 4);
  doc.setFontSize(12);
  doc.text(`1:${scale}`, c2 + 2, y0 + 11);
  doc.setFontSize(7);
  doc.text(`Khổ ${o.paper} · Đơn vị: mm`, c2 + 22, y0 + 11);
  label('NGÀY', c2 + 2, y0 + TB_H / 2 + 4);
  doc.setFontSize(9);
  doc.text(o.info.date, c2 + 2, y0 + TB_H / 2 + 10);
}
