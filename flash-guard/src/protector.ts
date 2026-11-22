import {
  FlashDetector,
  type FlashDetectorOptions,
  type FrameAnalysis,
} from './detector.js';
import { FrameSampler } from './sampler.js';
import {
  MitigationController,
  type MitigationLevel,
  type MitigationOptions,
} from './mitigation.js';

export interface ProtectorOptions extends Partial<FlashDetectorOptions> {
  /** 降采样网格宽,默认 32 */
  sampleWidth: number;
  /** 降采样网格高,默认 32 */
  sampleHeight: number;
  /** 持续违规多少毫秒后升到 3 级(暂停+遮挡),默认 1500 */
  severeAfterMs: number;
  /** 连续干净多少毫秒后降一级,默认 3000(滞回,防止防护本身抖动) */
  releaseAfterMs: number;
  mitigation: Partial<MitigationOptions>;
  /** 等级或分析结果变化回调,可用于上报/提示 */
  onLevelChange?: (level: MitigationLevel, analysis: FrameAnalysis) => void;
}

export const DEFAULT_PROTECTOR_OPTIONS: Omit<ProtectorOptions, 'onLevelChange'> = {
  sampleWidth: 32,
  sampleHeight: 32,
  severeAfterMs: 1500,
  releaseAfterMs: 3000,
  mitigation: {},
};

type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * 媒体保护器:绑定一个 video / img(GIF)/ canvas,
 * 每帧采样 → 检测 → 按等级削弱。检测与渲染同帧进行,
 * 违规内容最多露出 1-2 帧(约 16-33ms)即被压制。
 */
export class MediaProtector {
  private el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  private opts: typeof DEFAULT_PROTECTOR_OPTIONS;
  private detector: FlashDetector;
  private sampler: FrameSampler;
  private mitigation: MitigationController;
  private onLevelChange?: (level: MitigationLevel, analysis: FrameAnalysis) => void;

  private running = false;
  private rafHandle = 0;
  private rvfcHandle = 0;
  private level: MitigationLevel = 0;
  private violationSince = 0;
  private cleanSince = 0;
  private allowedByUser = false;

  constructor(
    el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    options: Partial<ProtectorOptions> = {},
  ) {
    this.el = el;
    const { mitigation, onLevelChange, ...detectorAndTuning } = options;
    this.opts = { ...DEFAULT_PROTECTOR_OPTIONS, ...detectorAndTuning };
    this.onLevelChange = onLevelChange;
    this.detector = new FlashDetector(options);
    this.sampler = new FrameSampler(this.opts.sampleWidth, this.opts.sampleHeight);
    this.mitigation = new MitigationController(el, mitigation, () => {
      // 用户选择"仍要查看":保持在 1 级基础防护,不再升级
      this.allowedByUser = true;
      this.setLevel(1, this.lastAnalysis);
    });
  }

  private lastAnalysis: FrameAnalysis | null = null;

  start(): void {
    if (this.running) return;
    this.running = true;
    const video = this.el as RVFCVideo;
    if (this.el instanceof HTMLVideoElement && video.requestVideoFrameCallback) {
      // 与视频帧严格同步,不漏帧也不多采样
      const loop = (now: number) => {
        if (!this.running) return;
        this.tick(now);
        this.rvfcHandle = video.requestVideoFrameCallback!(loop);
      };
      this.rvfcHandle = video.requestVideoFrameCallback(loop);
    } else {
      // GIF 图 / canvas / 不支持 rvfc 的浏览器:跟随屏幕刷新率采样
      const loop = (now: number) => {
        if (!this.running) return;
        this.tick(now);
        this.rafHandle = requestAnimationFrame(loop);
      };
      this.rafHandle = requestAnimationFrame(loop);
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
    const video = this.el as RVFCVideo;
    if (video.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(this.rvfcHandle);
    }
  }

  dispose(): void {
    this.stop();
    this.mitigation.dispose();
  }

  /** 内容源切换(新视频、新 GIF)时调用 */
  resetContent(): void {
    this.detector.reset();
    this.violationSince = 0;
    this.cleanSince = 0;
    this.allowedByUser = false;
    this.setLevel(0, null);
  }

  private tick(now: number): void {
    const el = this.el;
    let sw = 0;
    let sh = 0;
    if (el instanceof HTMLVideoElement) {
      if (el.readyState < 2 || el.paused) return;
      sw = el.videoWidth;
      sh = el.videoHeight;
    } else if (el instanceof HTMLImageElement) {
      if (!el.complete || el.naturalWidth === 0) return;
      sw = el.naturalWidth;
      sh = el.naturalHeight;
    } else {
      sw = el.width;
      sh = el.height;
    }

    const features = this.sampler.sample(el, sw, sh);
    if (!features) return; // 跨域污染等情况:跳过,见 README 的 CORS 说明

    const analysis = this.detector.addFrame(
      features.luminance,
      features.red,
      now,
    );
    this.lastAnalysis = analysis;
    this.updateLevel(analysis, now);
  }

  private updateLevel(a: FrameAnalysis, now: number): void {
    if (this.allowedByUser) return; // 用户已知情放行,维持 1 级

    let target = this.level;

    if (a.violation) {
      this.cleanSince = 0;
      if (!this.violationSince) this.violationSince = now;
      target =
        now - this.violationSince >= this.opts.severeAfterMs
          ? 3
          : Math.max(target, 2) as MitigationLevel;
    } else if (a.riskScore >= 0.6) {
      // 接近上限(如每秒 2 次闪烁):轻度防护
      this.cleanSince = 0;
      this.violationSince = 0;
      target = Math.max(target, 1) as MitigationLevel;
    } else {
      this.violationSince = 0;
      if (!this.cleanSince) this.cleanSince = now;
      if (now - this.cleanSince >= this.opts.releaseAfterMs && target > 0) {
        target = (target - 1) as MitigationLevel;
        this.cleanSince = now; // 逐级释放
      }
    }

    this.setLevel(target, a);
  }

  private setLevel(level: MitigationLevel, analysis: FrameAnalysis | null): void {
    if (level === this.level) return;
    this.level = level;
    this.mitigation.apply(level);
    if (analysis && this.onLevelChange) this.onLevelChange(level, analysis);
  }
}
