# FlashGuard

浏览器端实时光敏性闪烁检测与削弱库(TypeScript,零依赖)。
判定标准基于 **WCAG 2.3.1**(Three Flashes or Below Threshold)与
**Harding FPA / ITU-R BT.1702 / Ofcom** 广播测试标准。

## 检测原理

1. 每帧把画面降采样到 32×32 网格,计算每格的 WCAG 相对亮度和饱和红强度;
2. 帧间比较:亮度变化 ≥ 0.1(且较暗状态 < 0.8)、或饱和红变化 ≥ 0.2,
   且变化区域 ≥ 画面 25%,记为一次"跳变";
3. 一对反向跳变 = 一次闪烁;任意 1 秒窗口内 ≥ 3 次闪烁即违规。

面积阈值和"较暗状态"条件使正常影视剪辑、游戏画面、字幕滚动、
小图标动画不会误触发(见 `test/detector.test.mjs` 的 8 组场景验证)。

## 分级削弱

| 等级 | 触发条件 | 处理 |
|---|---|---|
| 1 | 闪烁接近上限(≥60%) | `contrast(0.75) brightness(0.92)`,几乎无感 |
| 2 | 达到违规线 | `contrast(0.5) brightness(0.8) saturate(0.5)`,内容仍可观看 |
| 3 | 违规持续 1.5s | 暂停播放 + 遮挡层,用户点击"仍要查看"才放行(此后维持 1 级) |

CSS `contrast(k)` 以中灰为轴压缩亮度,危险跳变幅度近似乘以 k,
0.1 的跳变在 0.5 对比度下只剩约 0.05,低于安全阈值。
等级释放有滞回(干净 3 秒降一级),防止防护本身造成画面抖动。

## 用法

```ts
import { FlashGuard, MediaProtector, analyzeAnimatedImage } from 'flash-guard';

// 方式一:整页自动防护(含后续动态插入的评论/私信内容)
const guard = FlashGuard.init();
// 单个元素退出:<video data-flash-guard="off">

// 方式二:保护单个元素
const protector = new MediaProtector(videoEl, {
  onLevelChange: (level, analysis) => { /* 上报/提示 */ },
});
protector.start();

// 方式三:GIF 播出前预检(评论区列表推荐;需 ImageDecoder,Chrome/Edge 94+)
const report = await analyzeAnimatedImage(await (await fetch(url)).blob());
if (report.violation) {
  // 渲染占位图 + "此动图可能含有害闪烁"提示,不自动播放
}
```

## 集成建议

- **跨域媒体必须加 CORS**(`<video crossorigin="anonymous">` + 服务端
  `Access-Control-Allow-Origin`),否则 canvas 被污染无法读像素,检测会静默跳过。
- **评论/私信场景优先用方式三**:GIF 在渲染前完成判定,做到真正的"播放到屏幕前";
  实时检测(方式一/二)最多露出 1–2 帧(16–33ms)即被压制。
- **服务端预扫**:检测器(`detector.ts`)不依赖 DOM,可在 Node 里配合
  ffmpeg 抽帧对上传内容离线预扫、打标,客户端只做兜底。
- **React Native / App**:复用 `FlashDetector` + `luminance.ts`(纯逻辑),
  帧数据从视频解码层或截图 API 获取,削弱用降低透明度/叠加遮罩实现。
- 检测上限受屏幕刷新率约束(60Hz 屏幕可测到约 30Hz 闪烁),
  已覆盖最危险的 3–30Hz 区间。

## 已知限制

- WebGL 画布需 `preserveDrawingBuffer: true` 才能被采样;
- CSS 动画/SVG SMIL 产生的闪烁不在媒体采样范围内,
  可配合 `prefers-reduced-motion` 媒体查询全局降速;
- 检测是统计性的,不能替代医疗建议;3 级遮挡的知情放行是必要的人因设计,
  请勿移除。

## 开发

```bash
npm install
npm test        # 构建 + 运行 8 组标准场景验证
npm run build   # 输出 dist/
```

演示:`demo/index.html`(通过任意静态服务器打开,可生成受控闪烁验证防护效果;
页面含安全警告,请勿对易感人群演示)。
