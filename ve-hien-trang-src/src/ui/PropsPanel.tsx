import { useState } from 'react';
import { activeFloor, applyOp, commit, findRoom, store, toast, updateRoom, useStore } from '../store/store';
import {
  DOOR_STYLE_LABEL,
  SEGMENT_KIND_LABEL,
  WINDOW_STYLE_LABEL,
  SUGGEST,
  HEIGHT_TYPE_LABEL,
  type DoorStyle,
  type Room,
  type SegmentKind,
  type WindowStyle,
} from '../model/types';
import {
  deleteSegment,
  insertOpening,
  mergeWithNext,
  openAt,
  setKind,
  setSegmentEnds,
  setSegmentLength,
  setVertex,
  splitEqual,
  splitSegment,
  updateSegment,
  translateBoundary,
  translatePoints,
  type LengthMode,
} from '../model/ops';
import { collinearNext, segAngle, segEnds, segLength } from '../geometry/boundary';
import { effectiveThickness } from '../geometry/walls';
import { Chips, NumberField, Section, TextField, fmtNum } from './controls';

const KINDS: SegmentKind[] = ['wall', 'door', 'window', 'opening', 'partition'];

export function PropsPanel() {
  const sel = useStore((s) => s.ui.selection);
  const project = useStore((s) => s.project);
  if (!sel || !project) return <div className="empty">Chạm vào một đoạn tường, đỉnh hoặc vùng trần để xem thuộc tính.</div>;
  const room = findRoom(project, sel.roomId);
  if (!room) return null;
  if (sel.kind === 'segment' && sel.index < room.boundary.segments.length) return <SegmentProps room={room} index={sel.index} />;
  if (sel.kind === 'vertex' && sel.index < room.boundary.vertices.length) return <VertexProps room={room} index={sel.index} />;
  if (sel.kind === 'zone') return <ZoneProps room={room} zoneId={sel.zoneId} />;
  return null;
}

function SegmentProps({ room, index }: { room: Room; index: number }) {
  const b = room.boundary;
  const seg = b.segments[index];
  const n = b.segments.length;
  const L = segLength(b, index);
  const [a, c] = segEnds(b, index);
  const partitionT = useStore((s) => s.project?.settings.partitionThickness ?? 100);
  const [mode, setMode] = useState<LengthMode>('shift');
  const [insKind, setInsKind] = useState<SegmentKind>('door');
  const [insOff, setInsOff] = useState<number | null>(null);
  const [insW, setInsW] = useState<number | null>(null);
  const [splitAt, setSplitAt] = useState<number | null>(null);
  const eff = effectiveThickness(b, index, { defaultThickness: room.defaultThickness, partitionThickness: partitionT });
  const isOpen = seg.kind === 'door' || seg.kind === 'window' || seg.kind === 'opening';
  const go = (i: number) => store.ui({ selection: { kind: 'segment', roomId: room.id, index: (i + n) % n } });
  const patch = (p: Parameters<typeof updateSegment>[2]) => applyOp(room.id, (bd) => updateSegment(bd, index, p));
  const canMerge = (b.closed || index < n - 1) && n > 2 && seg.kind === b.segments[(index + 1) % n].kind && collinearNext(b, index, (index + 1) % n, 0.5);

  return (
    <div className="panel-body" data-testid="seg-props">
      <div className="row between">
        <div className="row tight">
          <button className="btn icon" onClick={() => go(index - 1)} aria-label="Đoạn trước">
            ‹
          </button>
          <b>
            Đoạn #{index + 1}/{n}
          </b>
          <button className="btn icon" onClick={() => go(index + 1)} aria-label="Đoạn sau">
            ›
          </button>
        </div>
        <span className="muted small">
          {room.name} · hướng {fmtNum(segAngle(b, index))}°
        </span>
      </div>

      <div className="field">
        <span className="flabel">Loại đối tượng</span>
        <Chips value={seg.kind} onChange={(k) => applyOp(room.id, (bd) => setKind(bd, index, k))} options={KINDS.map((k) => ({ value: k, label: SEGMENT_KIND_LABEL[k] }))} testId="seg-kind" />
      </div>

      <NumberField
        big
        label={isOpen ? 'Chiều rộng' : 'Chiều dài'}
        required={isOpen}
        value={L}
        min={1}
        step={10}
        testId="seg-length"
        onCommit={(v) => {
          if (v == null || !(v > 0)) {
            toast(isOpen ? 'Chiều rộng cửa là bắt buộc.' : 'Chiều dài phải lớn hơn 0.', 'warn');
            return;
          }
          applyOp(room.id, (bd) => setSegmentLength(bd, index, v, mode));
        }}
      />
      <div className="field">
        <span className="flabel">Khi đổi chiều dài</span>
        <Chips
          small
          value={mode}
          onChange={setMode}
          options={[
            { value: 'shift', label: 'Dời toàn bộ phần phía sau' },
            { value: 'moveEnd', label: 'Chỉ dời điểm cuối' },
          ]}
        />
        <p className="muted small">
          {mode === 'shift'
            ? b.closed
              ? 'Các đoạn sau giữ nguyên chiều dài & hướng; đoạn khép kín cuối cùng (nối về điểm đầu) sẽ thay đổi theo.'
              : 'Các đoạn sau giữ nguyên chiều dài & hướng, được tịnh tiến theo.'
            : 'Chỉ đoạn kế tiếp thay đổi (chiều dài/hướng) để nối với điểm cuối mới.'}{' '}
          Ứng dụng sẽ báo các đoạn bị ảnh hưởng.
        </p>
      </div>

      {seg.kind === 'door' && seg.door && (
        <Section title="Thông tin cửa đi">
          <NumberField label="Chiều cao cửa" optional value={seg.door.height} suggest={SUGGEST.doorHeight} step={50} min={0} testId="door-height" onCommit={(v) => patch({ door: { ...seg.door!, height: v } })} />
          <div className="field">
            <span className="flabel">
              Kiểu cửa <em className="opt">không bắt buộc</em>
            </span>
            <Chips small value={seg.door.style} onChange={(v) => patch({ door: { ...seg.door!, style: v as DoorStyle } })} options={Object.entries(DOOR_STYLE_LABEL).map(([k, l]) => ({ value: k as DoorStyle, label: l }))} />
          </div>
          <div className="row wrap">
            <div className="field">
              <span className="flabel">Bản lề</span>
              <Chips small value={seg.door.hinge} onChange={(v) => patch({ door: { ...seg.door!, hinge: v } })} options={[{ value: 'start', label: 'Đầu đoạn' }, { value: 'end', label: 'Cuối đoạn' }]} />
            </div>
            <div className="field">
              <span className="flabel">Hướng mở</span>
              <Chips small value={seg.door.swing} onChange={(v) => patch({ door: { ...seg.door!, swing: v } })} options={[{ value: 'in', label: 'Vào trong' }, { value: 'out', label: 'Ra ngoài' }]} />
            </div>
          </div>
          <TextField label="Ghi chú" value={seg.door.note} onCommit={(v) => patch({ door: { ...seg.door!, note: v } })} />
        </Section>
      )}
      {seg.kind === 'window' && seg.window && (
        <Section title="Thông tin cửa sổ">
          <div className="row wrap">
            <NumberField label="Cao độ bậu" optional value={seg.window.sillHeight} suggest={SUGGEST.windowSill} step={50} min={0} testId="win-sill" onCommit={(v) => patch({ window: { ...seg.window!, sillHeight: v } })} />
            <NumberField label="Chiều cao cửa sổ" optional value={seg.window.height} suggest={SUGGEST.windowHeight} step={50} min={0} testId="win-height" onCommit={(v) => patch({ window: { ...seg.window!, height: v } })} />
          </div>
          <div className="field">
            <span className="flabel">
              Kiểu cửa <em className="opt">không bắt buộc</em>
            </span>
            <Chips small value={seg.window.style} onChange={(v) => patch({ window: { ...seg.window!, style: v as WindowStyle } })} options={Object.entries(WINDOW_STYLE_LABEL).map(([k, l]) => ({ value: k as WindowStyle, label: l }))} />
          </div>
          <TextField label="Ghi chú" value={seg.window.note} onCommit={(v) => patch({ window: { ...seg.window!, note: v } })} />
        </Section>
      )}
      {seg.kind === 'opening' && seg.opening && (
        <Section title="Thông tin ô mở">
          <NumberField label="Chiều cao ô mở" optional value={seg.opening.height} step={50} min={0} onCommit={(v) => patch({ opening: { ...seg.opening!, height: v } })} />
          <TextField label="Ghi chú" value={seg.opening.note} onCommit={(v) => patch({ opening: { ...seg.opening!, note: v } })} />
        </Section>
      )}

      <Section title="Bề dày tường" collapsible defaultOpen={!isOpen}>
        <NumberField
          label={seg.thickness == null ? `Đang dùng ${fmtNum(eff)} mm (${isOpen ? 'theo tường chứa cửa' : seg.kind === 'partition' ? 'mặc định vách' : 'mặc định phòng — quy ước, chưa xác nhận'})` : 'Bề dày riêng của đoạn'}
          value={seg.thickness}
          optional
          step={10}
          min={0}
          placeholder={fmtNum(eff)}
          testId="seg-thickness"
          onCommit={(v) => patch({ thickness: v && v > 0 ? v : null })}
          hint="Bỏ trống = dùng mặc định. Chỉ thay đổi đường biên ngoài, không đổi số đo gốc."
        />
      </Section>

      <Section title="Tọa độ điểm đầu / điểm cuối" collapsible defaultOpen={false}>
        <div className="row">
          <NumberField label="Đầu X" value={a.x} onCommit={(v) => v != null && applyOp(room.id, (bd) => setSegmentEnds(bd, index, { x: v, y: a.y }, c))} />
          <NumberField label="Đầu Y" value={a.y} onCommit={(v) => v != null && applyOp(room.id, (bd) => setSegmentEnds(bd, index, { x: a.x, y: v }, c))} />
        </div>
        <div className="row">
          <NumberField label="Cuối X" value={c.x} onCommit={(v) => v != null && applyOp(room.id, (bd) => setSegmentEnds(bd, index, a, { x: v, y: c.y }))} />
          <NumberField label="Cuối Y" value={c.y} onCommit={(v) => v != null && applyOp(room.id, (bd) => setSegmentEnds(bd, index, a, { x: c.x, y: v }))} />
        </div>
      </Section>

      {!isOpen && (
        <Section title="Chèn cửa vào đoạn này" collapsible defaultOpen={false}>
          <Chips small value={insKind} onChange={setInsKind} options={(['door', 'window', 'opening'] as SegmentKind[]).map((k) => ({ value: k, label: SEGMENT_KIND_LABEL[k] }))} />
          <div className="row">
            <NumberField label="Cách điểm đầu" value={insOff} onCommit={setInsOff} live testId="ins-offset" />
            <NumberField label="Chiều rộng" required value={insW} onCommit={setInsW} live testId="ins-width" />
          </div>
          <button
            className="btn primary"
            data-testid="ins-apply"
            onClick={() => {
              if (insW == null) return toast('Chiều rộng cửa là bắt buộc.', 'warn');
              const r = applyOp(room.id, (bd) => insertOpening(bd, index, insOff ?? 0, insW, insKind));
              if (r) store.ui({ selection: { kind: 'segment', roomId: room.id, index: (insOff ?? 0) > 0.5 ? index + 1 : index } });
            }}
          >
            Chèn {SEGMENT_KIND_LABEL[insKind].toLowerCase()}
          </button>
          <p className="muted small">Đoạn {fmtNum(L)} mm được chia thành tường | cửa | tường, tổng chiều dài cạnh không đổi.</p>
        </Section>
      )}

      <Section title="Chia / gộp / xóa" collapsible defaultOpen={false}>
        <div className="row wrap">
          <button className="btn" onClick={() => applyOp(room.id, (bd) => splitEqual(bd, index, 2))}>
            Chia đôi
          </button>
          <button className="btn" onClick={() => applyOp(room.id, (bd) => splitEqual(bd, index, 3))}>
            Chia 3
          </button>
          <button className="btn" disabled={!canMerge} onClick={() => applyOp(room.id, (bd) => mergeWithNext(bd, index))} title="Gộp với đoạn kế tiếp cùng loại, thẳng hàng">
            Gộp với đoạn sau
          </button>
        </div>
        <div className="row">
          <NumberField label="Chia tại (cách điểm đầu)" value={splitAt} onCommit={setSplitAt} live />
          <button className="btn" onClick={() => splitAt != null && applyOp(room.id, (bd) => splitSegment(bd, index, [splitAt]))}>
            Chia
          </button>
        </div>
        <div className="row wrap">
          {b.closed && (
            <button className="btn" onClick={() => applyOp(room.id, (bd) => openAt(bd, index))}>
              Mở chu vi tại đây
            </button>
          )}
          <button
            className="btn danger"
            data-testid="seg-delete"
            onClick={() => {
              const r = applyOp(room.id, (bd) => deleteSegment(bd, index));
              if (r) store.ui({ selection: null });
            }}
          >
            Xóa đoạn
          </button>
        </div>
      </Section>
    </div>
  );
}

function VertexProps({ room, index }: { room: Room; index: number }) {
  const v = room.boundary.vertices[index];
  return (
    <div className="panel-body" data-testid="vertex-props">
      <b>
        Đỉnh #{index + 1} {index === 0 && <span className="muted">(điểm đầu chuỗi)</span>}
      </b>
      <div className="row">
        <NumberField label="X" value={v.x} testId="vx" onCommit={(x) => x != null && applyOp(room.id, (b) => setVertex(b, index, { x, y: v.y }))} />
        <NumberField label="Y" value={v.y} testId="vy" onCommit={(y) => y != null && applyOp(room.id, (b) => setVertex(b, index, { x: v.x, y }))} />
      </div>
      <p className="muted small">Kéo đỉnh trên vùng vẽ để dời (có bắt điểm). Hai đoạn kề với đỉnh sẽ thay đổi theo.</p>
      <button
        className="btn"
        onClick={() =>
          commit((p) => {
            const f = p.floors.find((ff) => ff.rooms.some((r) => r.id === room.id))!;
            const d = { x: -v.x, y: -v.y };
            for (const r of f.rooms) {
              r.boundary = translateBoundary(r.boundary, d);
              r.zones = r.zones.map((z) => ({ ...z, polygon: translatePoints(z.polygon, d) }));
            }
            return 'Đã đặt gốc tọa độ (0,0) tại đỉnh này cho toàn bộ tầng.';
          })
        }
      >
        Đặt gốc tọa độ (0,0) tại đỉnh này
      </button>
    </div>
  );
}

function ZoneProps({ room, zoneId }: { room: Room; zoneId: string }) {
  const z = room.zones.find((x) => x.id === zoneId);
  if (!z) return null;
  const xs = z.polygon.map((p) => p.x);
  const ys = z.polygon.map((p) => p.y);
  const r = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const setRect = (nr: typeof r) =>
    updateRoom(room.id, (rm) => {
      const zz = rm.zones.find((x) => x.id === zoneId)!;
      zz.polygon = [
        { x: nr.x, y: nr.y },
        { x: nr.x + nr.w, y: nr.y },
        { x: nr.x + nr.w, y: nr.y + nr.h },
        { x: nr.x, y: nr.y + nr.h },
      ];
    });
  return (
    <div className="panel-body" data-testid="zone-props">
      <TextField label="Tên vùng" value={z.name} onCommit={(v) => updateRoom(room.id, (rm) => void (rm.zones.find((x) => x.id === zoneId)!.name = v))} />
      <div className="field">
        <span className="flabel">Gán mức cao độ</span>
        <select
          value={z.levelId}
          onChange={(e) => updateRoom(room.id, (rm) => void (rm.zones.find((x) => x.id === zoneId)!.levelId = e.target.value))}
        >
          {room.heights.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label || HEIGHT_TYPE_LABEL[h.type]} — {h.value != null ? fmtNum(h.value) + ' mm' : 'chưa đo'}
            </option>
          ))}
        </select>
        <p className="muted small">Thêm/sửa mức cao độ trong bảng Thông tin phòng.</p>
      </div>
      <div className="row">
        <NumberField label="X" value={r.x} onCommit={(v) => v != null && setRect({ ...r, x: v })} />
        <NumberField label="Y" value={r.y} onCommit={(v) => v != null && setRect({ ...r, y: v })} />
      </div>
      <div className="row">
        <NumberField label="Rộng" value={r.w} min={1} onCommit={(v) => v && setRect({ ...r, w: v })} />
        <NumberField label="Dài" value={r.h} min={1} onCommit={(v) => v && setRect({ ...r, h: v })} />
      </div>
      <div className="row wrap">
        <button className="btn" onClick={() => store.ui({ panel: 'room' })}>
          Mở thông tin cao độ
        </button>
        <button
          className="btn danger"
          onClick={() => {
            updateRoom(room.id, (rm) => void (rm.zones = rm.zones.filter((x) => x.id !== zoneId)));
            store.ui({ selection: null });
          }}
        >
          Xóa vùng
        </button>
      </div>
    </div>
  );
}

export function useActiveFloorName() {
  return useStore((s) => activeFloor(s)?.name ?? '');
}
