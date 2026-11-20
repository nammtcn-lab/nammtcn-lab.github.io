import { useEffect, useRef, useState } from 'react';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectMeta } from '../store/db';
import { openProject, toast } from '../store/store';
import { newProject, normalizeProject, uid } from '../model/factory';
import { sampleProject } from '../model/sample';
import { NumberField, TextField } from './controls';
import { dateStamp, downloadBlob, safeName } from '../export/files';

/** Màn hình danh sách dự án + tạo dự án mới + khôi phục JSON */
export function ProjectList() {
  const [items, setItems] = useState<ProjectMeta[] | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => listProjects().then(setItems);
  useEffect(() => {
    void refresh();
  }, []);

  const open = async (id: string) => {
    const p = await loadProject(id);
    if (p) openProject(normalizeProject(p));
    else toast('Không mở được dự án.', 'error');
  };

  const openSample = async () => {
    const p = sampleProject();
    await saveProject(p);
    openProject(p);
    toast('Đã tạo dự án mẫu gồm 6 phòng trên 2 tầng.', 'ok');
  };

  const importJson = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      const p = normalizeProject(raw.project ?? raw);
      const exists = items?.some((x) => x.id === p.id);
      if (exists && !confirm(`Dự án "${p.name}" đã có trên máy. Ghi đè? (Chọn Hủy để tạo bản sao mới)`)) {
        p.id = uid('p');
        p.name += ' (khôi phục)';
      }
      await saveProject(p);
      toast(`Đã khôi phục dự án "${p.name}".`, 'ok');
      await refresh();
    } catch (e) {
      toast('File không hợp lệ: ' + (e as Error).message, 'error', 6000);
    }
  };

  return (
    <div className="home">
      <header className="home-top">
        <div>
          <h1>Vẽ Hiện Trạng</h1>
          <p className="muted">Khảo sát & vẽ mặt bằng hiện trạng theo kích thước thực (mm). Dữ liệu lưu ngay trên thiết bị.</p>
        </div>
      </header>
      <div className="home-actions">
        <button className="btn primary big" data-testid="new-project" onClick={() => setCreating(true)}>
          + Dự án mới
        </button>
        <button className="btn big" data-testid="open-sample" onClick={openSample}>
          Mở dự án mẫu
        </button>
        <button className="btn big" onClick={() => fileRef.current?.click()}>
          Khôi phục từ JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-json" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0]).finally(() => (e.target.value = ''))} />
      </div>
      {creating && <NewProjectForm onCancel={() => setCreating(false)} />}
      <h2>Dự án trên thiết bị</h2>
      {items == null && <p className="muted">Đang tải…</p>}
      {items?.length === 0 && <p className="muted">Chưa có dự án. Tạo dự án mới hoặc mở dự án mẫu để thử ngay.</p>}
      <ul className="projects" data-testid="project-list">
        {items?.map((m) => (
          <li key={m.id}>
            <button className="proj-main" onClick={() => open(m.id)}>
              <b>{m.name}</b>
              <span className="muted small">
                {m.address ? m.address + ' · ' : ''}
                {m.floors} tầng · {m.rooms} phòng · sửa {new Date(m.updatedAt).toLocaleString('vi-VN')}
              </span>
            </button>
            <div className="row tight">
              <button
                className="btn small"
                title="Sao lưu JSON"
                onClick={async () => {
                  const p = await loadProject(m.id);
                  if (p) downloadBlob(new Blob([JSON.stringify({ app: 've-hien-trang', project: p }, null, 1)], { type: 'application/json' }), `${safeName(p.name)}-${dateStamp()}.json`);
                }}
              >
                JSON
              </button>
              <button
                className="btn small"
                title="Nhân bản"
                onClick={async () => {
                  const p = await loadProject(m.id);
                  if (!p) return;
                  const c = structuredClone(p);
                  c.id = uid('p');
                  c.name = p.name + ' (bản sao)';
                  c.updatedAt = Date.now();
                  await saveProject(c);
                  await refresh();
                }}
              >
                ⧉
              </button>
              <button
                className="btn small danger"
                title="Xóa"
                onClick={async () => {
                  if (!confirm(`Xóa vĩnh viễn dự án "${m.name}" khỏi thiết bị?`)) return;
                  await deleteProject(m.id);
                  await refresh();
                }}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <footer className="muted small home-foot">
        Phiên bản thử nghiệm 0.1 · Hoạt động ngoại tuyến sau lần tải đầu · Có thể “Thêm vào màn hình chính” để dùng như ứng dụng.
      </footer>
    </div>
  );
}

function NewProjectForm({ onCancel }: { onCancel: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [surveyor, setSurveyor] = useState('');
  const [thick, setThick] = useState<number | null>(140);
  const [snap, setSnap] = useState<number | null>(10);
  return (
    <div className="card form" data-testid="new-project-form">
      <h3>Tạo dự án mới</h3>
      <TextField label="Tên dự án *" value={name} onCommit={setName} placeholder="VD: Nhà anh Minh — Cầu Giấy" testId="np-name" />
      <TextField label="Địa chỉ công trình" value={address} onCommit={setAddress} />
      <TextField label="Người khảo sát" value={surveyor} onCommit={setSurveyor} />
      <div className="row">
        <NumberField label="Bề dày tường mặc định (quy ước)" value={thick} onCommit={setThick} step={10} />
        <NumberField label="Bước bắt điểm" value={snap} onCommit={setSnap} />
      </div>
      <div className="row">
        <button className="btn" onClick={onCancel}>
          Hủy
        </button>
        <button
          className="btn primary"
          data-testid="np-create"
          onClick={async () => {
            // đọc giá trị đang gõ (chưa blur)
            const nameInput = document.querySelector<HTMLInputElement>('[data-testid="np-name"]');
            const nm = (nameInput?.value ?? name).trim() || `Dự án ${new Date().toLocaleDateString('vi-VN')}`;
            const p = newProject(nm);
            p.address = address;
            p.surveyor = surveyor;
            if (thick && thick > 0) p.settings.defaultThickness = thick;
            if (snap && snap > 0) p.settings.snapStep = snap;
            p.floors[0].rooms[0].defaultThickness = p.settings.defaultThickness;
            await saveProject(p);
            openProject(p);
          }}
        >
          Tạo và bắt đầu vẽ
        </button>
      </div>
    </div>
  );
}
