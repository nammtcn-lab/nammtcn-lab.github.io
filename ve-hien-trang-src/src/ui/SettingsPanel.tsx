import type { Project } from '../model/types';
import { commit, store, useStore } from '../store/store';
import { Chips, NumberField, Section, TextField } from './controls';

export function SettingsPanel() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  if (!project) return null;
  const set = (fn: (p: Project) => void) => commit((p) => void fn(p));
  return (
    <div className="panel-body" data-testid="settings-panel">
      <Section title="Dự án">
        <TextField label="Tên dự án" value={project.name} onCommit={(v) => set((p) => (p.name = v || 'Dự án'))} />
        <TextField label="Địa chỉ công trình" value={project.address} onCommit={(v) => set((p) => (p.address = v))} />
        <TextField label="Người khảo sát" value={project.surveyor} onCommit={(v) => set((p) => (p.surveyor = v))} />
        <TextField label="Ghi chú" multiline value={project.notes} onCommit={(v) => set((p) => (p.notes = v))} />
      </Section>
      <Section title="Bắt điểm">
        <div className="field">
          <span className="flabel">Bước bắt điểm khi kéo vẽ (mm)</span>
          <Chips value={project.settings.snapStep} onChange={(v) => set((p) => (p.settings.snapStep = v))} options={[1, 5, 10, 20, 50, 100].map((v) => ({ value: v, label: String(v) }))} testId="snap-step" />
        </div>
        <label className="check">
          <input type="checkbox" checked={ui.snap} onChange={(e) => store.ui({ snap: e.target.checked })} /> Bật bắt điểm / bắt góc
        </label>
        <label className="check">
          <input type="checkbox" checked={ui.ortho} onChange={(e) => store.ui({ ortho: e.target.checked })} /> Khóa phương ngang / đứng (tắt để vẽ đoạn chéo)
        </label>
      </Section>
      <Section title="Bề dày mặc định (quy ước)">
        <NumberField label="Tường — áp dụng cho phòng mới" value={project.settings.defaultThickness} step={10} min={10} onCommit={(v) => v && set((p) => (p.settings.defaultThickness = v))} />
        <NumberField label="Vách ngăn" value={project.settings.partitionThickness} step={10} min={10} onCommit={(v) => v && set((p) => (p.settings.partitionThickness = v))} />
        <p className="muted small">Bề dày tường của từng phòng chỉnh trong Thông tin phòng; bề dày từng đoạn chỉnh khi chọn đoạn.</p>
      </Section>
      <Section title="Hiển thị">
        <label className="check">
          <input type="checkbox" checked={ui.grid} onChange={(e) => store.ui({ grid: e.target.checked })} /> Lưới (chính 100 mm, đậm mỗi 1.000 mm)
        </label>
        <label className="check">
          <input type="checkbox" checked={ui.minorGrid} onChange={(e) => store.ui({ minorGrid: e.target.checked })} /> Lưới phụ 10 mm
        </label>
        <label className="check">
          <input type="checkbox" checked={ui.dims} onChange={(e) => store.ui({ dims: e.target.checked })} /> Kích thước
        </label>
        <label className="check">
          <input type="checkbox" checked={ui.showOtherRooms} onChange={(e) => store.ui({ showOtherRooms: e.target.checked })} /> Hiện các phòng khác cùng tầng
        </label>
      </Section>
    </div>
  );
}
