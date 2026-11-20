import { capability, inClaude } from '../platform';
import { makeZip } from './zip';

/** Đuôi file ứng dụng Claude cho phép lưu trực tiếp */
const CLAUDE_EXT = /\.(png|jpe?g|pdf|json|txt|csv|zip|svg|html)$/i;

/**
 * Lưu file về máy. Trong ứng dụng Claude: dùng hộp thoại lưu của Claude
 * (file không thuộc danh sách cho phép, như .dxf, được nén vào .zip).
 * Trả về thông điệp để báo người dùng.
 */
export async function saveFile(blob: Blob, filename: string): Promise<string> {
  if (inClaude()) {
    const dl = await capability<{ save(r: { filename: string; data: Blob | Uint8Array }): Promise<unknown> }>('downloads');
    if (!dl) throw new Error('Ứng dụng Claude trên thiết bị này chưa cho phép lưu file. Hãy mở bản web để xuất file.');
    let name = filename;
    let data: Blob | Uint8Array = blob;
    let note = '';
    if (!CLAUDE_EXT.test(filename)) {
      data = makeZip([{ name: filename, data: new Uint8Array(await blob.arrayBuffer()) }]);
      name = filename + '.zip';
      note = ` (nén trong ${name} — giải nén để lấy file ${filename.split('.').pop()?.toUpperCase()})`;
    }
    try {
      await dl.save({ filename: name, data });
      return 'Đã lưu file' + note + '.';
    } catch (e: any) {
      if (e?.code === 'declined') return 'Đã hủy lưu file.';
      throw new Error(e?.message || 'Không lưu được file.');
    }
  }
  downloadBlob(blob, filename);
  return 'Đã tải file ' + filename + '.';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function canShareFiles(): boolean {
  if (inClaude()) return false;
  try {
    const f = new File(['x'], 'x.txt', { type: 'text/plain' });
    return !!navigator.canShare && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

export async function shareBlob(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

/** Tên file an toàn (bỏ dấu tiếng Việt, ký tự đặc biệt) */
export function safeName(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'ban-ve'
  );
}

export function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
