"""Bộ icon nét mảnh màu tím trong ô vuông bo góc (dùng chung cho các trang).
icon(ten) trả về <span class="ico">…svg…</span>."""
P = {
  'mam':     '<path d="M12 20v-8"/><path d="M12 12c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6z"/><path d="M12 14c0-3 2.2-5.2 6-5.2 0 3-2.2 5.2-6 5.2z"/><path d="M7 20h10"/>',
  'thuoc':   '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/>',
  'den':     '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  'khach':   '<path d="M3 6.5h11v7H8l-3 2.5v-2.5H3z"/><path d="M14 10h7v7h-2v2.5L16 17h-5v-3"/>',
  'motnguoi': '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  'nguoi':   '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14.2c2.6.2 4.5 2 4.5 4.3"/>',
  'sach':    '<path d="M3 5.5c3-1 6-.8 9 1v13c-3-1.8-6-2-9-1z"/><path d="M21 5.5c-3-1-6-.8-9 1v13c3-1.8 6-2 9-1z"/>',
  'dat':     '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.2 9.5"/>',
  'video':   '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.3v5.4l4.6-2.7z"/>',
  'dangky':  '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 3.5h6v3H9z"/><path d="M8.5 11.5h7M8.5 15.5h4.5"/>',
  'luoi':    '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/><path d="M17 4v6M14 7h6"/>',
  'hoi':     '<path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z"/><path d="M10 9.3a2 2 0 1 1 2.8 1.8c-.5.2-.8.6-.8 1.1v.3"/><circle cx="12" cy="14.3" r=".5"/>',
  'gia':     '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.5"/>',
  'hotro':   '<path d="M12 20s-7-4.3-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.7 12 20 12 20z"/>',
  'phanmem': '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  'combo':   '<rect x="3.5" y="8" width="17" height="12" rx="2"/><path d="M3.5 12h17M12 8v12"/><path d="M12 8c-1.5-3-5-3.5-5-1.2C7 8 9.5 8 12 8zM12 8c1.5-3 5-3.5 5-1.2C17 8 14.5 8 12 8z"/>',
}
def icon(ten):
    return (f'<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{P[ten]}</svg></span>')
