/**
 * NỀN TẢNG CHẠY: trình duyệt thường / PWA, hoặc trang artifact trong ứng dụng Claude.
 * Trong Claude: không có hộp thoại confirm, không tải file trực tiếp, không service worker —
 * dùng các "capability" của Claude (lưu dữ liệu theo tài khoản, lưu file có xác nhận).
 */
type Use = (name: string) => Promise<any>;

export function claudeUse(): Use | null {
  const c = (window as any).claude;
  return c && typeof c.use === 'function' ? (c.use.bind(c) as Use) : null;
}

/** Đang chạy trong khung artifact của Claude (nhận biết qua hàm claude.use được nền tảng cấp) */
export const inClaude = () => claudeUse() !== null;

const memo = new Map<string, Promise<any>>();
/** Lấy capability, quá 10 giây không có trả lời thì coi như không có */
export function capability<T = any>(name: string): Promise<T | null> {
  const use = claudeUse();
  if (!use) return Promise.resolve(null);
  if (!memo.has(name)) {
    memo.set(
      name,
      Promise.race([use(name).catch(() => null), new Promise((r) => setTimeout(() => r(null), 10000))]),
    );
  }
  return memo.get(name)!;
}
