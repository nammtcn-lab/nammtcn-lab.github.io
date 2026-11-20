// Kiểm thử bản MỘT FILE HTML trong môi trường giả lập ứng dụng Claude (claude.use: db, user, downloads).
// Chạy: npm run build:single && node tests/e2e/single.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const FILE = 'file://' + resolve('dist-single/ve-hien-trang.html');
const OUT = 'tests/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('✔', ...a);
const fail = (m) => {
  throw new Error('✘ ' + m);
};

// Giả lập nền tảng Claude: kho db lưu tạm trong sessionStorage (giữ qua tải lại), downloads ghi nhận file
const MOCK = `(() => {
  const KEY = '__mockdb';
  const load = () => JSON.parse(sessionStorage.getItem(KEY) || '{}');
  const store = (o) => sessionStorage.setItem(KEY, JSON.stringify(o));
  const doc = (path) => ({
    id: path.split('/').pop(), path,
    get: async () => { const d = load()[path]; return { id: path.split('/').pop(), exists: !!d, data: () => d, metadata: {} }; },
    set: async (data) => { const o = load(); o[path] = data; store(o); },
    delete: async () => { const o = load(); delete o[path]; store(o); },
  });
  const collection = (path) => ({
    path, doc: (id) => doc(path + '/' + id),
    get: async () => { const o = load(); const docs = Object.keys(o).filter((k) => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1).map((k) => ({ id: k.split('/').pop(), exists: true, data: () => o[k], metadata: {} })); return { docs, size: docs.length, empty: !docs.length }; },
  });
  window.__saved = [];
  // giống sandbox của Claude: chặn confirm và tải file trực tiếp
  window.confirm = () => { throw new Error('confirm bị chặn'); };
  const caps = {
    db: { doc, collection },
    user: { id: async () => 'u_test', isOwner: async () => true },
    downloads: { save: async ({ filename, data }) => { const buf = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data.buffer ?? data); window.__saved.push({ filename, b64: btoa(String.fromCharCode(...buf.slice(0, 300000))) , size: buf.length }); return { status: 'saved' }; } },
  };
  window.claude = { use: (n) => new Promise((r) => setTimeout(() => r(caps[n] ?? null), 50)) };
})();`;

const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE);
  await page.getByTestId('backend').waitFor();
  const backend = await page.getByTestId('backend').innerText();
  if (!backend.includes('tài khoản Claude')) fail('không dùng kho tài khoản Claude: ' + backend);
  log('nhận kho lưu trữ tài khoản Claude');
  await page.getByTestId('open-sample').tap();
  await page.getByTestId('canvas').waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/single-01.png` });

  // thư viện mẫu trên điện thoại
  await page.getByTestId('panel-library').tap();
  await page.getByTestId('tpl-wc').tap();
  await page.getByTestId('tpl-insert').tap();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/single-02-wc.png` });
  log('chèn mẫu phòng vệ sinh');

  // xuất DXF → nhận file .dxf.zip qua capability downloads
  await page.getByTestId('panel-export').tap();
  await page.getByTestId('export-dxf').tap();
  await page.getByTestId('export-pdf').tap();
  await page.waitForFunction(() => window.__saved.length >= 2, null, { timeout: 15000 });
  const saved = await page.evaluate(() => window.__saved.map((f) => ({ filename: f.filename, size: f.size, b64: f.b64 })));
  const zip = saved.find((f) => f.filename.endsWith('.dxf.zip'));
  if (!zip) fail('DXF không được lưu dạng zip: ' + saved.map((f) => f.filename));
  writeFileSync(`${OUT}/single.dxf.zip`, Buffer.from(zip.b64, 'base64'));
  const chk = execFileSync('python3', ['-c', `import zipfile,io,ezdxf;z=zipfile.ZipFile('${OUT}/single.dxf.zip');n=z.namelist()[0];d=ezdxf.read(io.StringIO(z.read(n).decode()));print(n, len(d.audit().errors))`]).toString().trim();
  if (!chk.endsWith(' 0')) fail('DXF trong zip lỗi: ' + chk);
  log('DXF giao qua Claude dạng zip, giải nén & ezdxf audit OK:', chk);
  if (!saved.some((f) => f.filename.endsWith('.pdf') && f.size > 5000)) fail('PDF không lưu được');
  log('PDF lưu qua Claude', saved.find((f) => f.filename.endsWith('.pdf')).size, 'bytes');

  // xóa phòng bằng hộp thoại trong trang (confirm bị chặn)
  await page.getByTestId('panel-rooms').tap();
  await page.getByTitle('Xóa phòng').last().tap();
  await page.getByTestId('confirm-ok').tap();
  log('hộp thoại xác nhận trong trang hoạt động');
  await page.waitForTimeout(1200);

  // tải lại: dự án vẫn còn (từ kho tài khoản)
  await page.evaluate(() => indexedDB.deleteDatabase('ve-hien-trang'));
  await page.reload();
  await page.getByText('Nhà mẫu — Khảo sát hiện trạng').waitFor({ timeout: 15000 });
  log('tải lại (xóa bản trên thiết bị): dự án vẫn còn trong kho tài khoản');

  if (errors.length) fail('lỗi: ' + errors.join(' | '));
  console.log('\nBẢN MỘT FILE (GIẢ LẬP CLAUDE) ĐẠT');
} finally {
  await browser.close();
}
