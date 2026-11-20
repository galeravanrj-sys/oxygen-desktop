import assert from 'node:assert/strict';
import { fitWindow, canSplitWindows } from '../src/windowGeometry.ts';

let checked = 0;
for (const width of [320, 375, 414, 650, 651, 672, 768, 1024, 1280, 1440, 1920]) {
  for (const height of [120, 240, 260, 500, 785]) {
    for (const mode of ['normal', 'maximized', 'left', 'right', 'fullscreen']) {
      for (const mobileFloating of [false, true]) {
        const workspace = { width, height };
        const mobile = width <= 650;
        const result = fitWindow({ x: 1700, y: 900, width: 960, height: 780, mode }, workspace, mobile, mobile && !mobileFloating);
        assert.ok(result.width > 0 && result.height > 0);
        assert.ok(result.x >= 0 && result.y >= 0);
        assert.ok(result.x + result.width <= width + 0.001);
        assert.ok(result.y + result.height <= height + 0.001);
        checked++;
      }
    }
  }
}
const workspace = { width: 768, height: 500 };
const base = { x: 0, y: 0, width: 760, height: 510 };
const left = fitWindow({ ...base, mode: 'left' }, workspace, false);
const right = fitWindow({ ...base, mode: 'right' }, workspace, false);
assert.ok(left.width >= 320 && right.width >= 320);
assert.ok(left.x + left.width < right.x);
assert.equal(canSplitWindows({ width: 650, height: 500 }), false);
assert.equal(canSplitWindows({ width: 768, height: 240 }), false);
assert.equal(canSplitWindows(workspace), true);
assert.ok(Number.isFinite(fitWindow({ ...base, x: NaN, width: Infinity, mode: 'normal' }, workspace, false).x));
console.log(`Window geometry: ${checked} viewport/mode combinations and split-layout checks passed.`);
