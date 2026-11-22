import { FlashDetector, } from './detector.js';
import { FrameSampler } from './sampler.js';
import { MitigationController, } from './mitigation.js';
export const DEFAULT_PROTECTOR_OPTIONS = {
    sampleWidth: 32,
    sampleHeight: 32,
    severeAfterMs: 1500,
    releaseAfterMs: 3000,
    mitigation: {},
};
/**
 * 媒体保护器:绑定一个 video / img(GIF)/ canvas,
 * 每帧采样 → 检测 → 按等级削弱。检测与渲染同帧进行,
 * 违规内容最多露出 1-2 帧(约 16-33ms)即被压制。
 */
export class MediaProtector {
    constructor(el, options = {}) {
        this.running = false;
        this.rafHandle = 0;
        this.rvfcHandle = 0;
        this.level = 0;
        this.violationSince = 0;
        this.cleanSince = 0;
        this.allowedByUser = false;
        this.lastAnalysis = null;
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
    start() {
        if (this.running)
            return;
        this.running = true;
        const video = this.el;
        if (this.el instanceof HTMLVideoElement && video.requestVideoFrameCallback) {
            // 与视频帧严格同步,不漏帧也不多采样
            const loop = (now) => {
                if (!this.running)
                    return;
                this.tick(now);
                this.rvfcHandle = video.requestVideoFrameCallback(loop);
            };
            this.rvfcHandle = video.requestVideoFrameCallback(loop);
        }
        else {
            // GIF 图 / canvas / 不支持 rvfc 的浏览器:跟随屏幕刷新率采样
            const loop = (now) => {
                if (!this.running)
                    return;
                this.tick(now);
                this.rafHandle = requestAnimationFrame(loop);
            };
            this.rafHandle = requestAnimationFrame(loop);
        }
    }
    stop() {
        this.running = false;
        cancelAnimationFrame(this.rafHandle);
        const video = this.el;
        if (video.cancelVideoFrameCallback) {
            video.cancelVideoFrameCallback(this.rvfcHandle);
        }
    }
    dispose() {
        this.stop();
        this.mitigation.dispose();
    }
    /** 内容源切换(新视频、新 GIF)时调用 */
    resetContent() {
        this.detector.reset();
        this.violationSince = 0;
        this.cleanSince = 0;
        this.allowedByUser = false;
        this.setLevel(0, null);
    }
    tick(now) {
        const el = this.el;
        let sw = 0;
        let sh = 0;
        if (el instanceof HTMLVideoElement) {
            if (el.readyState < 2 || el.paused)
                return;
            sw = el.videoWidth;
            sh = el.videoHeight;
        }
        else if (el instanceof HTMLImageElement) {
            if (!el.complete || el.naturalWidth === 0)
                return;
            sw = el.naturalWidth;
            sh = el.naturalHeight;
        }
        else {
            sw = el.width;
            sh = el.height;
        }
        const features = this.sampler.sample(el, sw, sh);
        if (!features)
            return; // 跨域污染等情况:跳过,见 README 的 CORS 说明
        const analysis = this.detector.addFrame(features.luminance, features.red, now);
        this.lastAnalysis = analysis;
        this.updateLevel(analysis, now);
    }
    updateLevel(a, now) {
        if (this.allowedByUser)
            return; // 用户已知情放行,维持 1 级
        let target = this.level;
        if (a.violation) {
            this.cleanSince = 0;
            if (!this.violationSince)
                this.violationSince = now;
            target =
                now - this.violationSince >= this.opts.severeAfterMs
                    ? 3
                    : Math.max(target, 2);
        }
        else if (a.riskScore >= 0.6) {
            // 接近上限(如每秒 2 次闪烁):轻度防护
            this.cleanSince = 0;
            this.violationSince = 0;
            target = Math.max(target, 1);
        }
        else {
            this.violationSince = 0;
            if (!this.cleanSince)
                this.cleanSince = now;
            if (now - this.cleanSince >= this.opts.releaseAfterMs && target > 0) {
                target = (target - 1);
                this.cleanSince = now; // 逐级释放
            }
        }
        this.setLevel(target, a);
    }
    setLevel(level, analysis) {
        if (level === this.level)
            return;
        this.level = level;
        this.mitigation.apply(level);
        if (analysis && this.onLevelChange)
            this.onLevelChange(level, analysis);
    }
}
