import { useEffect, useRef, type ReactNode } from 'react';
import { CanvasController } from '../input/controller';
import { activeFloor, activeRoom, applyOp, closeProject, flushSave, redo, store, undo, useStore, type Panel, type Tool } from '../store/store';
import { Icon } from './controls';
import { editorBus } from './editorBus';
import { DrawPanel } from './DrawPanel';
import { PropsPanel } from './PropsPanel';
import { RoomPanel } from './RoomPanel';
import { RoomsPanel } from './RoomsPanel';
import { ExportPanel } from './ExportPanel';
import { SettingsPanel } from './SettingsPanel';
import { deleteSegment } from '../model/ops';

const PANEL_TITLE: Record<Panel, string> = {
  none: '',
  draw: 'Vẽ chu vi',
  props: 'Thuộc tính',
  room: 'Thông tin phòng & cao độ',
  rooms: 'Tầng & phòng',
  export: 'Xuất bản vẽ',
  settings: 'Cài đặt',
  project: 'Dự án',
};

export function Editor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ui = useStore((s) => s.ui);
  const project = useStore((s) => s.project);
  const floor = useStore((s) => activeFloor(s));
  const room = useStore((s) => activeRoom(s));
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);

  useEffect(() => {
    const ctl = new CanvasController(canvasRef.current!);
    editorBus.ctl = ctl;
    return () => {
      ctl.destroy();
      editorBus.ctl = null;
    };
  }, []);

  // phím tắt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flushSave();
      } else if (!typing && !mod) {
        const s = store.get();
        if ((e.key === 'Delete' || e.key === 'Backspace') && s.ui.selection?.kind === 'segment') {
          const sel = s.ui.selection;
          applyOp(sel.roomId, (b) => deleteSegment(b, sel.index));
          store.ui({ selection: null });
        } else if (e.key === 'v' || e.key === 'V') setTool('select');
        else if (e.key === 'd' || e.key === 'D') setTool('draw');
        else if (e.key === 'f' || e.key === 'F') editorBus.ctl?.fitAll();
        else if (e.key === 'Escape') store.ui({ selection: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!project) return null;
  const panel = ui.panel;

  return (
    <div className="editor">
      <header className="topbar">
        <button className="btn icon" onClick={closeProject} title="Danh sách dự án" data-testid="back">
          <Icon name="back" />
        </button>
        <button className="title" onClick={() => togglePanel('rooms')} data-testid="title">
          <b>{project.name}</b>
          <span>
            {floor?.name} · {room?.name ?? 'chưa chọn phòng'} ▾
          </span>
        </button>
        <span className={'save ' + ui.saveState} title="Trạng thái lưu" data-testid="save-state">
          {ui.saveState === 'saved' ? 'Đã lưu' : ui.saveState === 'saving' ? 'Đang lưu…' : ui.saveState === 'error' ? 'Lỗi lưu!' : 'Chưa lưu'}
        </span>
        <button className="btn icon" onClick={() => void flushSave()} title="Lưu ngay (Ctrl+S)" data-testid="save">
          <Icon name="save" />
        </button>
        <button className="btn icon" onClick={undo} disabled={!canUndo} title="Hoàn tác (Ctrl+Z)" data-testid="undo">
          <Icon name="undo" />
        </button>
        <button className="btn icon" onClick={redo} disabled={!canRedo} title="Làm lại (Ctrl+Y)" data-testid="redo">
          <Icon name="redo" />
        </button>
        <button className={'btn icon hide-sm' + (panel === 'export' ? ' on' : '')} onClick={() => togglePanel('export')} title="Xuất bản vẽ">
          <Icon name="export" />
        </button>
        <button className={'btn icon hide-sm' + (panel === 'settings' ? ' on' : '')} onClick={() => togglePanel('settings')} title="Cài đặt">
          <Icon name="settings" />
        </button>
      </header>
      <div className="workspace">
        <nav className="toolbar" data-testid="toolbar">
          <ToolBtn tool="select" icon="select" label="Chọn" />
          <ToolBtn tool="draw" icon="draw" label="Vẽ" />
          <ToolBtn tool="zone" icon="zone" label="Vùng trần" />
          <ToolBtn tool="pan" icon="pan" label="Di chuyển" />
          <span className="sep" />
          <Toggle on={ui.grid} icon="grid" label="Lưới" onClick={() => store.ui({ grid: !ui.grid })} />
          <Toggle on={ui.ortho} icon="ortho" label="Khóa phương" testId="ortho" onClick={() => store.ui({ ortho: !ui.ortho })} />
          <Toggle on={ui.snap} icon="snap" label="Bắt điểm" onClick={() => store.ui({ snap: !ui.snap })} />
          <Toggle on={ui.dims} icon="dims" label="Kích thước" onClick={() => store.ui({ dims: !ui.dims })} />
          <span className="sep" />
          <TB icon="zin" label="Phóng to" onClick={() => editorBus.ctl?.zoomBy(1.4)} />
          <TB icon="zout" label="Thu nhỏ" onClick={() => editorBus.ctl?.zoomBy(1 / 1.4)} />
          <TB icon="fit" label="Fit All" testId="fit" onClick={() => editorBus.ctl?.fitAll()} />
          <span className="sep" />
          <TB icon="rooms" label="Phòng" on={panel === 'rooms'} testId="panel-rooms" onClick={() => togglePanel('rooms')} />
          <TB icon="height" label="Cao độ" on={panel === 'room'} testId="panel-room" onClick={() => togglePanel('room')} />
          <TB icon="export" label="Xuất" on={panel === 'export'} testId="panel-export" onClick={() => togglePanel('export')} />
          <TB icon="settings" label="Cài đặt" on={panel === 'settings'} onClick={() => togglePanel('settings')} />
        </nav>
        <div className="canvas-host" ref={hostRef}>
          <canvas ref={canvasRef} data-testid="canvas" />
          <div className="hud">
            {toolHint(ui.tool, ui.workMode, room?.boundary.closed ?? false, (room?.boundary.vertices.length ?? 0) > 0)}
            {ui.tool === 'draw' && panel !== 'draw' && (
              <button className="chip on" onClick={() => store.ui({ panel: 'draw' })}>
                Nhập số đo
              </button>
            )}
          </div>
        </div>
        {panel !== 'none' && (
          <aside className="panel" data-testid="panel">
            <div className="panel-head">
              <span className="grab" />
              <b>{PANEL_TITLE[panel]}</b>
              <button className="btn icon" onClick={() => store.ui({ panel: 'none' })} aria-label="Đóng" data-testid="panel-close">
                <Icon name="close" />
              </button>
            </div>
            <div className="panel-scroll">
              {panel === 'draw' && <DrawPanel />}
              {panel === 'props' && <PropsPanel />}
              {panel === 'room' && <RoomPanel />}
              {panel === 'rooms' && <RoomsPanel />}
              {panel === 'export' && <ExportPanel />}
              {panel === 'settings' && <SettingsPanel />}
            </div>
          </aside>
        )}
      </div>
      <ToastView />
    </div>
  );
}

function toolHint(tool: Tool, mode: string, closed: boolean, started: boolean): ReactNode {
  if (tool === 'draw') {
    if (closed) return <span>Chu vi đã khép kín — chọn công cụ Chọn để sửa</span>;
    if (!started) return <span>Chạm/bấm để đặt điểm đầu</span>;
    return <span>Kéo để vẽ đoạn · {mode === 'detail' ? 'Đo chi tiết' : 'Đo nhanh'}</span>;
  }
  if (tool === 'select') return <span>Chạm vào đoạn / đỉnh / vùng để chọn · kéo vùng trống để di chuyển</span>;
  if (tool === 'zone') return <span>Kéo hình chữ nhật để tạo vùng trần</span>;
  return <span>Kéo để di chuyển · chụm 2 ngón để zoom</span>;
}

function setTool(t: Tool) {
  const ui = store.get().ui;
  const patch: Partial<typeof ui> = { tool: t };
  if (t === 'draw') {
    patch.panel = 'draw';
    patch.selection = null;
  } else if (ui.panel === 'draw') patch.panel = 'none';
  store.ui(patch);
}

function togglePanel(p: Panel) {
  const cur = store.get().ui.panel;
  store.ui({ panel: cur === p ? 'none' : p });
}

function ToolBtn({ tool, icon, label }: { tool: Tool; icon: string; label: string }) {
  const cur = useStore((s) => s.ui.tool);
  return (
    <button className={'tbtn' + (cur === tool ? ' on' : '')} onClick={() => setTool(tool)} data-testid={'tool-' + tool} title={label}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function Toggle({ on, icon, label, onClick, testId }: { on: boolean; icon: string; label: string; onClick: () => void; testId?: string }) {
  return (
    <button className={'tbtn toggle' + (on ? ' on' : '')} onClick={onClick} title={label} data-testid={testId} aria-pressed={on}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function TB({ icon, label, onClick, on, testId }: { icon: string; label: string; onClick: () => void; on?: boolean; testId?: string }) {
  return (
    <button className={'tbtn' + (on ? ' on' : '')} onClick={onClick} title={label} data-testid={testId}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function ToastView() {
  const t = useStore((s) => s.ui.toast);
  if (!t) return null;
  return (
    <div className={'toast ' + t.type} role="status" data-testid="toast" onClick={() => store.ui({ toast: null })}>
      {t.msg}
    </div>
  );
}
