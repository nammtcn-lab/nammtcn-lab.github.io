#!/usr/bin/env python3
"""Dựng trang chi tiết cho từng khoá học: khoa-hoc/<ten>.html

Sửa nội dung ở danh sách KHOA bên dưới rồi chạy:
    python3 cong-cu/tao-khoa-hoc.py

- video: danh sách (mã YouTube, tên video). Video đầu tiên hiện to ở đầu trang,
  các video sau vào mục "Xem video bài giảng".
- anh: danh sách (đường dẫn ảnh trong thư mục anh/, chú thích). Để trống thì hiện ô chờ ảnh.
"""
import html, pathlib

GOC = pathlib.Path(__file__).resolve().parent.parent
RA = GOC / 'khoa-hoc'
FONT = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap&subset=vietnamese'
ZALO = 'https://zalo.me/0988504858'
FORM = 'https://docs.google.com/forms/d/e/{}/viewform'

KHOA = [
  dict(ten='do-go', mau='c-violet', nhan='Nên học trước',
       tieu_de='Thiết kế đồ nội thất gỗ công nghiệp',
       cau1='Vẽ 3D chưa phải là thiết kế.', cau2='Vẽ sao cho xưởng sản xuất được mới là thiết kế.',
       gia='3.000.000', gia_phu='', so_lieu='Gần 80 video bài học',
       form='1FAIpQLSfQxAkoKXSXmKOlOiXHCPoDMdVTEEzLfocBijmvAzzzoXNQAg',
       thumb='anh/video-do-go.jpg',
       hop_voi=['Kiến trúc sư, người đang vẽ 3D theo mẫu hoặc theo chỉ đạo của leader',
                'Người chưa biết chọn vật liệu, kết cấu, phụ kiện',
                'Người chưa dám nhận thi công'],
       hoc_gi=['Vật liệu gỗ công nghiệp, phương thức sản xuất', 'Liên kết và hoàn thiện bề mặt', 'Đo đạc, khảo sát',
               'Thiết kế tủ áo, tủ giày, tủ bếp, giường, vách', 'Triển khai bằng SketchUp', 'Chọn vật liệu hợp túi tiền chủ nhà'],
       lam_duoc=['Ra bản vẽ đồ gỗ mà xưởng đọc là sản xuất được, không phải hỏi lại',
                 'Tự chọn vật liệu, liên kết, phụ kiện cho từng món đồ',
                 'Đủ tự tin để nhận cả thiết kế lẫn thi công đồ gỗ'],
       ho_tro='Gửi bài vào nhóm Facebook học viên, Nam nhận xét.',
       video=[('RMaDNY6P_i0', 'Xem video bài giảng')], anh=[]),
  dict(ten='nha-o', mau='c-blue', nhan='Khoá học video',
       tieu_de='Thiết kế nội thất căn hộ chung cư',
       cau1='Chủ động triển khai –', cau2='tự làm được từ dự án nhỏ.',
       gia='2.000.000', gia_phu='', so_lieu='',
       form='1FAIpQLSdifzcGTMugGK9Ek7sWFCMCUjauHt-X1sbSAenD5RiDJKavzA',
       thumb='anh/video-nha-o.jpg',
       hop_voi=['Sinh viên chưa làm nhiều đồ án nhà ở',
                'Người đã đi làm nhưng mới làm một phần: dựng 3D theo ý sếp, triển khai 2D theo 3D người khác'],
       hoc_gi=['Khảo sát, ghi nhận yêu cầu', 'Concept, moodboard', 'Bảng vật liệu', 'Mặt bằng',
               'Điện nước, điều hoà, chiếu sáng', 'Trần, sàn, phào chỉ', 'Bản vẽ đồ gỗ', 'Chọn vật liệu'],
       lam_duoc=['Tự làm được một dự án nhà ở từ khảo sát tới bản vẽ đồ gỗ',
                 'Nói chuyện được với chủ nhà từ buổi gặp đầu tiên'],
       ho_tro='', video=[('4BU7QPbhG1c', 'Video giới thiệu khoá học')],
       anh=[('anh/can-ho-phong-khach.jpg', 'Một căn hộ Nam đã làm')]),
  dict(ten='du-toan', mau='c-teal', nhan='Khoá học video',
       tieu_de='Dự toán thi công nội thất cơ bản',
       cau1='Sắp tự đứng ra nhận công trình?', cau2='Học làm báo giá bằng Excel cho chuẩn.',
       gia='2.000.000', gia_phu='', so_lieu='',
       form='1FAIpQLSfOYgJ1NfPnBZgYwoXjs7Bxw-1M9cBJWtqSdpA-mTsrHY5d0g',
       thumb='anh/video-du-toan.jpg',
       hop_voi=['Người chưa từng làm dự toán', 'Người sắp tự đứng ra nhận công trình', 'Người còn yếu khâu báo giá'],
       hoc_gi=['Dùng Excel làm báo giá', 'Thống kê khối lượng', 'Tính giá theo m², mét dài, cái, gói'],
       lam_duoc=['Tự lập báo giá cho một công trình nội thất', 'Biết mình đang lãi lỗ ở đâu trước khi ký hợp đồng'],
       ho_tro='', video=[('xZTKqIOn3Ho', 'Video giới thiệu khoá học')],
       anh=[('anh/cua-hang-giay.jpg', 'Cửa hàng giày Nam làm, dùng làm ví dụ trong khoá')]),
  dict(ten='sale', mau='c-plum', nhan='Khoá học video',
       tieu_de='Tư vấn thiết kế dành cho sale nội thất',
       cau1='Sale hiểu vật liệu, hiểu xưởng.', cau2='Giao đề bài đúng cho đội thiết kế ngay từ đầu.',
       gia='2.000.000', gia_phu='', so_lieu='',
       form='1FAIpQLSd36TPP4fJHnBqVSjlIcWRFq9aTq3KaVEYv0PhZv77tCKz2KQ',
       thumb='anh/video-sale.jpg',
       hop_voi=['Người làm sale nội thất'],
       hoc_gi=['Hiểu vật liệu để tư vấn sơ bộ', 'Quy trình sản xuất và thiết kế thi công',
               'Phối hợp với thiết kế và xưởng', 'Nắm bắt nhu cầu khách để giao đề bài đúng cho đội thiết kế'],
       lam_duoc=['Tư vấn sơ bộ cho khách mà không phải chờ thiết kế', 'Giao đề bài rõ ràng, đội thiết kế đỡ làm đi làm lại'],
       ho_tro='', video=[('o3diN7-IPm8', 'Video giới thiệu khoá học')], anh=[]),
  dict(ten='cnc', mau='c-slate', nhan='Khoá học video',
       tieu_de='Ra file cắt CNC với ABF',
       cau1='Chốt mẫu xong là tự ra được file cắt.', cau2='Tránh hỏng ván, mất tiền.',
       gia='4.000.000', gia_phu='', so_lieu='Có buổi tham quan xưởng ở Hà Nội',
       form='1FAIpQLSdlW6PsAcfmVvk8memwWx3kS7WMFKxt3L8bE9HIWEsogFJPYQ',
       thumb='anh/video-cnc.jpg',
       hop_voi=[],
       hoc_gi=['Quy trình từ lúc chốt mẫu với khách tới khi ra file cắt gỗ', 'Cách tránh hỏng ván, mất tiền',
               'Tham quan xưởng sản xuất ở Hà Nội'],
       lam_duoc=['Tự ra file cắt cho xưởng mình', 'Làm cộng tác viên ra file cho xưởng khác'],
       ho_tro='', video=[], anh=[]),
]

e = lambda s: html.escape(s, quote=True)

def yt(vid, ten, thumb=None):
    img = thumb or f'https://i.ytimg.com/vi/{vid}/hqdefault.jpg'
    return (f'<div class="yt" data-id="{vid}"><a class="yt-btn" href="https://youtu.be/{vid}" target="_blank" rel="noopener" '
            f'aria-label="Phát video: {e(ten)}"><img src="{img}" alt="" loading="lazy" decoding="async">'
            f'<span class="yt-play" aria-hidden="true"></span></a></div>')

def ds(items, cls='ticks'):
    return f'<ul class="{cls}">' + ''.join(f'<li>{e(x)}</li>' for x in items) + '</ul>'

def trang(k, cac):
    form = FORM.format(k['form'])
    dk = k.get('dang_ky', 'Đăng ký ngay')
    dau = yt(k['video'][0][0], k['video'][0][1], '../' + k['thumb']) if k['video'] else \
          f'<div class="yt yt-still"><img src="../{k["thumb"]}" alt="" decoding="async"></div>'
    gia_phu = f' <small>đ · {e(k["gia_phu"])}</small>' if k['gia_phu'] else ' <small>đ</small>'
    so_lieu = f'<p class="fact">{e(k["so_lieu"])}</p>' if k['so_lieu'] else ''
    khoi = []
    if k['hop_voi']:
        khoi.append(f'<section class="blk"><h2>Khoá này hợp với ai nhỉ?</h2>{ds(k["hop_voi"])}</section>')
    hoc = ''.join(f'<li><span class="n">{i:02d}</span>{e(x)}</li>' for i, x in enumerate(k['hoc_gi'], 1))
    khoi.append(f'<section class="blk"><h2>Anh em sẽ học được gì?</h2><ol class="lessons">{hoc}</ol></section>')
    khoi.append(f'<section class="blk blk-tint {k["mau"]}"><h2>Học xong làm được gì?</h2>{ds(k["lam_duoc"], "ticks light")}</section>')
    them = k['video'][1:]
    vbox = ''.join(f'<figure>{yt(v, t)}<figcaption>{e(t)}</figcaption></figure>' for v, t in them)
    if not them:
        vbox = '<div class="wait">Nam đang chọn thêm vài video bài học để anh em xem thử. Sắp có.</div>'
    khoi.append(f'<section class="blk"><h2>Xem video bài giảng</h2><div class="vgrid">{vbox}</div></section>')
    abox = ''.join(f'<figure><img src="../{a}" alt="{e(c)}" loading="lazy" decoding="async"><figcaption>{e(c)}</figcaption></figure>' for a, c in k['anh'])
    if not k['anh']:
        abox = '<div class="wait">Ảnh minh hoạ cho khoá này đang được cập nhật.</div>'
    khoi.append(f'<section class="blk"><h2>Hình ảnh minh hoạ</h2><div class="pgrid">{abox}</div></section>')
    if k['ho_tro']:
        khoi.append(f'<section class="blk"><h2>Học xong có ai hỗ trợ không?</h2><p class="txt">{e(k["ho_tro"])}</p></section>')
    khoi.append('''<section class="blk"><h2>Đăng ký thế nào?</h2><ol class="how">
      <li><b>1</b><span>Điền form đăng ký</span></li><li class="has-qr"><b>2</b><details class="qr-box"><summary>Chuyển khoản <span class="qr-here">(tại đây)</span></summary><a class="qr" href="../anh/qr-chuyen-khoan.jpg" target="_blank" rel="noopener"><img src="../anh/qr-chuyen-khoan.jpg" alt="Mã QR chuyển khoản MB Bank, tài khoản Nguyen Thanh Nam" loading="lazy"></a></details></li>
      <li><b>3</b><span>Nhắn Zalo để xác nhận với Nam</span></li><li><b>4</b><span>Nhận link bài học qua email</span></li></ol></section>''')
    khac = ''.join(f'<a class="other {x["mau"]}" href="{x["ten"]}.html"><span>{e(x["nhan"])}</span><b>{e(x["tieu_de"])}</b></a>'
                   for x in cac if x is not k)
    return f'''<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(k["tieu_de"])} · Khoá học · hocnghenoithat.vn</title>
<meta name="description" content="{e(k["cau1"] + " " + k["cau2"])}">
<link rel="icon" type="image/png" href="../anh/favicon.png">
<link rel="apple-touch-icon" href="../anh/logo-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONT}" rel="stylesheet">
<link rel="stylesheet" href="../bai-viet/bai-viet.css">
<link rel="stylesheet" href="khoa-hoc.css">
</head>
<body>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="../index.html"><img class="brand-logo" src="../anh/logo-180.png" width="36" height="36" alt="">hocnghenoithat<span>.vn</span></a>
    <nav class="top-links" aria-label="Điều hướng">
      <a href="../sach/index.html">Sách</a>
      <a href="index.html">Khoá học</a>
      <a href="../bai-viet/index.html">Bài viết</a>
      <a href="../ve-nam/index.html">Về Nam</a>
    </nav>
  </div>
</header>
<main>
  <section class="hero {k["mau"]}">
    <div class="wrap hero-grid">
      <div>
        <a class="back" href="index.html"><span class="back-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></span>Tất cả khoá học</a>
        <span class="tag">{e(k["nhan"])}</span>
        <h1>{e(k["tieu_de"])}</h1>
        <p class="hook">{e(k["cau1"])}<span>{e(k["cau2"])}</span></p>
        {so_lieu}
        <div class="price">{k["gia"]}{gia_phu}</div>
        <div class="acts"><a class="btn btn-cta" href="{form}" target="_blank" rel="noopener">{e(dk)} ›</a><a class="btn btn-ghost" href="{ZALO}" target="_blank" rel="noopener">Hỏi Nam qua Zalo</a></div>
      </div>
      <div>{dau}</div>
    </div>
  </section>
  <div class="wrap body">
    {"".join(khoi)}
    <section class="cta-band {k["mau"]}">
      <div><b>{e(k["tieu_de"])}</b><span>{k["gia"]} đ</span></div>
      <a class="btn btn-cta" href="{form}" target="_blank" rel="noopener">{e(dk)} ›</a>
    </section>
    <section class="blk"><h2>Các khoá khác</h2><div class="others">{khac}</div></section>
  </div>
</main>
<footer class="foot"><div class="wrap foot-in"><img class="foot-logo" src="../anh/logo-180.png" width="36" height="36" alt=""><span class="foot-site">© 2026 hocnghenoithat.vn</span><span class="foot-name">Nguyễn Thành Nam</span></div></footer>
<a class="zalo-float" href="{ZALO}" target="_blank" rel="noopener" aria-label="Nhắn Zalo cho Nam"><span class="zalo-mark" aria-hidden="true">Zalo</span></a>
<script>
  document.querySelectorAll('.yt[data-id]').forEach(function(box){{
    box.querySelector('.yt-btn').addEventListener('click', function(ev){{
      ev.preventDefault();
      var f=document.createElement('iframe');
      f.src='https://www.youtube-nocookie.com/embed/'+box.dataset.id+'?autoplay=1&rel=0&playsinline=1';
      f.title=this.getAttribute('aria-label'); f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen=true;
      box.innerHTML=''; box.appendChild(f);
    }});
  }});
</script>
<script src="../bai-viet/len-dau.js" defer></script>
</body>
</html>
'''

def main():
    RA.mkdir(exist_ok=True)
    for k in KHOA:
        (RA / f'{k["ten"]}.html').write_text(trang(k, KHOA), encoding='utf-8')
    print('Đã dựng', len(KHOA), 'trang khoá học')

if __name__ == '__main__':
    main()
