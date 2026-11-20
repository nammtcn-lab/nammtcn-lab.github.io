import { useEffect, useRef, useState, type ReactNode } from 'react';

export const fmtNum = (v: number | null | undefined, digits = 1) => {
  if (v == null || !Number.isFinite(v)) return '';
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r.toLocaleString('vi-VN', { maximumFractionDigits: digits });
};

/** Phân tích số nhập: chấp nhận "3500", "3.500", "3,5" (m → không tự đổi), "3500.5" */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return null;
  let norm = t;
  // "3.500" kiểu nghìn VN → 3500 ; "3,5" → 3.5
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(norm)) norm = norm.replace(/\./g, '').replace(',', '.');
  else norm = norm.replace(',', '.');
  // hỗ trợ phép tính đơn giản: 1200+1500
  if (/^[-+*/().\d]+$/.test(norm) && /[-+*/]/.test(norm.slice(1))) {
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${norm})`)();
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }
  const v = Number(norm);
  return Number.isFinite(v) ? v : null;
}

interface NumberFieldProps {
  label: ReactNode;
  value: number | null;
  onCommit: (v: number | null) => void;
  required?: boolean;
  optional?: boolean;
  unit?: string;
  step?: number;
  min?: number;
  suggest?: number;
  hint?: ReactNode;
  testId?: string;
  big?: boolean;
  autoFocus?: boolean;
  onEnter?: (v: number | null) => void;
  placeholder?: string;
  /** gọi onCommit ngay khi gõ (dùng cho ô nhập tạm, không ghi lịch sử) */
  live?: boolean;
}

/** Ô nhập số: bàn phím số trên điện thoại, nút +/−, nút gợi ý (chỉ điền khi người dùng bấm) */
export function NumberField(p: NumberFieldProps) {
  const [text, setText] = useState(fmtRaw(p.value));
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focus) setText(fmtRaw(p.value));
  }, [p.value, focus]);
  const commit = (t = text) => {
    const v = parseNum(t);
    if (v == null && t.trim()) {
      setText(fmtRaw(p.value));
      return;
    }
    if (v != null && p.min != null && v < p.min) {
      setText(fmtRaw(p.value));
      return;
    }
    if (v !== p.value) p.onCommit(v);
  };
  const bump = (d: number) => {
    const base = parseNum(text) ?? p.value ?? p.suggest ?? 0;
    const v = Math.round((base + d) * 1000) / 1000;
    if (p.min != null && v < p.min) return;
    setText(fmtRaw(v));
    p.onCommit(v);
  };
  return (
    <div className={'field' + (p.big ? ' big' : '')}>
      <label>
        <span className="flabel">
          {p.label}
          {p.required && <em className="req">bắt buộc</em>}
          {p.optional && <em className="opt">không bắt buộc</em>}
        </span>
        <div className="numrow">
          {p.step ? (
            <button type="button" className="step" onClick={() => bump(-p.step!)} aria-label="Giảm">
              −
            </button>
          ) : null}
          <input
            ref={ref}
            data-testid={p.testId}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoFocus={p.autoFocus}
            value={text}
            placeholder={p.placeholder ?? (p.optional ? 'chưa đo' : '')}
            onFocus={(e) => {
              setFocus(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setFocus(false);
              commit();
            }}
            onChange={(e) => {
              setText(e.target.value);
              if (p.live) p.onCommit(parseNum(e.target.value));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const v = parseNum(text);
                if (p.onEnter) {
                  p.onEnter(v);
                } else {
                  commit();
                  ref.current?.blur();
                }
              }
              if (e.key === 'Escape') {
                setText(fmtRaw(p.value));
                ref.current?.blur();
              }
            }}
          />
          {p.unit !== '' && <span className="unit">{p.unit ?? 'mm'}</span>}
          {p.step ? (
            <button type="button" className="step" onClick={() => bump(p.step!)} aria-label="Tăng">
              +
            </button>
          ) : null}
        </div>
      </label>
      {(p.suggest != null || p.hint || (p.optional && p.value != null)) && (
        <div className="fhint">
          {p.suggest != null && p.value == null && (
            <button type="button" className="chip suggest" onClick={() => p.onCommit(p.suggest!)}>
              Gợi ý {fmtNum(p.suggest, 0)}
            </button>
          )}
          {p.optional && p.value != null && (
            <button type="button" className="chip ghost" onClick={() => p.onCommit(null)}>
              Bỏ trống
            </button>
          )}
          {p.hint && <span>{p.hint}</span>}
        </div>
      )}
    </div>
  );
}

function fmtRaw(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '';
  const r = Math.round(v * 10) / 10;
  return String(r).replace('.', ',');
}

export function Chips<T extends string | number>(p: { value: T | null; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; testId?: string; small?: boolean }) {
  return (
    <div className={'chips' + (p.small ? ' small' : '')} data-testid={p.testId}>
      {p.options.map((o) => (
        <button type="button" key={String(o.value)} title={o.title} className={'chip' + (o.value === p.value ? ' on' : '')} onClick={() => p.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextField(p: { label: ReactNode; value: string; onCommit: (v: string) => void; multiline?: boolean; placeholder?: string; testId?: string }) {
  const [t, setT] = useState(p.value);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setT(p.value);
  }, [p.value, focus]);
  const common = {
    value: t,
    placeholder: p.placeholder,
    'data-testid': p.testId,
    onFocus: () => setFocus(true),
    onBlur: () => {
      setFocus(false);
      if (t !== p.value) p.onCommit(t);
    },
    onChange: (e: any) => setT(e.target.value),
  };
  return (
    <div className="field">
      <label>
        <span className="flabel">{p.label}</span>
        {p.multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />}
      </label>
    </div>
  );
}

export function Section(p: { title: ReactNode; children: ReactNode; right?: ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(p.defaultOpen ?? true);
  return (
    <section className="sec">
      <header onClick={() => p.collapsible && setOpen(!open)} className={p.collapsible ? 'clickable' : ''}>
        <h3>
          {p.collapsible && <span className="caret">{open ? '▾' : '▸'}</span>}
          {p.title}
        </h3>
        {p.right}
      </header>
      {open && <div className="sec-body">{p.children}</div>}
    </section>
  );
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    select: 'M5 3l14 8-6 1.5L10 19z',
    draw: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
    zone: 'M4 4h16v16H4z M4 9h16 M9 4v16',
    pan: 'M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
    fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    zin: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5M11 8v6M8 11h6',
    zout: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5M8 11h6',
    grid: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16',
    ortho: 'M5 19V5M5 19h14',
    snap: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 110 6 3 3 0 010-6',
    rooms: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
    info: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 11v6M12 7v.5',
    export: 'M12 3v12M7 10l5 5 5-5M4 17v3h16v-3',
    settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
    back: 'M15 18l-6-6 6-6',
    close: 'M6 6l12 12M18 6L6 18',
    dims: 'M3 8v8M21 8v8M3 12h18M6 10l-3 2 3 2M18 10l3 2-3 2',
    save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
    height: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4M3 3h4M3 21h4',
    library: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7zM6 8h3M15 8h3M8 15v3M17 15v3',
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name] ?? ''} />
    </svg>
  );
}
