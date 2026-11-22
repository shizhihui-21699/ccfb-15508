// 检测器验证:用合成帧序列模拟典型场景,验证判定是否符合 WCAG/Harding 标准。
// 运行:npm test
import { FlashDetector } from '../dist/detector.js';

const N = 32 * 32; // 与默认采样网格一致

function frame(value, count = N) {
  return Float32Array.from({ length: count }, () => value);
}

/** 以 fps 帧率、hz 频率在全屏黑/白(或指定两值)之间交替,喂给检测器 */
function runStrobe({ hz, fps = 60, seconds = 2, lo = 0, hi = 1, cells = N, red = false }) {
  const d = new FlashDetector();
  let maxFlashes = 0;
  let violation = null;
  const frames = Math.floor(fps * seconds);
  for (let f = 0; f < frames; f++) {
    const t = (f / fps) * 1000;
    const phase = Math.floor(t / (1000 / hz)) % 2;
    const v = phase === 0 ? hi : lo;
    // 前 cells 格闪烁,其余格保持恒定中灰(模拟局部闪烁)
    const lum = frame(0.5);
    lum.fill(v, 0, cells);
    const redArr = red ? frame(v) : frame(0);
    const a = d.addFrame(lum, redArr, t);
    maxFlashes = Math.max(maxFlashes, a.luminanceFlashesPerSecond, a.redFlashesPerSecond);
    if (a.violation) violation = a.violation;
  }
  return { maxFlashes, violation };
}

let failures = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures++;
}

// 1. 10Hz 全屏黑白频闪 → 必须违规(典型攻击样本)
{
  const r = runStrobe({ hz: 10 });
  check('10Hz 全屏频闪 → 违规', r.violation === 'luminance', `max=${r.maxFlashes}/s`);
}

// 2. 2Hz 全屏闪烁 → 低于每秒 3 次,不违规
{
  const r = runStrobe({ hz: 2 });
  check('2Hz 全屏闪烁 → 不违规', r.violation === null, `max=${r.maxFlashes}/s`);
}

// 3. 10Hz 但只占 10% 面积(局部动效/字幕)→ 不违规
{
  const r = runStrobe({ hz: 10, cells: Math.floor(N * 0.1) });
  check('10Hz 小面积(10%)→ 不违规', r.violation === null);
}

// 4. 小幅亮度抖动(0.05,模拟正常视频噪声/压缩伪影)→ 不违规
{
  const r = runStrobe({ hz: 10, lo: 0.5, hi: 0.55 });
  check('10Hz 小幅抖动(Δ0.05)→ 不违规', r.violation === null);
}

// 5. 亮到更亮(0.85↔1.0,较暗状态 ≥0.8)→ 不违规
{
  const r = runStrobe({ hz: 10, lo: 0.85, hi: 1.0 });
  check('10Hz 高亮区间闪烁 → 不违规', r.violation === null);
}

// 6. 10Hz 饱和红/黑交替 → 红色违规
{
  const d = new FlashDetector();
  let violation = null;
  for (let f = 0; f < 120; f++) {
    const t = (f / 60) * 1000;
    const v = Math.floor(t / 100) % 2 === 0 ? 1 : 0;
    const a = d.addFrame(frame(0), frame(v), t);
    if (a.violation) violation = a.violation;
  }
  check('10Hz 饱和红频闪 → red 违规', violation === 'red');
}

// 7. 正常剪辑模拟:每秒一次全屏硬切(方向不反转)→ 不构成闪烁对,不违规
{
  const d = new FlashDetector();
  let violation = null;
  for (let f = 0; f < 180; f++) {
    const t = (f / 60) * 1000;
    const scene = Math.floor(t / 1000) % 3;
    const a = d.addFrame(frame([0.1, 0.5, 0.9][scene]), frame(0), t);
    if (a.violation) violation = a.violation;
  }
  check('每秒硬切场景 → 不违规', violation === null);
}

// 8. 恰好在界限:3Hz 闪烁对(3 对/秒)→ 违规
{
  const r = runStrobe({ hz: 6 }); // 6 次跳变/秒 = 3 对
  check('3 对/秒 → 达到违规线', r.violation === 'luminance', `max=${r.maxFlashes}/s`);
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
