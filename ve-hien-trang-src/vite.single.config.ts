/**
 * Bản MỘT FILE HTML (JS, CSS, phông chữ nhúng sẵn) — dùng để mở trong ứng dụng Claude (artifact)
 * hoặc gửi kèm như một file độc lập. Ghi ra dist-single/ve-hien-trang.html
 */
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

/** Bỏ liên kết manifest/icon (không có file đi kèm) và đổi tên file đầu ra */
function singlePage(): Plugin {
  return {
    name: 'single-page',
    transformIndexHtml: (html) =>
      html
        .replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '')
        .replace('<title>Vẽ Hiện Trạng — khảo sát mặt bằng</title>', '<title>Vẽ Hiện Trạng</title>'),
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile(), singlePage()],
  define: { 'import.meta.env.VITE_SINGLE': '"1"' },
  build: {
    outDir: resolve(__dirname, 'dist-single'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});
