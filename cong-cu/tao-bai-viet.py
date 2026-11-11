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
# 5 màu chung của cả trang (giống các khoá học video); thẻ lần lượt lấy màu để 2 thẻ cạnh nhau luôn khác màu
BANG_MAU = ['c-violet', 'c-blue', 'c-teal', 'c-plum', 'c-slate']
MAU = {}

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
<script src="{ve_goc}bai-viet/len-dau.js" defer></script>
</body>
</html>
'''

def the_bai(b, goc='', thu_tu=0):
    return (f'<a class="post-card {BANG_MAU[thu_tu % len(BANG_MAU)]}" href="{goc}{b["slug"]}.html">'
            f'<span class="post-cat">{html.escape(b["chu_de"])}</span>'
            f'<span class="post-title">{html.escape(b["tieu_de"])}</span>'
            f'<span class="post-sum">{html.escape(b["tom_tat"])}</span>'
            '</a>')

def main():
    bai = [doc(p) for p in sorted(NGUON.glob('*.txt'))]
    for i, b in enumerate(bai):
        khac = [x for x in bai if x is not b and x['chu_de'] == b['chu_de']][:2] or bai[i+1:i+3] or bai[:2]
        nd = f'''  <article class="wrap article">
    <a class="back" href="index.html"><span class="back-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></span>Tất cả bài viết</a>
    <p class="eyebrow">{html.escape(b["chu_de"])} · {b["phut"]} phút đọc</p>
    <h1>{html.escape(b["tieu_de"])}</h1>
    <p class="lede">{html.escape(b["tom_tat"])}</p>
    <button type="button" class="listen" hidden><span class="l-ico" aria-hidden="true"></span>Nghe bài viết <small>· khoảng {b["phut"]} phút</small></button>
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
    <div class="post-grid">{''.join(the_bai(x, '', k) for k, x in enumerate([x for x in khac if x is not b]))}</div>
  </article>
  <script src="nghe.js" defer></script>'''
        (RA / f'{b["slug"]}.html').write_text(khung(f'{b["tieu_de"]} · hocnghenoithat.vn', b['tom_tat'], nd, '../'), encoding='utf-8')

    nhom = []
    for b in bai:
        if b['chu_de'] not in nhom: nhom.append(b['chu_de'])
    MO_TA = {'Dự toán & báo giá': 'Làm giá, báo giá, cân đối chi phí với chủ nhà',
             'Học nghề': 'Mặt bằng, dựng hình, đi công trình, học từ người giỏi',
             'Lúc còn chập chững': 'Cho anh em mới ra trường, còn đang tìm hướng đi',
             'Tư duy nghề': 'Chuyện đi đường dài với nghề, lúc hăng say lẫn lúc chán'}
    the_cd, ds_cd = [], []
    for k, c in enumerate(nhom):
        cid = 'cd-' + str(k + 1)
        bs = [x for x in bai if x['chu_de'] == c]
        the_cd.append(f'<button type="button" class="topic {BANG_MAU[k % len(BANG_MAU)]}" aria-expanded="false" aria-controls="{cid}">'
                      f'<span class="tp-name">{html.escape(c)}</span><span class="tp-desc">{html.escape(MO_TA.get(c, ""))}</span>'
                      f'<span class="tp-count">{len(bs)} bài <span aria-hidden="true">›</span></span></button>')
        dong = ''.join(f'<li><a href="{x["slug"]}.html" title="{html.escape(x["tom_tat"])}"><b>{html.escape(x["tieu_de"])}</b></a></li>' for x in bs)
        ds_cd.append(f'<div class="topic-list" id="{cid}" hidden aria-label="{html.escape(c)}"><ul>{dong}</ul></div>')
    nd = f'''  <section class="wrap list">
    <a class="back" href="../index.html#bai-viet"><span class="back-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></span>Về trang chủ</a>
    <h1>Những chia sẻ về nghề<span>Chọn một chủ đề để xem các bài trong đó.</span></h1>
    <div class="topics">{''.join(the_cd)}</div>
    {''.join(ds_cd)}
  </section>
<script>
(function(){{
  var ts=document.querySelectorAll('.topic');
  function mo(t, cuon){{
    var dang = t.getAttribute('aria-expanded') === 'true';
    ts.forEach(function(x){{ x.setAttribute('aria-expanded','false'); document.getElementById(x.getAttribute('aria-controls')).hidden = true; }});
    if(!dang){{ t.setAttribute('aria-expanded','true'); var l=document.getElementById(t.getAttribute('aria-controls')); l.hidden=false;
      if(cuon) l.scrollIntoView({{ behavior:'smooth', block:'start' }}); try{{ history.replaceState(null,'','#'+t.getAttribute('aria-controls')); }}catch(e){{}} }}
  }}
  ts.forEach(function(t){{ t.addEventListener('click', function(){{ mo(t, true); }}); }});
  var h = location.hash.slice(1), dau = document.querySelector('.topic[aria-controls="'+h+'"]') || ts[0];
  if(dau) mo(dau, false);
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
    moi = ''.join('      ' + the_bai(b, 'bai-viet/', k) + '\n' for k, b in enumerate(chon[:3]))
    t = re.sub(r'(<!-- BAI-VIET:START -->\n).*?(<!-- BAI-VIET:END -->)', lambda m: m.group(1) + moi + m.group(2), t, flags=re.S)
    tc.write_text(t, encoding='utf-8')
    print('Đã dựng', len(bai), 'bài')

if __name__ == '__main__':
    main()
