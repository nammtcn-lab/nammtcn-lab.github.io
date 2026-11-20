import { useState } from 'react';
import { activeRoom, applyOp, store, toast, useStore } from '../store/store';
import { appendByLength, closeChain, deleteSegment, openChain, setSegmentLength, startChain } from '../model/ops';
import { closureGap, segLength } from '../geometry/boundary';
import { SEGMENT_KIND_LABEL, type SegmentKind } from '../model/types';
import { Chips, NumberField, Section, fmtNum } from './controls';
import { editorBus } from './editorBus';

const KINDS: SegmentKind[] = ['wall', 'door', 'window', 'opening', 'partition'];
const STEPS = [1, 5, 10, 50, 100];

/** Bảng vẽ chu vi: nhập số đo chính xác + hướng, đo nhanh / đo chi tiết, khép kín */
export function DrawPanel() {
  const room = useStore((s) => activeRoom(s));
  const ui = useStore((s) => s.ui);
  const snapStep = useStore((s) => s.project?.settings.snapStep ?? 10);
  const [len, setLen] = useState<number | null>(null);
  const [angle, setAngle] = useState<number | null>(45);
  const [bump, setBump] = useState(10);
  const [sx, setSx] = useState<number | null>(0);
  const [sy, setSy] = useState<number | null>(0);

  if (!room) return <div className="empty">Chưa có phòng. Mở danh sách phòng để tạo phòng mới.</div>;
  const b = room.boundary;
  const n = b.segments.length;
  const kind: SegmentKind = ui.workMode === 'detail' ? ui.drawKind : 'wall';
  const gap = closureGap(b);
  const gapLen = gap ? Math.hypot(gap.x, gap.y) : 0;

  const add = (deg: number) => {
    if (!b.vertices.length) {
      toast('Hãy đặt điểm đầu trước (chạm vào vùng vẽ hoặc bấm "Đặt điểm đầu").', 'warn');
      return;
    }
    if (len == null || !(len > 0)) {
      toast('Nhập chiều dài đoạn (mm) trước khi chọn hướng.', 'warn');
      return;
    }
    const r = applyOp(room.id, (bd) => appendByLength(bd, len, deg, kind));
    if (r) {
      if (kind !== 'wall' && kind !== 'partition') store.ui({ drawKind: 'wall' });
      const end = r.boundary.vertices[r.boundary.closed ? 0 : r.boundary.vertices.length - 1];
      editorBus.ctl?.ensureVisible(end);
      if (r.boundary.closed) store.ui({ tool: 'select' });
    }
  };

  const fixLast = () => {
    if (!n || b.closed) return;
    if (len == null || !(len > 0)) {
      toast('Nhập số đo đúng của đoạn vừa vẽ.', 'warn');
      return;
    }
    applyOp(room.id, (bd) => setSegmentLength(bd, n - 1, len, 'shift'));
    toast(`Đã gán ${fmtNum(len)} mm cho đoạn #${n}.`, 'ok', 2000);
  };

  return (
    <div className="panel-body" data-testid="draw-panel">
      <div className="row between">
        <Chips
          small
          value={ui.workMode}
          onChange={(v) => store.ui({ workMode: v, drawKind: 'wall' })}
          options={[
            { value: 'quick', label: 'Đo nhanh', title: 'Vẽ hết chu vi, phân loại cửa sau' },
            { value: 'detail', label: 'Đo chi tiết', title: 'Vẽ đến đâu phân loại đến đó' },
          ]}
          testId="work-mode"
        />
        <span className="muted small">{room.name}</span>
      </div>

      {!b.vertices.length && (
        <div className="callout">
          <b>Bước 1:</b> chạm vào vùng vẽ để đặt điểm đầu (góc phòng), hoặc nhập tọa độ:
          <div className="row">
            <NumberField label="X" value={sx} onCommit={setSx} />
            <NumberField label="Y" value={sy} onCommit={setSy} />
          </div>
          <button className="btn primary" data-testid="set-start" onClick={() => applyOp(room.id, (bd) => startChain(bd, { x: sx ?? 0, y: sy ?? 0 }))}>
            Đặt điểm đầu
          </button>
        </div>
      )}

      {ui.workMode === 'detail' && !b.closed && (
        <div className="field">
          <span className="flabel">Loại đoạn tiếp theo</span>
          <Chips value={ui.drawKind} onChange={(v) => store.ui({ drawKind: v })} options={KINDS.map((k) => ({ value: k, label: SEGMENT_KIND_LABEL[k] }))} testId="draw-kind" />
        </div>
      )}

      {!b.closed && (
        <div className="drawrow">
          <div className="drawrow-len">
          <NumberField
            big
            label={
              <>
                Chiều dài {kind !== 'wall' ? <b className={'kind-' + kind}>{SEGMENT_KIND_LABEL[kind]}</b> : 'đoạn'}
              </>
            }
            value={len}
            onCommit={setLen}
            onEnter={(v) => {
              setLen(v);
            }}
            step={bump}
            min={0}
            testId="len-input"
            live
            hint={
              <span className="row tight">
                bước ±
                {STEPS.map((s) => (
                  <button key={s} type="button" className={'chip tiny' + (s === bump ? ' on' : '')} onClick={() => setBump(s)}>
                    {s}
                  </button>
                ))}
              </span>
            }
          />
          <Section title="Đoạn chéo theo góc tùy ý" collapsible defaultOpen={false}>
            <NumberField label="Góc (0° = →, ngược chiều kim đồng hồ)" value={angle} onCommit={setAngle} unit="°" step={15} />
            <p className="muted small">Bấm nút giữa (ô {fmtNum(angle ?? 0)}°) để thêm đoạn theo góc này.</p>
          </Section>
          </div>
          <div className="dirpad" data-testid="dirpad">
            <span className="muted small">Chọn hướng → thêm đoạn</span>
            <div className="dirgrid">
              <button className="btn dir" onClick={() => add(135)} title="Chéo lên trái">↖</button>
              <button className="btn dir" data-testid="dir-up" onClick={() => add(90)}>↑</button>
              <button className="btn dir" onClick={() => add(45)} title="Chéo lên phải">↗</button>
              <button className="btn dir" data-testid="dir-left" onClick={() => add(180)}>←</button>
              <button className="btn dir angle" onClick={() => angle != null && add(angle)} title="Theo góc nhập">
                {fmtNum(angle ?? 0)}°
              </button>
              <button className="btn dir" data-testid="dir-right" onClick={() => add(0)}>→</button>
              <button className="btn dir" onClick={() => add(225)} title="Chéo xuống trái">↙</button>
              <button className="btn dir" data-testid="dir-down" onClick={() => add(270)}>↓</button>
              <button className="btn dir" onClick={() => add(315)} title="Chéo xuống phải">↘</button>
            </div>
          </div>
        </div>
      )}

      {n > 0 && !b.closed && (
        <div className="lastseg">
          <div>
            Đoạn vừa vẽ: <b>#{n}</b> {SEGMENT_KIND_LABEL[b.segments[n - 1].kind]} <b>{fmtNum(segLength(b, n - 1))} mm</b>
          </div>
          <div className="row wrap">
            <button className="btn" data-testid="fix-last" onClick={fixLast} disabled={len == null}>
              Gán số đo {len != null ? fmtNum(len) : ''} cho đoạn này
            </button>
            <button className="btn" data-testid="undo-last" onClick={() => applyOp(room.id, (bd) => deleteSegment(bd, n - 1))}>
              Xóa đoạn cuối
            </button>
          </div>
        </div>
      )}

      {!b.closed && n >= 2 && (
        <div className={'closure' + (gapLen > 0.5 ? ' warn' : '')}>
          <div>
            Khoảng hở về điểm đầu: <b>{fmtNum(gapLen)} mm</b>
            {gap && gapLen > 0.5 && (
              <span className="muted small">
                {' '}
                (ΔX {fmtNum(gap.x)}, ΔY {fmtNum(gap.y)})
              </span>
            )}
          </div>
          <button className="btn primary" data-testid="close-chain" onClick={() => {
            const r = applyOp(room.id, (bd) => closeChain(bd));
            if (r) store.ui({ tool: 'select' });
          }}>
            Khép kín chu vi
          </button>
        </div>
      )}

      {b.closed && (
        <div className="callout ok">
          Chu vi đã khép kín ({n} đoạn). Dùng công cụ <b>Chọn</b> để chạm vào từng đoạn và chuyển thành cửa đi, cửa sổ…
          <div className="row wrap">
            <button className="btn" onClick={() => store.ui({ tool: 'select', panel: 'none' })}>
              Chuyển sang Chọn
            </button>
            <button className="btn" data-testid="open-chain" onClick={() => applyOp(room.id, (bd) => openChain(bd))}>
              Mở chu vi để vẽ tiếp
            </button>
          </div>
        </div>
      )}
      <p className="muted small tip">
        Mẹo: kéo ngón tay ở bất kỳ đâu trên vùng vẽ để vẽ đoạn từ điểm cuối (vòng đỏ). Chiều dài kéo được làm tròn theo bước bắt điểm {snapStep} mm; số nhập bằng bàn phím luôn giữ nguyên. Có thể nhập phép cộng, ví dụ <code>1200+1500</code>.
      </p>
    </div>
  );
}
