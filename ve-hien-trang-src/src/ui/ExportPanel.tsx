import { useState } from 'react';
import { activeFloor, activeRoom, flushSave, toast, useStore } from '../store/store';
import { buildDrawing, DEFAULT_DRAW } from '../drawing/buildDrawing';
import { writeDxf } from '../export/dxf';
import { renderImage } from '../export/image';
import { autoScale, SCALES, writePdf, type Orientation, type Paper } from '../export/pdf';
import { canShareFiles, dateStamp, safeName, saveFile, shareBlob } from '../export/files';
import { Chips, Section } from './controls';
import type { Room } from '../model/types';

type Scope = 'room' | 'floor';

export function ExportPanel() {
  const project = useStore((s) => s.project);
  const floor = useStore((s) => activeFloor(s));
  const room = useStore((s) => activeRoom(s));
  const [scope, setScope] = useState<Scope>('floor');
  const [annot, setAnnot] = useState(50);
  const [dims, setDims] = useState(true);
  const [paper, setPaper] = useState<Paper>('A4');
  const [orient, setOrient] = useState<Orientation>('landscape');
  const [scale, setScale] = useState(0);
  const [titleBlock, setTitleBlock] = useState(true);
  const [imgFmt, setImgFmt] = useState<'png' | 'jpeg'>('png');
  const [imgSize, setImgSize] = useState(4000);
  const [busy, setBusy] = useState('');
  const share = canShareFiles();
  if (!project || !floor) return null;

  const rooms = (): Room[] => (scope === 'room' ? (room ? [room] : []) : floor.rooms);
  const sheet = scope === 'room' && room ? `${floor.name} — ${room.name}` : floor.name;
  const base = safeName(`${project.name}-${scope === 'room' && room ? room.name : floor.name}`);
  const opts = (textHeight: number) => ({ ...DEFAULT_DRAW, dims, textHeight, partitionThickness: project.settings.partitionThickness });

  const deliver = async (blob: Blob, name: string, viaShare: boolean) => {
    if (viaShare) {
      const r = await shareBlob(blob, name, project.name);
      if (r === 'downloaded') toast('Thiết bị không hỗ trợ chia sẻ file — đã tải về.', 'info');
    } else toast(await saveFile(blob, name), 'ok', 5000);
  };
  const run = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast('Xuất thất bại: ' + (e as Error).message, 'error');
    } finally {
      setBusy('');
    }
  };
  const empty = () => {
    if (!rooms().some((r) => r.boundary.segments.length)) {
      toast('Chưa có hình học để xuất.', 'warn');
      return true;
    }
    return false;
  };

  const doDxf = (viaShare: boolean) =>
    run('dxf', async () => {
      if (empty()) return;
      const txt = writeDxf(buildDrawing(rooms(), opts(2.5 * annot)).prims);
      await deliver(new Blob([txt], { type: 'application/dxf' }), `${base}-${dateStamp()}.dxf`, viaShare);
    });

  const doPdf = (viaShare: boolean) =>
    run('pdf', async () => {
      if (empty()) return;
      const probe = buildDrawing(rooms(), opts(125)).bounds!;
      const s = scale || autoScale(probe, { paper, orientation: orient, titleBlock });
      const prims = buildDrawing(rooms(), opts(2.2 * s)).prims;
      const res = await writePdf(prims, {
        paper,
        orientation: orient,
        scale: s,
        titleBlock,
        info: { project: project.name, address: project.address, sheet, surveyor: project.surveyor, date: new Date().toLocaleDateString('vi-VN'), note: 'Kích thước thông thủy theo mặt trong tường (mm)' },
      });
      if (!res.fits) toast(`Bản vẽ vượt khổ ${paper} ở tỷ lệ 1:${res.scale} — phần thừa bị cắt. Hãy chọn tỷ lệ nhỏ hơn hoặc khổ lớn hơn.`, 'warn', 6000);
      await deliver(res.blob, `${base}-1-${res.scale}-${dateStamp()}.pdf`, viaShare);
    });

  const doImg = (viaShare: boolean) =>
    run('img', async () => {
      if (empty()) return;
      const prims = buildDrawing(rooms(), opts(2.5 * annot)).prims;
      const blob = await renderImage(prims, { format: imgFmt, longSide: imgSize, title: `${project.name} — ${sheet}` });
      await deliver(blob, `${base}-${dateStamp()}.${imgFmt === 'png' ? 'png' : 'jpg'}`, viaShare);
    });

  const doJson = (viaShare: boolean) =>
    run('json', async () => {
      await flushSave();
      const blob = new Blob([JSON.stringify({ app: 've-hien-trang', exportedAt: new Date().toISOString(), project }, null, 1)], { type: 'application/json' });
      await deliver(blob, `${safeName(project.name)}-${dateStamp()}.json`, viaShare);
    });

  const Btns = ({ go, id, label }: { go: (s: boolean) => void; id: string; label: string }) => (
    <div className="row wrap">
      <button className="btn primary" data-testid={'export-' + id} disabled={!!busy} onClick={() => go(false)}>
        {busy === id ? 'Đang xuất…' : `Tải ${label}`}
      </button>
      {share && (
        <button className="btn" disabled={!!busy} onClick={() => go(true)}>
          Chia sẻ…
        </button>
      )}
    </div>
  );

  return (
    <div className="panel-body" data-testid="export-panel">
      <div className="field">
        <span className="flabel">Phạm vi</span>
        <Chips value={scope} onChange={setScope} options={[{ value: 'floor', label: `Cả ${floor.name} (${floor.rooms.length} phòng)` }, { value: 'room', label: `Phòng: ${room?.name ?? '—'}` }]} />
      </div>
      <div className="row wrap">
        <label className="check">
          <input type="checkbox" checked={dims} onChange={(e) => setDims(e.target.checked)} /> Ghi kích thước
        </label>
      </div>

      <Section title="DXF — AutoCAD (vector, mm, 1:1)">
        <div className="field">
          <span className="flabel">Cỡ chữ chú thích theo tỷ lệ in dự kiến</span>
          <Chips small value={annot} onChange={setAnnot} options={[20, 50, 100].map((v) => ({ value: v, label: `1:${v}` }))} />
        </div>
        <Btns go={doDxf} id="dxf" label="DXF" />
        <p className="muted small">Layer: WALL_INNER, WALL_OUTER, DOOR, WINDOW, OPENING, DIMENSION, TEXT, AXIS, CEILING. Thực thể LINE / LWPOLYLINE / ARC / TEXT. Kích thước xuất dạng nét + chữ (chưa dùng thực thể DIMENSION liên kết).</p>
      </Section>

      <Section title="PDF — in theo tỷ lệ">
        <div className="row wrap">
          <Chips small value={paper} onChange={setPaper} options={[{ value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }]} />
          <Chips small value={orient} onChange={setOrient} options={[{ value: 'landscape', label: 'Ngang' }, { value: 'portrait', label: 'Dọc' }]} />
        </div>
        <div className="field">
          <span className="flabel">Tỷ lệ</span>
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))} data-testid="pdf-scale">
            <option value={0}>Tự động (vừa khổ giấy)</option>
            {SCALES.map((s) => (
              <option key={s} value={s}>
                1:{s}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={titleBlock} onChange={(e) => setTitleBlock(e.target.checked)} /> Khung tên
        </label>
        <Btns go={doPdf} id="pdf" label="PDF" />
      </Section>

      <Section title="Ảnh PNG / JPG">
        <div className="row wrap">
          <Chips small value={imgFmt} onChange={setImgFmt} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]} />
          <Chips small value={imgSize} onChange={setImgSize} options={[2000, 4000, 6000].map((v) => ({ value: v, label: `${v}px` }))} />
        </div>
        <Btns go={doImg} id="img" label="ảnh" />
      </Section>

      <Section title="Sao lưu dữ liệu">
        <Btns go={doJson} id="json" label="file JSON" />
        <p className="muted small">File JSON chứa toàn bộ dự án (tọa độ mm, cửa, cao độ…). Khôi phục ở màn hình Danh sách dự án.</p>
      </Section>
    </div>
  );
}
