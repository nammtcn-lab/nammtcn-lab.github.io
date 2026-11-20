import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { sampleProject } from '../src/model/sample';
import { buildDrawing } from '../src/drawing/buildDrawing';
import { writeDxf } from '../src/export/dxf';

/** Ghi file DXF mẫu ra tests/out để kiểm tra bằng phần mềm CAD (tests/validate_dxf.py) */
it('ghi DXF mẫu', () => {
  mkdirSync('tests/out', { recursive: true });
  const p = sampleProject();
  p.floors.forEach((f, i) => writeFileSync(`tests/out/tang-${i + 1}.dxf`, writeDxf(buildDrawing(f.rooms).prims)));
  writeFileSync('tests/out/p1.dxf', writeDxf(buildDrawing([p.floors[0].rooms[0]]).prims));
});
