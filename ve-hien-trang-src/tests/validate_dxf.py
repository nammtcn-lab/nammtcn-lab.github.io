"""Kiểm tra DXF bằng ezdxf: đọc chuẩn (không recover), audit, đếm thực thể theo layer, kiểm tra tọa độ, kết xuất PNG."""
import sys, glob, ezdxf
from ezdxf.addons.drawing import matplotlib as mpl_draw

ok = True
for path in sorted(glob.glob('tests/out/*.dxf')):
    doc = ezdxf.readfile(path)
    auditor = doc.audit()
    msp = doc.modelspace()
    counts = {}
    for e in msp:
        counts[(e.dxftype(), e.dxf.layer)] = counts.get((e.dxftype(), e.dxf.layer), 0) + 1
    print(f'== {path}: version={doc.dxfversion} insunits={doc.header.get("$INSUNITS")} errors={len(auditor.errors)} fixes={len(auditor.fixes)}')
    for err in auditor.errors: print('   ERR', err.message)
    for k in sorted(counts): print('  ', k, counts[k])
    if auditor.has_errors or doc.header.get('$INSUNITS') != 4: ok = False
    mpl_draw.qsave(msp, path.replace('.dxf', '.png'), bg='#FFFFFF', dpi=150)

# kiểm tra hình học P1 (4000 x 5000, tường 140)
doc = ezdxf.readfile('tests/out/p1.dxf')
msp = doc.modelspace()
inner = [e for e in msp.query('LWPOLYLINE[layer=="WALL_INNER"]')]
outer = [e for e in msp.query('LWPOLYLINE[layer=="WALL_OUTER"]')]
assert len(inner) == 1 and inner[0].closed, 'P1: phải có 1 polyline biên trong khép kín'
pts = [tuple(round(v, 3) for v in p[:2]) for p in inner[0].get_points()]
assert pts == [(0, 0), (4000, 0), (4000, 5000), (0, 5000)], pts
opts = [tuple(round(v, 3) for v in p[:2]) for p in outer[0].get_points()]
assert opts == [(-140, -140), (4140, -140), (4140, 5140), (-140, 5140)], opts
print('P1 geometry OK')
sys.exit(0 if ok else 1)
