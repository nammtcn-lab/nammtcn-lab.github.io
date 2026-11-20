import { useMemo, useState } from 'react';
import { activeFloor, activeRoom, commit, store, toast, useStore } from '../store/store';
import { TEMPLATES, buildTemplateRooms, type RoomTemplate } from '../model/templates';
import { newRoom, uid } from '../model/factory';
import { buildRoomPrims, DEFAULT_DRAW, primsBounds } from '../drawing/buildDrawing';
import type { Prim } from '../drawing/primitives';
import type { Room } from '../model/types';
import { NumberField, TextField } from './controls';
import { editorBus } from './editorBus';

/** Thư viện mặt bằng mẫu: chọn → nhập kích thước bao → chèn → co kéo cho khớp hiện trạng */
export function LibraryPanel() {
  const [pick, setPick] = useState<RoomTemplate | null>(null);
  return (
    <div className="panel-body" data-testid="library-panel">
      {!pick && (
        <>
          <p className="muted small">Chọn mặt bằng gần giống hiện trạng, chèn vào rồi kéo các cạnh hoặc nhập số đo để chỉnh cho khớp — không phải vẽ lại từ đầu.</p>
          <div className="tpl-grid">
            {TEMPLATES.map((t) => (
              <button key={t.id} className="tpl" data-testid={'tpl-' + t.id} onClick={() => setPick(t)}>
                <Thumb t={t} />
                <b>{t.name}</b>
                <span className="muted small">
                  {t.w} × {t.d}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {pick && <InsertForm t={pick} onBack={() => setPick(null)} />}
    </div>
  );
}

function InsertForm({ t, onBack }: { t: RoomTemplate; onBack: () => void }) {
  const [w, setW] = useState<number | null>(t.w);
  const [d, setD] = useState<number | null>(t.d);
  const [name, setName] = useState(t.name);
  const room = useStore((s) => activeRoom(s));
  const replaceEmpty = !!room && room.boundary.vertices.length === 0;
  return (
    <div data-testid="tpl-form">
      <button className="btn small" onClick={onBack}>
        ‹ Thư viện
      </button>
      <h3 className="tpl-title">{t.name}</h3>
      <p className="muted small">{t.desc}</p>
      <div className="tpl-preview">
        <Thumb t={t} w={w ?? t.w} d={d ?? t.d} big />
      </div>
      <TextField label="Tên phòng" value={name} onCommit={setName} />
      <div className="row">
        <NumberField label="Rộng thông thủy (X)" value={w} onCommit={setW} live step={100} min={t.minW} testId="tpl-w" />
        <NumberField label="Sâu thông thủy (Y)" value={d} onCommit={setD} live step={100} min={t.minD} testId="tpl-d" />
      </div>
      <p className="muted small">Tối thiểu {t.minW} × {t.minD} mm. Có thể co kéo tiếp sau khi chèn.</p>
      <button
        className="btn primary big"
        data-testid="tpl-insert"
        onClick={() => {
          const W = w ?? t.w;
          const D = d ?? t.d;
          insertTemplate(t, W, D, name || t.name, replaceEmpty);
        }}
      >
        {replaceEmpty ? `Dùng cho "${room!.name}"` : 'Chèn thành phòng mới'}
      </button>
    </div>
  );
}

export function insertTemplate(t: RoomTemplate, W: number, D: number, name: string, replaceEmpty: boolean) {
  const s = store.get();
  const floor = activeFloor(s);
  if (!s.project || !floor) return;
  // đặt cạnh các phòng đã có
  let origin = { x: 0, y: 0 };
  const others = floor.rooms.filter((r) => r.boundary.vertices.length);
  if (others.length) {
    const b = primsBounds(others.flatMap((r) => buildRoomPrims(r, { ...DEFAULT_DRAW, labels: false })));
    if (b) origin = { x: Math.round((b.maxX + 1200) / 100) * 100, y: Math.round(Math.max(0, b.minY + 1000) / 100) * 100 };
  }
  const built = buildTemplateRooms(t, W, D, origin, name);
  const target = replaceEmpty ? activeRoom(s)!.id : uid('r');
  commit((p) => {
    const f = p.floors.find((x) => x.id === floor.id)!;
    built.forEach((br, k) => {
      const id = k === 0 ? target : uid('r');
      let r: Room | undefined = f.rooms.find((x) => x.id === id);
      if (!r) {
        r = newRoom(br.name, p.settings.defaultThickness);
        r.id = id;
        f.rooms.push(r);
      }
      r.name = br.name;
      r.boundary = br.boundary;
      r.fixtures = br.fixtures;
      if (br.thickness) r.defaultThickness = br.thickness;
    });
    return built.length > 1 ? `Đã chèn ${built.length} phòng từ mẫu "${t.name}".` : `Đã chèn mẫu "${t.name}".`;
  });
  store.ui({ roomId: target, tool: 'select', panel: 'none', selection: null });
  toast(`Đã chèn "${name}". Kéo cạnh tường để co kéo cho khớp hiện trạng.`, 'ok', 5000);
  setTimeout(() => editorBus.ctl?.fitRoom(), 30);
}

/** Hình thu nhỏ của mẫu (vẽ bằng SVG từ chính bộ tạo bản vẽ) */
function Thumb({ t, w, d, big }: { t: RoomTemplate; w?: number; d?: number; big?: boolean }) {
  const prims = useMemo(() => {
    return buildTemplateRooms(t, w ?? t.w, d ?? t.d).flatMap((br) => {
      const r = newRoom('');
      r.boundary = br.boundary;
      r.fixtures = br.fixtures;
      return buildRoomPrims(r, { ...DEFAULT_DRAW, dims: false, labels: false, zones: false });
    });
  }, [t, w, d]);
  const b = primsBounds(prims)!;
  const pad = 150;
  const vb = `${b.minX - pad} ${-(b.maxY + pad)} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
  return (
    <svg className={big ? 'thumb big' : 'thumb'} viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {prims.map((p, i) => svgPrim(p, i))}
    </svg>
  );
}

const COLOR: Record<string, string> = { WALL_INNER: '#16202c', WALL_OUTER: '#4b5866', DOOR: '#d9730d', WINDOW: '#0a8fc2', OPENING: '#a347b8' };

function svgPrim(p: Prim, k: number) {
  const pts = (arr: { x: number; y: number }[]) => arr.map((v) => `${v.x},${-v.y}`).join(' ');
  const sw = 'var(--thumb-sw, 30)';
  if (p.t === 'fill') return <polygon key={k} points={pts(p.pts)} fill="#c9d1da" stroke="#c9d1da" strokeWidth={10} />;
  if (p.t === 'poly')
    return p.closed ? (
      <polygon key={k} points={pts(p.pts)} fill="none" stroke={COLOR[p.layer] ?? '#333'} style={{ strokeWidth: sw }} />
    ) : (
      <polyline key={k} points={pts(p.pts)} fill="none" stroke={COLOR[p.layer] ?? '#333'} style={{ strokeWidth: sw }} />
    );
  if (p.t === 'line') return <line key={k} x1={p.a.x} y1={-p.a.y} x2={p.b.x} y2={-p.b.y} stroke={COLOR[p.layer] ?? '#333'} style={{ strokeWidth: sw }} strokeDasharray={p.layer === 'OPENING' ? '80 60' : undefined} />;
  if (p.t === 'arc') {
    const r0 = (p.a0 * Math.PI) / 180;
    const r1 = (p.a1 * Math.PI) / 180;
    const x0 = p.c.x + p.r * Math.cos(r0);
    const y0 = -(p.c.y + p.r * Math.sin(r0));
    const x1 = p.c.x + p.r * Math.cos(r1);
    const y1 = -(p.c.y + p.r * Math.sin(r1));
    const sweep = (p.a1 - p.a0 + 360) % 360;
    return <path key={k} d={`M${x0},${y0} A${p.r},${p.r} 0 ${sweep > 180 ? 1 : 0} 0 ${x1},${y1}`} fill="none" stroke={COLOR.DOOR} style={{ strokeWidth: sw }} />;
  }
  return null;
}
