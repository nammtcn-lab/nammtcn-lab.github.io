import { useEffect, useRef, useState } from 'react';
import { activeRoom, store, toast, updateRoom, useStore } from '../store/store';
import { buildElevation, edgeKey, edgeOf, elevationInfo, fixturesOnEdge, wallNumber } from '../drawing/elevation';
import { primsBounds, fixtureTag } from '../drawing/buildDrawing';
import { edges } from '../geometry/boundary';
import { paintPrims } from '../render/paint';
import { PRINT_STYLE, renderImage } from '../export/image';
import { writeDxf } from '../export/dxf';
import { dateStamp, safeName, saveFile } from '../export/files';
import { NumberField, Section, TextField, fmtNum } from './controls';
import { uid } from '../model/factory';
import { FIXTURES } from '../model/types';

/** Màn hình MẶT ĐỨNG của một mảng tường: xem, ghi len chân tường, ghi chú, xuất ảnh / DXF */
export function ElevationView() {
  const room = useStore((s) => activeRoom(s));
  const segIdx = useStore((s) => s.ui.elevSeg);
  const project = useStore((s) => s.project);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [noteText, setNoteText] = useState('');
  const [noteX, setNoteX] = useState<number | null>(null);
  const [noteY, setNoteY] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const e = room && segIdx != null ? edgeOf(room, segIdx) : null;
  const el = room && segIdx != null && e ? buildElevation(room, segIdx, 90) : null;

  useEffect(() => {
    const cv = canvasRef.current;
    const host = hostRef.current;
    if (!cv || !host || !el) return;
    const draw = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      const bb = primsBounds(el.prims)!;
      const pad = 16;
      const s = Math.min((w - pad * 2) / (bb.maxX - bb.minX), (h - pad * 2) / (bb.maxY - bb.minY));
      const ox = pad + ((w - pad * 2) - (bb.maxX - bb.minX) * s) / 2 - bb.minX * s;
      const oy = pad + ((h - pad * 2) - (bb.maxY - bb.minY) * s) / 2 + bb.maxY * s;
      paintPrims(ctx, el.prims, { scale: s, toScreen: (p) => ({ x: ox + p.x * s, y: oy - p.y * s }) }, { ...PRINT_STYLE, textPx: (hh) => Math.max(9, Math.min(15, hh)) });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
  });

  if (!room || segIdx == null || !e || !el || !project) return null;
  const all = edges(room.boundary);
  const n = wallNumber(room, segIdx);
  const info = elevationInfo(room, e);
  const key = edgeKey(room, e);
  const setInfo = (fn: (i: typeof info) => void) =>
    updateRoom(room.id, (r) => {
      const cur = r.elevations[key] ?? { baseboard: null, notes: [] };
      fn(cur);
      r.elevations[key] = cur;
    });
  const go = (k: number) => store.ui({ elevSeg: all[(k + all.length) % all.length].segs[0] });
  const fx = fixturesOnEdge(room, e);
  const base = safeName(`${project.name}-${room.name}-mat-dung-${n}`);

  const exportImg = async () => {
    try {
      const big = buildElevation(room, segIdx, 100);
      toast(await saveFile(await renderImage(big.prims, { format: 'png', longSide: 3000, title: `${project.name} — Mặt đứng tường ${n}` }), `${base}-${dateStamp()}.png`), 'ok');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  const exportDxf = async () => {
    try {
      toast(await saveFile(new Blob([writeDxf(buildElevation(room, segIdx, 100).prims)], { type: 'application/dxf' }), `${base}-${dateStamp()}.dxf`), 'ok', 6000);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <div className="elev" data-testid="elevation">
      <header className="elev-head">
        <button className="btn icon" onClick={() => go(all.findIndex((x) => x.segs.includes(segIdx)) - 1)} aria-label="Tường trước">
          ‹
        </button>
        <div className="elev-title">
          <b>
            Mặt đứng tường {n}/{all.length}
          </b>
          <span className="muted small">
            {room.name} · dài {fmtNum(e.length)} mm
          </span>
        </div>
        <button className="btn icon" onClick={() => go(all.findIndex((x) => x.segs.includes(segIdx)) + 1)} aria-label="Tường sau">
          ›
        </button>
        <button className="btn small" onClick={exportImg}>
          Ảnh
        </button>
        <button className="btn small" onClick={exportDxf}>
          DXF
        </button>
        <button className="btn icon" onClick={() => store.ui({ elevSeg: null })} aria-label="Đóng" data-testid="elev-close">
          ✕
        </button>
      </header>
      <div className="elev-canvas" ref={hostRef}>
        <canvas ref={canvasRef} />
      </div>
      <div className={'elev-form' + (formOpen ? ' open' : '')}>
        <button className="elev-toggle" onClick={() => setFormOpen(!formOpen)} data-testid="elev-form-toggle">
          {formOpen ? '▾ Thu gọn' : '▸ Ghi chú mặt đứng, len chân tường, thiết bị'} ({fx.length} thiết bị · {info.notes.length} ghi chú)
        </button>
        {formOpen && (
          <div className="elev-form-body">
            <NumberField label="Len chân tường cao" optional value={info.baseboard} step={10} min={0} testId="baseboard" onCommit={(v) => setInfo((i) => (i.baseboard = v))} />
            <Section title="Thiết bị trên mảng tường này">
              {!fx.length && <p className="muted small">Chưa có. Dùng công cụ Thiết bị rồi chạm sát tường để đặt.</p>}
              {fx.map((f) => (
                <div key={f.id} className="row tight between fx-row">
                  <span>
                    <b>{fixtureTag(room, f)}</b> {FIXTURES[f.type].label} · {f.w}×{f.h} · {f.height != null ? `cao ${fmtNum(f.height)}` : 'chưa đo cao'}
                  </span>
                  <button className="btn small" onClick={() => store.ui({ elevSeg: null, selection: { kind: 'fixture', roomId: room.id, fixtureId: f.id }, panel: 'props', tool: 'select' })}>
                    Sửa
                  </button>
                </div>
              ))}
            </Section>
            <Section title="Ghi chú trên mặt đứng">
              {info.notes.map((nt) => (
                <div key={nt.id} className="row tight between fx-row">
                  <span>
                    {nt.text} <span className="muted small">(x {fmtNum(nt.x)}, cao {fmtNum(nt.y)})</span>
                  </span>
                  <button className="btn icon danger" onClick={() => setInfo((i) => (i.notes = i.notes.filter((x) => x.id !== nt.id)))} aria-label="Xóa ghi chú">
                    ✕
                  </button>
                </div>
              ))}
              <TextField label="Nội dung" value={noteText} onCommit={setNoteText} placeholder="VD: ống thoát nước nổi, tủ điện, vết nứt…" testId="note-text" />
              <div className="row">
                <NumberField label="Cách góc trái" value={noteX} onCommit={setNoteX} live />
                <NumberField label="Cao độ" value={noteY} onCommit={setNoteY} live />
              </div>
              <button
                className="btn"
                data-testid="note-add"
                onClick={() => {
                  const text = (document.querySelector<HTMLInputElement>('[data-testid="note-text"]')?.value ?? noteText).trim();
                  if (!text) return toast('Nhập nội dung ghi chú.', 'warn');
                  setInfo((i) => i.notes.push({ id: uid('n'), text, x: noteX ?? e.length / 2, y: noteY ?? 1500 }));
                  setNoteText('');
                }}
              >
                + Thêm ghi chú
              </button>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
