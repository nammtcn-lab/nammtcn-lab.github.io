// Kiểm thử giao diện thật bằng Playwright: chạy `npm run build && npx vite preview --port 4173` rồi `npm run e2e`
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright'); // dùng bản Playwright cài sẵn trên máy
import { mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const URL = process.env.APP_URL || 'http://localhost:4173/';
const OUT = process.env.OUT || 'tests/out';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('✔', ...a);
const fail = (m) => {
  throw new Error('✘ ' + m);
};

const browser = await chromium.launch();
const errors = [];
try {
  // ---------------- máy tính ----------------
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL);
  await page.getByTestId('open-sample').click();
  await page.getByTestId('canvas').waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/e2e-01-sample.png` });
  log('mở dự án mẫu');

  // về danh sách, tạo dự án mới
  await page.getByTestId('back').click();
  await page.getByTestId('new-project').click();
  await page.getByTestId('np-name').fill('Kiểm thử E2E');
  await page.getByTestId('np-create').click();
  await page.getByTestId('draw-panel').waitFor();
  log('tạo dự án mới');

  // vẽ phòng 4000 x 5000 bằng nhập số
  await page.getByTestId('set-start').click();
  const len = page.getByTestId('len-input');
  for (const [v, dir] of [['4000', 'right'], ['5000', 'up'], ['4000', 'left']]) {
    await len.fill(v);
    await page.getByTestId('dir-' + dir).click();
  }
  await page.getByTestId('close-chain').click();
  await page.getByTestId('panel-room').click();
  const area = await page.getByTestId('room-area').innerText();
  if (!area.includes('20')) fail('diện tích sai: ' + area);
  log('vẽ & khép kín phòng 4000×5000, diện tích', area);

  // chọn cạnh dưới bằng cách bấm trên canvas
  await page.getByTestId('fit').click();
  await page.waitForTimeout(200);
  const box = await page.getByTestId('canvas').boundingBox();
  // tìm vị trí cạnh dưới: dùng hàm toScreen qua tọa độ thế giới (2000, 0) — tính từ thước: lấy qua evaluate
  const pt = await page.evaluate(() => {
    const ctl = window.__vht?.ctl;
    return ctl ? ctl.vp.toScreen({ x: 2000, y: 0 }) : null;
  });
  if (!pt) fail('không lấy được khung nhìn');
  await page.getByTestId('tool-select').click();
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  await page.getByTestId('seg-props').waitFor();
  log('chọn đoạn trên canvas');

  // chèn cửa sổ 1500 cách đầu 1200 vào cạnh 4000
  await page.getByText('Chèn cửa vào đoạn này').click();
  await page.getByTestId('seg-props').getByText('Cửa sổ', { exact: true }).last().click();
  await page.getByTestId('ins-offset').fill('1200');
  await page.getByTestId('ins-width').fill('1500');
  await page.getByTestId('ins-apply').click();
  await page.waitForTimeout(150);
  const w = await page.getByTestId('seg-length').inputValue();
  if (w !== '1500') fail('chiều rộng cửa sổ sai: ' + w);
  const sill = await page.getByTestId('win-sill').inputValue();
  if (sill !== '') fail('cao độ bậu phải để trống');
  log('chèn cửa sổ 1500, bậu cửa để trống');

  // chuyển đoạn #3 (tường 1300) thành cửa đi
  await page.getByLabel('Đoạn sau').click();
  await page.getByTestId('seg-kind').getByText('Cửa đi').click();
  await page.getByTestId('seg-props').getByText('Gợi ý 2.200').click();
  await page.waitForTimeout(150);
  const dh = await page.getByTestId('door-height').inputValue();
  if (dh !== '2200') fail('chiều cao cửa đi: ' + dh);
  log('chuyển đoạn thành cửa đi, dùng gợi ý 2200');

  // undo / redo
  await page.getByTestId('undo').click();
  await page.getByTestId('undo').click();
  await page.getByTestId('redo').click();
  log('undo/redo');

  // bề dày tường + cao độ
  await page.getByTestId('panel-room').click();
  await page.getByTestId('room-thickness').fill('200');
  await page.getByTestId('room-thickness').press('Enter');
  await page.getByTestId('add-heights').getByText('+ Trần bê tông').click();
  await page.getByTestId('h-slab').fill('3200');
  await page.getByTestId('h-slab').press('Enter');
  await page.getByTestId('add-heights').getByText('+ Trần giả').click();
  await page.getByTestId('h-falseCeiling').fill('2850');
  await page.getByTestId('h-falseCeiling').press('Enter');
  await page.getByTestId('add-heights').getByText('+ Trần giật cấp').click();
  log('bề dày 200, cao độ trần');

  // vẽ vùng trần
  await page.getByTestId('zone-tool').click();
  const a = await page.evaluate(() => window.__vht.ctl.vp.toScreen({ x: 500, y: 500 }));
  const b = await page.evaluate(() => window.__vht.ctl.vp.toScreen({ x: 3500, y: 4500 }));
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  await page.getByTestId('zone-props').waitFor();
  log('vẽ vùng trần giật cấp');

  await page.waitForTimeout(900); // tự lưu
  if ((await page.getByTestId('save-state').innerText()) !== 'Đã lưu') fail('chưa tự lưu');
  await page.screenshot({ path: `${OUT}/e2e-02-edited.png` });

  // tải lại trang → dữ liệu còn
  await page.reload();
  await page.getByText('Kiểm thử E2E').click();
  await page.getByTestId('panel-room').click();
  const area2 = await page.getByTestId('room-area').innerText();
  const slab = await page.getByTestId('h-slab').inputValue();
  if (slab !== '3200') fail('mất cao độ sau tải lại');
  log('tải lại trang: dữ liệu còn nguyên', area2, 'trần BT', slab);

  // xuất DXF / PDF / PNG / JSON
  await page.getByTestId('panel-export').click();
  for (const id of ['dxf', 'pdf', 'img', 'json']) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-' + id).click()]);
    const p = `${OUT}/e2e-export.${id === 'img' ? 'png' : id}`;
    await dl.saveAs(p);
    log('xuất', id, '→', dl.suggestedFilename());
  }
  const dxfCheck = execFileSync('python3', ['-c', `import ezdxf;d=ezdxf.readfile('${OUT}/e2e-export.dxf');a=d.audit();m=d.modelspace();print(len(a.errors), sorted({e.dxf.layer for e in m}))`]).toString();
  if (!dxfCheck.startsWith('0 ')) fail('DXF lỗi: ' + dxfCheck);
  log('DXF hợp lệ (ezdxf audit):', dxfCheck.trim());
  const pdf = readFileSync(`${OUT}/e2e-export.pdf`);
  if (!pdf.subarray(0, 5).toString().startsWith('%PDF')) fail('PDF không hợp lệ');

  // pan/zoom bằng chuột
  await page.getByTestId('panel-close').click();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.wheel(0, -400);
  await page.getByTestId('fit').click();
  log('zoom / fit');

  // thư viện mẫu: chèn phòng ngủ rồi kéo cạnh để co giãn
  await page.getByTestId('panel-library').click();
  await page.getByTestId('tpl-bedroom').click();
  await page.getByTestId('tpl-w').fill('3500');
  await page.getByTestId('tpl-insert').click();
  await page.waitForTimeout(300);
  const libRoom = await page.evaluate(() => {
    const s = window.__vht.store.get();
    const f = s.project.floors.find((x) => x.id === s.ui.floorId);
    const r = f.rooms.find((x) => x.id === s.ui.roomId);
    const xs = r.boundary.vertices.map((v) => v.x), ys = r.boundary.vertices.map((v) => v.y);
    return { name: r.name, kinds: r.boundary.segments.map((x) => x.kind).join(','), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), x0: Math.min(...xs), y0: Math.min(...ys) };
  });
  if (libRoom.w !== 3500 || !libRoom.kinds.includes('door') || !libRoom.kinds.includes('window')) fail('chèn mẫu sai: ' + JSON.stringify(libRoom));
  log('chèn mẫu phòng ngủ', libRoom.w, '×', libRoom.d, libRoom.kinds);
  // kéo cạnh phải (x = x0 + 3500) ra thêm ~500 mm
  const ea = await page.evaluate((r) => window.__vht.ctl.vp.toScreen({ x: r.x0 + r.w, y: r.y0 + r.d / 2 }), libRoom);
  const eb = await page.evaluate((r) => window.__vht.ctl.vp.toScreen({ x: r.x0 + r.w + 500, y: r.y0 + r.d / 2 }), libRoom);
  const cbox = await page.getByTestId('canvas').boundingBox();
  await page.mouse.move(cbox.x + ea.x, cbox.y + ea.y);
  await page.mouse.down();
  await page.mouse.move(cbox.x + (ea.x + eb.x) / 2, cbox.y + ea.y, { steps: 5 });
  await page.mouse.move(cbox.x + eb.x, cbox.y + eb.y, { steps: 5 });
  await page.mouse.up();
  const w2 = await page.evaluate(() => {
    const s = window.__vht.store.get();
    const r = s.project.floors.find((x) => x.id === s.ui.floorId).rooms.find((x) => x.id === s.ui.roomId);
    const xs = r.boundary.vertices.map((v) => v.x);
    return Math.max(...xs) - Math.min(...xs);
  });
  if (Math.abs(w2 - 4000) > 20) fail('kéo cạnh không đúng: rộng ' + w2);
  log('kéo cạnh tường: rộng 3500 →', w2);
  await page.getByTestId('panel-room').click();
  await page.getByTestId('stretch-y').fill('4200');
  await page.getByTestId('stretch-y').press('Enter');
  await page.waitForTimeout(150);
  log('co giãn theo Y bằng số đo');
  await page.screenshot({ path: `${OUT}/e2e-07-library.png` });

  // ---------------- điện thoại ----------------
  const mctx = await browser.newContext({ ...devices['iPhone 13'] });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => errors.push('mobile: ' + e.message));
  await m.goto(URL);
  await m.getByTestId('open-sample').tap();
  await m.getByTestId('canvas').waitFor();
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${OUT}/e2e-03-mobile.png` });
  // chạm chọn phòng & đoạn
  const mb = await m.getByTestId('canvas').boundingBox();
  const mp = await m.evaluate(() => window.__vht.ctl.vp.toScreen({ x: 2000, y: 0 }));
  await m.touchscreen.tap(mb.x + mp.x, mb.y + mp.y);
  await m.getByTestId('seg-props').waitFor();
  await m.screenshot({ path: `${OUT}/e2e-04-mobile-props.png` });
  log('điện thoại: chạm chọn đoạn');
  // phòng mới, vẽ bằng thao tác chạm kéo (mô phỏng sự kiện pointer cảm ứng)
  await m.getByTestId('panel-rooms').tap();
  await m.getByTestId('add-room').tap();
  await m.waitForTimeout(200);
  const cb = await m.getByTestId('canvas').boundingBox();
  const sx = cb.x + cb.width * 0.3;
  const sy = cb.y + cb.height * 0.75;
  await touchDrag(m, sx, sy, sx, sy + 2); // đặt điểm đầu
  const scale = await m.evaluate(() => window.__vht.ctl.vp.scale);
  const px = 3000 * scale;
  await touchDrag(m, sx, sy, sx + px, sy);
  await touchDrag(m, sx, sy, sx, sy - px);
  await m.screenshot({ path: `${OUT}/e2e-05-mobile-draw.png` });
  const segs = await m.evaluate(() => {
    const s = window.__vht.store.get();
    const f = s.project.floors.find((x) => x.id === s.ui.floorId);
    const r = f.rooms.find((x) => x.id === s.ui.roomId);
    return r.boundary.segments.length + ' đoạn, ' + r.boundary.vertices.map((v) => `(${Math.round(v.x)},${Math.round(v.y)})`).join(' ');
  });
  if (!segs.startsWith('2 ')) fail('vẽ bằng chạm kéo không tạo được 2 đoạn: ' + segs);
  log('điện thoại: kéo ngón tay vẽ được', segs);
  // pinch zoom 2 ngón
  const s0 = await m.evaluate(() => window.__vht.ctl.vp.scale);
  await pinch(m, cb.x + cb.width / 2, cb.y + cb.height / 2, 40, 140);
  const s1 = await m.evaluate(() => window.__vht.ctl.vp.scale);
  if (!(s1 > s0 * 1.5)) fail(`pinch zoom không đổi tỷ lệ ${s0} → ${s1}`);
  log('điện thoại: chụm 2 ngón zoom', s0.toFixed(4), '→', s1.toFixed(4));

  // ---------------- máy tính bảng ----------------
  const tctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'] });
  const t = await tctx.newPage();
  await t.goto(URL);
  await t.getByTestId('open-sample').tap();
  await t.waitForTimeout(400);
  await t.getByTestId('panel-room').tap();
  await t.screenshot({ path: `${OUT}/e2e-06-tablet.png` });
  log('máy tính bảng hiển thị');

  if (errors.length) fail('lỗi console: ' + errors.join(' | '));
  console.log('\nTẤT CẢ KIỂM THỬ GIAO DIỆN ĐẠT');
} finally {
  await browser.close();
}

async function touchDrag(page, x0, y0, x1, y1) {
  await page.evaluate(
    ([x0, y0, x1, y1]) => {
      const c = document.querySelector('[data-testid=canvas]');
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      ev('pointerdown', x0, y0);
      for (let i = 1; i <= 8; i++) ev('pointermove', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
      ev('pointerup', x1, y1);
    },
    [x0, y0, x1, y1],
  );
  await page.waitForTimeout(60);
}

async function pinch(page, cx, cy, d0, d1) {
  await page.evaluate(
    ([cx, cy, d0, d1]) => {
      const c = document.querySelector('[data-testid=canvas]');
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, buttons: type === 'pointerup' ? 0 : 1 }));
      ev('pointerdown', 1, cx - d0 / 2, cy);
      ev('pointerdown', 2, cx + d0 / 2, cy);
      for (let i = 1; i <= 10; i++) {
        const d = d0 + ((d1 - d0) * i) / 10;
        ev('pointermove', 1, cx - d / 2, cy);
        ev('pointermove', 2, cx + d / 2, cy);
      }
      ev('pointerup', 1, cx - d1 / 2, cy);
      ev('pointerup', 2, cx + d1 / 2, cy);
    },
    [cx, cy, d0, d1],
  );
  await page.waitForTimeout(60);
}
