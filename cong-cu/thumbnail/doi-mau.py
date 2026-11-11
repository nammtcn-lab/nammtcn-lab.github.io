"""Đổi ảnh thumbnail lấy từ Canva sang tông tím–hồng của web.
Giữ nguyên người (tách bằng rembg), phần nền + chữ ánh xạ theo độ sáng qua dải màu tím → hồng → trắng.
Chạy: python3 cong-cu/thumbnail/doi-mau.py  (ảnh gốc ở cong-cu/thumbnail/canva-goc, ra anh/kh-*.jpg)"""
import glob, os
import numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session
GOC = os.path.join(os.path.dirname(__file__), 'canva-goc')
RA = os.path.join(os.path.dirname(__file__), '..', '..', 'anh')
# điểm mốc dải màu: (độ sáng, màu)
MOC = [(0.00, (22, 12, 64)), (0.30, (74, 54, 216)), (0.55, (139, 79, 214)), (0.78, (216, 85, 155)), (1.00, (255, 255, 255))]
def ban_do(l):
    out = np.zeros(l.shape + (3,))
    for (a, ca), (b, cb) in zip(MOC, MOC[1:]):
        m = (l >= a) & (l <= b); t = ((l - a) / (b - a))[m][:, None]
        out[m] = np.array(ca) * (1 - t) + np.array(cb) * t
    return out
s = new_session('isnet-general-use')
for f in sorted(glob.glob(os.path.join(GOC, '*.jpg'))):
    im = Image.open(f).convert('RGB')
    a = np.asarray(remove(im, session=s, only_mask=True).filter(ImageFilter.GaussianBlur(1.5))).astype(float)[..., None] / 255
    # chỉ giữ mảng chạm mép dưới ảnh (người); chữ màu rời rạc thì đổi màu như nền
    from scipy import ndimage
    lab, n = ndimage.label(a[..., 0] > 0.5)
    giu = set(lab[-1][lab[-1] > 0].tolist())
    a = a * np.isin(lab, list(giu))[..., None]
    x = np.asarray(im).astype(float) / 255
    l = 0.299 * x[..., 0] + 0.587 * x[..., 1] + 0.114 * x[..., 2]
    l = np.clip((l - 0.08) / 0.84, 0, 1)
    nen = ban_do(l)
    out = x * 255 * a + nen * (1 - a)
    Image.fromarray(out.clip(0, 255).astype('uint8')).save(os.path.join(RA, os.path.basename(f)), quality=84)
    print(os.path.basename(f))
