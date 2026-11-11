#!/usr/bin/env python3
"""Dựng các trang Bài viết từ file chữ trong bai-viet/nguon/.

Mỗi file nguồn có dạng:
    tieu-de: Tên bài
    chu-de: Nhóm chủ đề
    tom-tat: Một câu giới thiệu ngắn
    ---
    Mỗi dòng là một đoạn văn.
    - Dòng bắt đầu bằng gạch đầu dòng sẽ thành danh sách.

Tên file: số thứ tự + tên trang, ví dụ 07-bao-gia.txt -> bai-viet/bao-gia.html
Chạy:  python3 cong-cu/tao-bai-viet.py
"""
import html, pathlib, re

GOC = pathlib.Path(__file__).resolve().parent.parent
NGUON = GOC / 'bai-viet' / 'nguon'
RA = GOC / 'bai-viet'
FONT = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap&subset=vietnamese'
ZALO = 'https://zalo.me/0988504858'
MAU = {'Dự toán & báo giá': 'c-teal', 'Học nghề': 'c-blue', 'Mới ra trường': 'c-violet'}

def doc(p):
    dau, than = p.read_text(encoding='utf-8').split('\n---\n', 1)
    m = dict(l.split(': ', 1) for l in dau.strip().split('\n'))
    slug = re.sub(r'^\d+-', '', p.stem)
    dong = [l.strip() for l in than.split('\n') if l.strip()]
    return {'slug': slug, 'tieu_de': m['tieu-de'], 'chu_de': m['chu-de'], 'tom_tat': m['tom-tat'],
            'dong': dong, 'phut': max(1, round(sum(len(l.split()) for l in dong) / 220))}

def than_bai(dong):
    ra, ds = [], []
    def dong_ds():
        if ds:
            ra.append('<ul>' + ''.join(f'<li>{x}</li>' for x in ds) + '</ul>'); ds.clear()
    for l in dong:
        e = html.escape(l, quote=False)
        if l.startswith('- '):
            ds.append(e[2:]); continue
        dong_ds(); ra.append(f'<p>{e}</p>')
    dong_ds()
    return '\n      '.join(ra)

def khung(tieu_de, mo_ta, noi_dung, ve_goc):
    return f'''<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(tieu_de)}</title>
<meta name="description" content="{html.escape(mo_ta)}">
<link rel="icon" type="image/png" href="{ve_goc}anh/favicon.png">
<link rel="apple-touch-icon" href="{ve_goc}anh/logo-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{FONT}" rel="stylesheet">
<link rel="stylesheet" href="{ve_goc}bai-viet/bai-viet.css">
</head>
<body>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="{ve_goc}index.html"><img class="brand-logo" src="{ve_goc}anh/logo-180.png" width="36" height="36" alt="">hocnghenoithat<span>.vn</span></a>
    <nav class="top-links" aria-label="Điều hướng">
      <a href="{ve_goc}index.html#sach">Sách</a>
      <a href="{ve_goc}index.html#khoa-hoc">Khoá học</a>
      <a href="{ve_goc}bai-viet/index.html">Bài viết</a>
    </nav>
  </div>
</header>
<main>
{noi_dung}
</main>
<footer class="foot"><div class="wrap">© 2026 hocnghenoithat.vn · Nguyễn Thành Nam</div></footer>
<a class="zalo-float" href="{ZALO}" target="_blank" rel="noopener" aria-label="Nhắn Zalo cho Nam"><span class="zalo-dot" aria-hidden="true"></span>Zalo</a>
</body>
</html>
'''

def the_bai(b, goc=''):
    return (f'<a class="post-card {MAU.get(b["chu_de"], "c-blue")}" href="{goc}{b["slug"]}.html">'
            f'<span class="post-cat">{html.escape(b["chu_de"])}</span>'
            f'<span class="post-title">{html.escape(b["tieu_de"])}</span>'
            f'<span class="post-sum">{html.escape(b["tom_tat"])}</span>'
            f'<span class="post-more">Đọc bài · {b["phut"]} phút <span aria-hidden="true">›</span></span></a>')

def main():
    bai = [doc(p) for p in sorted(NGUON.glob('*.txt'))]
    for i, b in enumerate(bai):
        khac = [x for x in bai if x is not b and x['chu_de'] == b['chu_de']][:2] or bai[i+1:i+3] or bai[:2]
        nd = f'''  <article class="wrap article">
    <a class="back" href="index.html">‹ Tất cả bài viết</a>
    <p class="eyebrow">{html.escape(b["chu_de"])} · {b["phut"]} phút đọc</p>
    <h1>{html.escape(b["tieu_de"])}</h1>
    <p class="lede">{html.escape(b["tom_tat"])}</p>
    <div class="prose">
      {than_bai(b["dong"])}
    </div>
    <p class="sign">Nam · hocnghenoithat</p>
    <aside class="cta">
      <p>Đọc thấy hợp thì anh em xem thêm sách và các khoá học của Nam nhé.</p>
      <a class="btn" href="../index.html#sach">Xem sách</a>
      <a class="btn btn-ghost" href="../index.html#khoa-hoc">Xem khoá học</a>
    </aside>
    <h2 class="more-h">Đọc tiếp</h2>
    <div class="post-grid">{''.join(the_bai(x) for x in khac if x is not b)}</div>
  </article>'''
        (RA / f'{b["slug"]}.html').write_text(khung(f'{b["tieu_de"]} · hocnghenoithat.vn', b['tom_tat'], nd, '../'), encoding='utf-8')

    nhom = []
    for b in bai:
        if b['chu_de'] not in nhom: nhom.append(b['chu_de'])
    loc = ''.join(f'<button type="button" data-cat="{html.escape(c)}">{html.escape(c)}</button>' for c in nhom)
    nd = f'''  <section class="wrap list">
    <p class="eyebrow">Bài viết</p>
    <h1>Tâm tư với nghề.<span>Từ những trải nghiệm thực tế của Nam.</span></h1>
    <div class="filter" role="group" aria-label="Lọc theo chủ đề"><button type="button" data-cat="" aria-pressed="true">Tất cả</button>{loc}</div>
    <div class="post-grid">{''.join(the_bai(b) for b in bai)}</div>
  </section>
<script>
(function(){{
  var bs=document.querySelectorAll('.filter button'), cs=document.querySelectorAll('.post-grid .post-card');
  bs.forEach(function(b){{ b.addEventListener('click', function(){{
    bs.forEach(function(x){{ x.setAttribute('aria-pressed', x===b ? 'true' : 'false'); }});
    cs.forEach(function(c){{ c.hidden = !!b.dataset.cat && c.querySelector('.post-cat').textContent !== b.dataset.cat; }});
  }}); }});
}})();
</script>'''
    nd = nd.replace('<span class="post-cat">', '<span class="post-cat">')
    (RA / 'index.html').write_text(khung('Bài viết · hocnghenoithat.vn', 'Chuyện nghề nội thất Nam viết cho anh em: dự toán, báo giá, học nghề, mới ra trường.', nd, '../'), encoding='utf-8')
    # 3 bài mới lên trang chủ, giữa hai dấu BAI-VIET
    tc = GOC / 'index.html'
    t = tc.read_text(encoding='utf-8')
    chon, da = [], set()
    for b in bai[::-1]:  # ưu tiên mỗi chủ đề một bài mới nhất cho đa dạng màu
        if b['chu_de'] not in da: chon.append(b); da.add(b['chu_de'])
    chon += [b for b in bai[::-1] if b not in chon]
    moi = ''.join('      ' + the_bai(b, 'bai-viet/') + '\n' for b in chon[:3])
    t = re.sub(r'(<!-- BAI-VIET:START -->\n).*?(<!-- BAI-VIET:END -->)', lambda m: m.group(1) + moi + m.group(2), t, flags=re.S)
    tc.write_text(t, encoding='utf-8')
    print('Đã dựng', len(bai), 'bài')

if __name__ == '__main__':
    main()
