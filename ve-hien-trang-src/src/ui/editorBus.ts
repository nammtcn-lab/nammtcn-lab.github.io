import type { CanvasController } from '../input/controller';

/** Cầu nối để các nút giao diện điều khiển khung nhìn (zoom, Fit All) */
export const editorBus: { ctl: CanvasController | null } = { ctl: null };

/** Truy cập gỡ lỗi / kiểm thử tự động (window.__vht) */
export function exposeDebug(store: unknown) {
  (window as any).__vht = {
    get ctl() {
      return editorBus.ctl;
    },
    store,
  };
}
