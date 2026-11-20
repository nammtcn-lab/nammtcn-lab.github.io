import { useState } from 'react';
import { activeRoom, commit, store, updateRoom, useStore } from '../store/store';
import { HEIGHT_TYPE_LABEL, type HeightType } from '../model/types';
import { newHeight } from '../model/factory';
import { closureGap, edges, innerArea, totalLength } from '../geometry/boundary';
import { stretchRoom, translateRoom } from '../model/ops';
import { bbox } from '../geometry/polygon';
import { activeRoom as getActiveRoom } from '../store/store';
import { NumberField, Section, TextField, fmtNum } from './controls';
import { editorBus } from './editorBus';

const TYPES: HeightType[] = ['slab', 'falseCeiling', 'stepped', 'beam', 'other'];

/** Thông tin phòng: tên, số liệu, bề dày mặc định, các cao độ trần / dầm, vùng giật cấp, ghi chú */
export function RoomPanel() {
  const room = useStore((s) => activeRoom(s));
  if (!room) return <div className="empty">Chưa chọn phòng.</div>;
  const b = room.boundary;
  const gap = closureGap(b);
  const id = room.id;

  return (
    <div className="panel-body" data-testid="room-panel">
      <TextField label="Tên phòng" value={room.name} testId="room-name" onCommit={(v) => updateRoom(id, (r) => void (r.name = v || 'Phòng'))} />
      <div className="stats">
        <div>
          <span>Diện tích lòng</span>
          <b data-testid="room-area">{b.closed ? (innerArea(b) / 1e6).toFixed(2).replace('.', ',') + ' m²' : '—'}</b>
        </div>
        <div>
          <span>Chu vi trong</span>
          <b>{fmtNum(totalLength(b), 0)} mm</b>
        </div>
        <div>
          <span>Số đoạn / cạnh</span>
          <b>
            {b.segments.length} / {edges(b).length}
          </b>
        </div>
        <div>
          <span>Trạng thái</span>
          <b>{b.closed ? 'Đã khép kín' : gap ? `Hở ${fmtNum(Math.hypot(gap.x, gap.y))} mm` : 'Đang vẽ'}</b>
        </div>
      </div>

      {b.vertices.length >= 2 && <StretchBox roomId={id} />}

      <NumberField
        label="Bề dày tường mặc định của phòng"
        value={room.defaultThickness}
        step={10}
        min={10}
        testId="room-thickness"
        hint="Giá trị quy ước để biểu diễn (mặc định 140), không phải số đo xác nhận. Đoạn có bề dày riêng không bị ảnh hưởng."
        onCommit={(v) => v && v > 0 && updateRoom(id, (r) => void (r.defaultThickness = v))}
      />

      <Section title="Cao độ (tính từ sàn hoàn thiện)">
        {room.heights.length === 0 && <p className="muted small">Chưa có cao độ. Có thể bổ sung sau khi khảo sát.</p>}
        {room.heights.map((h) => (
          <div className="height-row" key={h.id} data-testid="height-row">
            <div className="row tight between">
              <select value={h.type} onChange={(e) => updateRoom(id, (r) => void (r.heights.find((x) => x.id === h.id)!.type = e.target.value as HeightType))}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {HEIGHT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <button
                className="btn icon danger"
                aria-label="Xóa cao độ"
                onClick={() =>
                  updateRoom(id, (r) => {
                    const used = r.zones.filter((z) => z.levelId === h.id).length;
                    r.heights = r.heights.filter((x) => x.id !== h.id);
                    r.zones = r.zones.filter((z) => z.levelId !== h.id);
                    return used ? `Đã xóa cao độ và ${used} vùng trần gắn với nó.` : undefined;
                  })
                }
              >
                ✕
              </button>
            </div>
            <NumberField label="Cao độ" optional value={h.value} step={10} min={0} testId={'h-' + h.type} onCommit={(v) => updateRoom(id, (r) => void (r.heights.find((x) => x.id === h.id)!.value = v))} />
            <TextField label="Tên hiển thị" value={h.label} onCommit={(v) => updateRoom(id, (r) => void (r.heights.find((x) => x.id === h.id)!.label = v))} />
            {room.zones.filter((z) => z.levelId === h.id).length > 0 && (
              <div className="muted small">
                Vùng:{' '}
                {room.zones
                  .filter((z) => z.levelId === h.id)
                  .map((z) => (
                    <button key={z.id} className="chip tiny" onClick={() => store.ui({ selection: { kind: 'zone', roomId: id, zoneId: z.id }, panel: 'props', tool: 'select' })}>
                      {z.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
        <div className="row wrap" data-testid="add-heights">
          {TYPES.map((t) => (
            <button
              key={t}
              className="btn small"
              onClick={() =>
                updateRoom(id, (r) => {
                  const k = r.heights.filter((x) => x.type === t).length;
                  r.heights.push(newHeight(t, null, t === 'stepped' ? `Giật cấp ${k + 1}` : t === 'beam' ? `Dầm D${k + 1}` : undefined));
                })
              }
            >
              + {HEIGHT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Vùng trần giật cấp (${room.zones.length})`} collapsible defaultOpen>
        <p className="muted small">Dùng công cụ <b>Vùng trần</b> rồi kéo hình chữ nhật trên vùng vẽ, sau đó gán mức cao độ cho vùng.</p>
        <div className="row wrap">
          {room.zones.map((z) => {
            const lv = room.heights.find((h) => h.id === z.levelId);
            return (
              <button key={z.id} className="chip" onClick={() => store.ui({ selection: { kind: 'zone', roomId: id, zoneId: z.id }, panel: 'props', tool: 'select' })}>
                {z.name}: {lv ? `${lv.label} ${lv.value != null ? fmtNum(lv.value) : '?'}` : 'chưa gán'}
              </button>
            );
          })}
        </div>
        <button className="btn" data-testid="zone-tool" onClick={() => store.ui({ tool: 'zone', panel: 'none', selection: null })}>
          Vẽ vùng trần mới
        </button>
      </Section>

      <TextField label="Ghi chú khảo sát" multiline value={room.notes} onCommit={(v) => updateRoom(id, (r) => void (r.notes = v))} />

      <Section title="Di chuyển phòng" collapsible defaultOpen={false}>
        <MoveRoom roomId={id} />
      </Section>
    </div>
  );
}

function MoveRoom({ roomId }: { roomId: string }) {
  const [dx0, setDx] = useState<number | null>(null);
  const [dy0, setDy] = useState<number | null>(null);
  const dx = dx0 ?? 0;
  const dy = dy0 ?? 0;
  return (
    <>
      <div className="row">
        <NumberField label="Dời theo X" value={null} onCommit={setDx} live />
        <NumberField label="Dời theo Y" value={null} onCommit={setDy} live />
      </div>
      <button
        className="btn"
        onClick={() => {
          if (!dx && !dy) return;
          commit((p) => {
            for (const f of p.floors)
              for (const r of f.rooms)
                if (r.id === roomId) {
                  translateRoom(r, { x: dx, y: dy });
                }
            return 'Đã dời phòng (toàn bộ tọa độ tịnh tiến, kích thước không đổi).';
          });
          editorBus.ctl?.fitAll();
        }}
      >
        Dời phòng
      </button>
    </>
  );
}

/** Kích thước bao của phòng — nhập số mới để co giãn cả phòng (cửa giữ nguyên bề rộng) */
function StretchBox({ roomId }: { roomId: string }) {
  const room = useStore((s) => getActiveRoom(s));
  const bb = room ? bbox(room.boundary.vertices) : null;
  if (!room || !bb) return null;
  const W = bb.maxX - bb.minX;
  const D = bb.maxY - bb.minY;
  const go = (axis: 'x' | 'y', v: number | null) => {
    if (v == null) return;
    updateRoom(roomId, (r) => stretchRoom(r, axis, v) || undefined);
    editorBus.ctl?.fitRoom();
  };
  return (
    <Section title="Co giãn cả phòng (kích thước bao thông thủy)">
      <div className="row">
        <NumberField label="Rộng X" value={W} min={1} testId="stretch-x" onCommit={(v) => go('x', v)} />
        <NumberField label="Sâu Y" value={D} min={1} testId="stretch-y" onCommit={(v) => go('y', v)} />
      </div>
      <p className="muted small">Phần tường ở giữa phòng được kéo dài/thu ngắn; cửa đi, cửa sổ giữ nguyên bề rộng. Muốn dời từng cạnh: dùng công cụ Chọn rồi kéo cạnh tường.</p>
    </Section>
  );
}
