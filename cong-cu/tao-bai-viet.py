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
import html, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from icon import icon

GOC = pathlib.Path(__file__).resolve().parent.parent
NGUON = GOC / 'bai-viet' / 'nguon'
RA = GOC / 'bai-viet'
FONT = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap&subset=vietnamese'
ZALO = 'https://zalo.me/0988504858'
# 5 màu chung của cả trang (giống các khoá học video); thẻ lần lượt lấy màu để 2 thẻ cạnh nhau luôn khác màu
BANG_MAU = ['c-violet', 'c-blue', 'c-teal', 'c-plum', 'c-slate']
MAU = {}
# Thứ tự các nhóm chủ đề trên trang
THU_TU = ['Lúc còn chập chững', 'Học nghề', 'Tư duy nghề', 'Làm ăn với khách']

def doc(p):
    dau, than = p.read_text(encoding='utf-8').split('\n---\n', 1)
    m = dict(l.split(': ', 1) for l in dau.strip().split('\n'))
    slug = re.sub(r'^\d+-', '', p.stem)
    dong = [l.strip() for l in than.split('\n') if l.strip()]
    return {'slug': slug, 'tieu_de': m['tieu-de'], 'chu_de': m['chu-de'], 'tom_tat': m['tom-tat'],
            'dong': dong, 'phut': max(1, round(sum(len(l.split()) for l in dong) / 220))}

def chu_hoa(w):
    c = re.sub(r"[^\w]", "", w)
    return len(c) >= 2 and c.isupper() and not c.isdigit()
def la_cau_nhan(l):
    """Dòng ngắn, gần như viết hoa toàn bộ: câu nhấn của Nam."""
    ws = [w for w in l.split() if re.sub(r"[^\w]", "", w)]
    return len(l) <= 90 and len(ws) >= 2 and sum(chu_hoa(w) for w in ws) >= max(2, len(ws) * 0.8)
def nhan_trong_cau(e):
    """Cụm từ 2 chữ viết hoa trở lên đứng liền nhau thì in đậm."""
    ws = e.split(' '); ra = []; i = 0
    while i < len(ws):
        j = i
        while j < len(ws) and chu_hoa(ws[j]): j += 1
        if j - i >= 2 or (j - i == 1 and len(re.sub(r"[^\w]", "", ws[i])) >= 4 and not re.fullmatch(r"[\W]*(AI|CAD|PDF|SU|MAX|CNC|ABF|OK|OT|TP|HN|VN|NAM|3D|2D)[\W]*", ws[i])):
            seg = ws[i:j]; pre = re.match(r"^\W*", seg[0]).group(0); post = re.search(r"\W*$", seg[-1]).group(0)
            seg[0] = seg[0][len(pre):]; seg[-1] = seg[-1][:len(seg[-1]) - len(post)] if post else seg[-1]
            ra.append(pre + '<strong>' + ' '.join(seg) + '</strong>' + post); i = j
        elif j > i: ra.extend(ws[i:j]); i = j
        else: ra.append(ws[i]); i += 1
    return ' '.join(ra)

def than_bai(dong):
    ra, ds = [], []
    def dong_ds():
        if ds:
            ra.append('<ul>' + ''.join(f'<li>{x}</li>' for x in ds) + '</ul>'); ds.clear()
    for l in dong:
        e = html.escape(l, quote=False)
        if l.startswith('- '):
            ds.append(nhan_trong_cau(e[2:])); continue
        dong_ds()
        m = re.match(r'^(\d{1,2})[.)]\s*(.+)$', l)
        if m:
            so, noi = m.group(1), m.group(2)
            k = re.search(r'[.:]\s|\s[-–]\s|\(', noi)
            if la_cau_nhan(noi) or not k or k.start() > 70:
                dau, sau = (noi, '') if (la_cau_nhan(noi) or len(noi) <= 70) else ('', noi)
            else:
                dau, sau = noi[:k.start()], noi[k.start():]
            dau_h = f'<strong>{html.escape(dau, quote=False)}</strong>' if dau else ''
            ra.append(f'<p class="so"><span class="so-n">{so}</span><span>{dau_h}{nhan_trong_cau(html.escape(sau, quote=False))}</span></p>')
            continue
        if la_cau_nhan(l): ra.append(f'<p class="nhan"><strong>{e}</strong></p>')
        else: ra.append(f'<p>{nhan_trong_cau(e)}</p>')
    dong_ds()
    # số thứ tự: cả dãy chạy chung một dải màu tím → hồng (như 2 nút trên đầu trang)
    tong = sum(1 for x in ra if 'class="so-n"' in x); i = 0
    for k, x in enumerate(ra):
        if 'class="so-n"' in x:
            ra[k] = x.replace('class="so-n"', f'class="so-n" style="--i:{i};--n:{max(tong, 2)}"', 1); i += 1
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
      <a href="{ve_goc}sach/index.html">Sách</a>
      <a href="{ve_goc}khoa-hoc/index.html">Khoá học</a>
      <a href="{ve_goc}bai-viet/index.html">Bài viết</a>
      <a href="{ve_goc}ve-nam/index.html">Về Nam</a>
    </nav>
  </div>
</header>
<main>
{noi_dung}
</main>
<footer class="foot"><div class="wrap foot-in"><ul class="social foot-social">      <li><a href="https://www.facebook.com/nguyen.t.nam.5437/" target="_blank" rel="noopener" aria-label="Facebook: nguyen.t.nam.5437"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#1877F2"/><path fill="#fff" d="M22.2 32V21.6h3.5l.5-4.1h-4v-2.6c0-1.2.3-2 2-2h2.1V9.3c-.4 0-1.6-.2-3.1-.2-3.1 0-5.2 1.9-5.2 5.3v3.1h-3.5v4.1H18V32z"/></svg></a></li>      <li><a href="https://www.youtube.com/@nam8677" target="_blank" rel="noopener" aria-label="YouTube: @nam8677"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#FF0000"/><path fill="#fff" d="M16 13.5v13l11-6.5z"/></svg></a></li>      <li><a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=nammtcn@gmail.com" target="_blank" rel="noopener" aria-label="Gửi email cho Nam: nammtcn@gmail.com"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19.25" fill="#fff" stroke="#666" stroke-width="1.5"/><path fill="#4285F4" d="M10 14.6v11.2c0 .9.7 1.6 1.6 1.6h3.2v-9z"/><path fill="#34A853" d="M25.2 27.4h3.2c.9 0 1.6-.7 1.6-1.6V14.6l-4.8 3.8z"/><path fill="#FBBC04" d="M25.2 12.6v5.8l4.8-3.8v-1.4c0-1.6-1.8-2.5-3.1-1.6z"/><path fill="#EA4335" d="M14.8 18.4v-5.8L20 16.6l5.2-4v5.8L20 22.4z"/><path fill="#C5221F" d="M10 13.2v1.4l4.8 3.8v-5.8l-1.7-1.3c-1.3-1-3.1 0-3.1 1.9z"/></svg></a></li>    </ul><span class="foot-site">© 2026 hocnghenoithat.vn</span><span class="foot-name">Nguyễn Thành Nam</span></div></footer>
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
    nhom_cd = [c for c in THU_TU if any(x['chu_de'] == c for x in bai)]
    for x in bai:
        if x['chu_de'] not in nhom_cd: nhom_cd.append(x['chu_de'])
    for i, b in enumerate(bai):
        cd_id = 'cd-' + str(nhom_cd.index(b['chu_de']) + 1)
        cung = [x for x in bai if x is not b and x['chu_de'] == b['chu_de']]
        cung = cung[cung.index(bai[i+1]) if (i+1 < len(bai) and bai[i+1] in cung) else 0:] + cung
        khac = []
        for x in cung + [x for x in bai[i+1:] + bai[:i] if x is not b]:
            if x not in khac and x is not b: khac.append(x)
        khac = khac[:4]
        nd = f'''  <article class="wrap article">
    <a class="back" href="index.html?cd={cd_id}"><span class="back-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></span>Bài viết · {html.escape(b["chu_de"])}</a>
    <h1>{html.escape(b["tieu_de"])}</h1>
    <p class="lede">{html.escape(b["tom_tat"])}</p>
    <div class="listen-row"><img class="author" src="../anh/chan-dung.jpg" width="933" height="1400" alt="Nguyễn Thành Nam"><button type="button" class="listen" hidden><span class="l-ico" aria-hidden="true"></span>Nghe bài viết <small>· khoảng {b["phut"]} phút</small></button></div>
    <div class="prose">
      {than_bai(b["dong"])}
    </div>
    <p class="sign"><a href="https://www.facebook.com/nguyen.t.nam.5437/" target="_blank" rel="noopener" aria-label="Nam · hocnghenoithat, xem thêm bài của Nam trên Facebook"><span class="sign-fb" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#1877F2"/><path fill="#fff" d="M22.2 32V21.6h3.5l.5-4.1h-4v-2.6c0-1.2.3-2 2-2h2.1V9.3c-.4 0-1.6-.2-3.1-.2-3.1 0-5.2 1.9-5.2 5.3v3.1h-3.5v4.1H18V32z"/></svg></span>Nam · hocnghenoithat <span class="sign-go" aria-hidden="true">›</span></a></p>
    <aside class="cta">
      <p>Đọc thấy hợp thì anh em xem thêm sách và các khoá học của Nam nhé.</p>
      <a class="btn btn-soft" href="../sach/index.html">Xem sách</a>
      <a class="btn btn-soft" href="../khoa-hoc/index.html">Xem khoá học</a>
    </aside>
    <h2 class="more-h">Đọc tiếp</h2>
    <ul class="read-next">{''.join(f'<li><a href="{x["slug"]}.html"><b>{html.escape(x["tieu_de"])}</b><span>{html.escape(x["chu_de"])}</span></a></li>' for x in khac)}</ul>
  </article>
  <script src="nghe.js" defer></script>'''
        (RA / f'{b["slug"]}.html').write_text(khung(f'{b["tieu_de"]} · hocnghenoithat.vn', b['tom_tat'], nd, '../'), encoding='utf-8')

    nhom = [c for c in THU_TU if any(b['chu_de'] == c for b in bai)]
    for b in bai:
        if b['chu_de'] not in nhom: nhom.append(b['chu_de'])
    MO_TA = {'Làm ăn với khách': 'Làm giá, báo giá, cân đối chi phí với chủ nhà',
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
    <h1>Những chia sẻ về nghề</h1>
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
      if(cuon) l.scrollIntoView({{ behavior:'smooth', block:'start' }}); if(cuon){{ try{{ history.replaceState(null,'','#'+t.getAttribute('aria-controls')); }}catch(e){{}} }} }}
  }}
  ts.forEach(function(t){{ t.addEventListener('click', function(){{ mo(t, true); }}); }});
  var h = location.hash.slice(1) || (location.search.match(/[?&]cd=([\\w-]+)/)||[])[1], dau = document.querySelector('.topic[aria-controls="'+h+'"]') || ts[0];
  if(dau) mo(dau, false);
}})();
</script>'''
    nd = nd.replace('<span class="post-cat">', '<span class="post-cat">')
    (RA / 'index.html').write_text(khung('Bài viết · hocnghenoithat.vn', 'Chuyện nghề nội thất Nam viết cho anh em: dự toán, báo giá, học nghề, mới ra trường.', nd, '../'), encoding='utf-8')
    # 3 bài mới lên trang chủ, giữa hai dấu BAI-VIET
    tc = GOC / 'index.html'
    t = tc.read_text(encoding='utf-8')
    # Trang chủ: một nút lớn gom các chủ đề, bấm vào sang danh sách bài
    nhom_tc = [c for c in THU_TU if any(x['chu_de'] == c for x in bai)]
    ICO = {'Lúc còn chập chững': 'mam', 'Học nghề': 'thuoc', 'Tư duy nghề': 'den', 'Làm ăn với khách': 'khach'}
    MUI = '<span class="go-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>'
    moi = ''.join(f'        <li>{icon(ICO.get(c, "sach"))}'
                  f'<a href="bai-viet/index.html#cd-{k+1}">{html.escape(c)}</a>{MUI}</li>\n'
                  for k, c in enumerate(nhom_tc))
    t = re.sub(r'(<!-- BAI-VIET:START -->\n).*?(<!-- BAI-VIET:END -->)', lambda m: m.group(1) + moi + m.group(2), t, flags=re.S)
    tc.write_text(t, encoding='utf-8')
    print('Đã dựng', len(bai), 'bài')

if __name__ == '__main__':
    main()
