# Vẽ Hiện Trạng — ứng dụng khảo sát & vẽ mặt bằng hiện trạng nhà ở

Web App / PWA chạy trên trình duyệt máy tính, điện thoại (iPhone, Android) và máy tính bảng.
Dữ liệu lưu ngay trên thiết bị (IndexedDB), không cần đăng nhập, chạy ngoại tuyến sau lần tải đầu.

- **Bản đã build** (chạy ngay, GitHub Pages): thư mục `../ve-hien-trang/` → `https://www.hocnghenoithat.vn/ve-hien-trang/`
- **Bản một file HTML** (mọi thứ nhúng sẵn, mở trong ứng dụng Claude hoặc gửi kèm): `../ve-hien-trang-1file/ve-hien-trang.html` — tạo bằng `npm run build:single`
- **Mã nguồn**: thư mục này (`ve-hien-trang-src/`)

Khi chạy trong ứng dụng Claude (artifact): dữ liệu lưu vào kho riêng của tài khoản Claude (đồng bộ giữa các thiết bị),
file xuất qua hộp thoại lưu của Claude; DXF được nén thành `.dxf.zip` vì Claude không cho lưu trực tiếp đuôi .dxf.

## Chạy thử trên máy

```bash
npm install
npm run dev          # mở http://localhost:5173 (thêm --host để mở từ điện thoại cùng mạng Wi-Fi)
```

Build bản phát hành (ghi ra `../ve-hien-trang/`):

```bash
npm run build
npx vite preview --port 4173
```

## Kiểm thử

```bash
npm test            # kiểm thử hình học & dữ liệu (6 bài kiểm tra theo yêu cầu + bổ sung)
npm run test:dxf    # ghi DXF mẫu ra tests/out và kiểm tra bằng ezdxf (cần: pip install ezdxf matplotlib)
npm run e2e         # kiểm thử giao diện thật bằng Playwright (cần chạy vite preview cổng 4173 trước)
node tests/e2e/single.mjs   # kiểm thử bản một file trong môi trường giả lập ứng dụng Claude
```

## Kiến trúc

| Thư mục | Vai trò |
|---|---|
| `src/model/` | Cấu trúc dữ liệu (mm, tọa độ thực), tạo đối tượng, **thao tác chỉnh sửa thuần** (`ops.ts`), dữ liệu mẫu |
| `src/geometry/` | Bộ máy hình học: vector, đa giác, chuỗi chu vi, **offset bề dày tường** (`walls.ts`) |
| `src/drawing/` | Bộ tạo bản vẽ: dữ liệu → LINE/POLYLINE/ARC/TEXT/DIM theo layer (dùng chung cho màn hình & xuất file) |
| `src/render/` | Bộ máy hiển thị Canvas: khung nhìn (nơi duy nhất có pixel), lưới, thước, lớp chọn |
| `src/input/` | Xử lý cảm ứng & chuột: vẽ kéo, bắt điểm/bắt góc/khóa phương, chọn, kéo đỉnh, pinch zoom |
| `src/store/` | Trạng thái, Undo/Redo theo snapshot, tự động lưu IndexedDB |
| `src/export/` | DXF (R2000, mm 1:1), PDF vector (A4/A3, tỷ lệ, khung tên), PNG/JPG, JSON |
| `src/model/templates.ts` | Thư viện mặt bằng mẫu (phòng ngủ, WC, khách, bếp…) dựng theo kích thước bao |
| `src/geometry/fixtures.ts` | Thiết bị theo tim: bám tường, khoảng cách tới góc / tới tường |
| `src/drawing/elevation.ts` | Mặt đứng từng mảng tường: cửa, thiết bị, len chân tường, cao độ trần, ghi chú |
| `src/platform.ts` | Nhận biết chạy trong ứng dụng Claude và lấy capability (lưu trữ, lưu file) |
| `src/ui/` | Giao diện React |

Nguyên tắc chính:
- Đường biên đo gốc = **mặt trong tường**; bề dày tường (mặc định quy ước 140 mm) chỉ sinh ra đường biên **ngoài**.
- Cửa đi / cửa sổ / ô mở là **một đoạn trong chuỗi chu vi**, không phải ký hiệu đè lên tường → tường tự ngắt tại khoảng mở.
- Giá trị gợi ý (cửa cao 2200, bậu 900, cửa sổ cao 1400) chỉ được điền khi người dùng bấm “Gợi ý”.

Phông chữ nhúng PDF: Liberation Sans (SIL Open Font License), đã rút gọn bộ ký tự Latin + tiếng Việt.
