import { activeFloor, commit, store, useStore } from '../store/store';
import { newFloor, newRoom, uid } from '../model/factory';
import { innerArea } from '../geometry/boundary';
import { bbox } from '../geometry/polygon';
import { translateBoundary, translatePoints } from '../model/ops';
import { NumberField, Section, TextField } from './controls';
import { editorBus } from './editorBus';
import { askConfirm } from './confirm';

/** Danh sách tầng & phòng trong dự án */
export function RoomsPanel() {
  const project = useStore((s) => s.project);
  const floor = useStore((s) => activeFloor(s));
  const roomId = useStore((s) => s.ui.roomId);
  if (!project || !floor) return null;

  const addRoom = () => {
    const id = uid('r');
    commit((p) => {
      const f = p.floors.find((x) => x.id === floor.id)!;
      const r = newRoom(`Phòng ${f.rooms.length + 1}`, p.settings.defaultThickness);
      r.id = id;
      f.rooms.push(r);
    });
    store.ui({ roomId: id, tool: 'draw', panel: 'draw', selection: null });
    // đặt khung nhìn cạnh các phòng hiện có
    const pts = floor.rooms.flatMap((r) => r.boundary.vertices);
    const bb = bbox(pts);
    if (bb) editorBus.ctl?.ensureVisible({ x: bb.maxX + 1500, y: bb.minY });
  };

  return (
    <div className="panel-body" data-testid="rooms-panel">
      <Section
        title="Tầng"
        right={
          <button
            className="btn small"
            onClick={() => {
              const id = uid('f');
              commit((p) => {
                const f = newFloor(`Tầng ${p.floors.length + 1}`, (p.floors[p.floors.length - 1]?.elevation ?? 0) + 3300);
                f.id = id;
                const r = newRoom('Phòng 1', p.settings.defaultThickness);
                f.rooms.push(r);
                p.floors.push(f);
              });
              const nf = store.get().project!.floors.find((f) => f.id === id)!;
              store.ui({ floorId: id, roomId: nf.rooms[0].id, tool: 'draw', panel: 'draw', selection: null });
              editorBus.ctl?.fitAll();
            }}
          >
            + Tầng
          </button>
        }
      >
        <div className="chips">
          {project.floors.map((f) => (
            <button
              key={f.id}
              className={'chip' + (f.id === floor.id ? ' on' : '')}
              onClick={() => {
                store.ui({ floorId: f.id, roomId: f.rooms[0]?.id ?? null, selection: null });
                setTimeout(() => editorBus.ctl?.fitAll());
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="row">
          <TextField label="Tên tầng" value={floor.name} onCommit={(v) => commit((p) => void (p.floors.find((x) => x.id === floor.id)!.name = v || 'Tầng'))} />
          <NumberField label="Cao độ sàn" value={floor.elevation} onCommit={(v) => commit((p) => void (p.floors.find((x) => x.id === floor.id)!.elevation = v ?? 0))} />
        </div>
        {project.floors.length > 1 && (
          <button
            className="btn small danger"
            onClick={async () => {
              if (!(await askConfirm(`Xóa ${floor.name} và toàn bộ ${floor.rooms.length} phòng?`, { ok: 'Xóa tầng', danger: true }))) return;
              commit((p) => void (p.floors = p.floors.filter((x) => x.id !== floor.id)));
              const f0 = store.get().project!.floors[0];
              store.ui({ floorId: f0.id, roomId: f0.rooms[0]?.id ?? null, selection: null });
            }}
          >
            Xóa tầng
          </button>
        )}
      </Section>

      <Section
        title={`Phòng trong ${floor.name}`}
        right={
          <span className="row tight">
            <button className="btn small" data-testid="add-from-library" onClick={() => store.ui({ panel: 'library' })}>
              + Từ mẫu
            </button>
            <button className="btn small primary" data-testid="add-room" onClick={addRoom}>
              + Vẽ mới
            </button>
          </span>
        }
      >
        <ul className="list">
          {floor.rooms.map((r) => (
            <li key={r.id} className={r.id === roomId ? 'on' : ''}>
              <button
                className="list-main"
                onClick={() => {
                  store.ui({ roomId: r.id, selection: null, tool: r.boundary.segments.length ? 'select' : 'draw' });
                  setTimeout(() => editorBus.ctl?.fitRoom());
                }}
              >
                <b>{r.name}</b>
                <span className="muted small">
                  {r.boundary.closed ? `${(innerArea(r.boundary) / 1e6).toFixed(2).replace('.', ',')} m² · ${r.boundary.segments.length} đoạn` : r.boundary.segments.length ? `Đang vẽ · ${r.boundary.segments.length} đoạn` : 'Chưa vẽ'}
                  {r.heights.length ? ` · ${r.heights.length} cao độ` : ''}
                </span>
              </button>
              <div className="row tight">
                <button
                  className="btn icon"
                  title="Nhân bản"
                  onClick={() =>
                    commit((p) => {
                      const f = p.floors.find((x) => x.id === floor.id)!;
                      const src = f.rooms.find((x) => x.id === r.id)!;
                      const copy = structuredClone(src);
                      copy.id = uid('r');
                      copy.name = src.name + ' (bản sao)';
                      const bb = bbox(src.boundary.vertices);
                      const dx = bb ? bb.maxX - bb.minX + 1000 : 1000;
                      copy.boundary = translateBoundary(copy.boundary, { x: dx, y: 0 });
                      copy.boundary.segments = copy.boundary.segments.map((s) => ({ ...s, id: uid('s') }));
                      const idMap = new Map<string, string>();
                      copy.heights = copy.heights.map((h) => {
                        const nid = uid('h');
                        idMap.set(h.id, nid);
                        return { ...h, id: nid };
                      });
                      copy.zones = copy.zones.map((z) => ({ ...z, id: uid('z'), levelId: idMap.get(z.levelId) ?? z.levelId, polygon: translatePoints(z.polygon, { x: dx, y: 0 }) }));
                      f.rooms.push(copy);
                      return 'Đã nhân bản phòng.';
                    })
                  }
                >
                  ⧉
                </button>
                <button
                  className="btn icon danger"
                  title="Xóa phòng"
                  onClick={async () => {
                    if (!(await askConfirm(`Xóa phòng "${r.name}"? Có thể hoàn tác bằng nút Undo.`, { ok: 'Xóa phòng', danger: true }))) return;
                    commit((p) => {
                      const f = p.floors.find((x) => x.id === floor.id)!;
                      f.rooms = f.rooms.filter((x) => x.id !== r.id);
                    });
                    const f = activeFloor();
                    store.ui({ roomId: f?.rooms[0]?.id ?? null, selection: null });
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!floor.rooms.length && <p className="muted small">Tầng chưa có phòng.</p>}
      </Section>
    </div>
  );
}
