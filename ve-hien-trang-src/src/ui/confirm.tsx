import { useSyncExternalStore } from 'react';

/** Hộp thoại xác nhận trong trang (thay cho window.confirm — bị chặn trong ứng dụng Claude) */
interface Ask {
  msg: string;
  ok: string;
  cancel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}
let current: Ask | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function askConfirm(msg: string, opt: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { msg, ok: opt.ok ?? 'Đồng ý', cancel: opt.cancel ?? 'Hủy', danger: opt.danger ?? false, resolve };
    emit();
  });
}

function close(v: boolean) {
  const c = current;
  current = null;
  emit();
  c?.resolve(v);
}

export function ConfirmHost() {
  const a = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
  );
  if (!a) return null;
  return (
    <div className="modal-back" onClick={() => close(false)}>
      <div className="modal" role="dialog" aria-modal="true" data-testid="confirm" onClick={(e) => e.stopPropagation()}>
        <p>{a.msg}</p>
        <div className="row wrap end">
          <button className="btn" onClick={() => close(false)} data-testid="confirm-cancel">
            {a.cancel}
          </button>
          <button className={'btn ' + (a.danger ? 'danger-fill' : 'primary')} onClick={() => close(true)} data-testid="confirm-ok" autoFocus>
            {a.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
