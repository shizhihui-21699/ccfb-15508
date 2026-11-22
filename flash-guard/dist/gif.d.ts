import { type FlashDetectorOptions, type ViolationKind } from './detector.js';
export interface AnimatedImageReport {
    /** 环境是否支持离线预解码(需要 ImageDecoder,Chrome/Edge 94+) */
    supported: boolean;
    frameCount: number;
    durationMs: number;
    /** 整个片段中出现的最大每秒闪烁次数 */
    maxFlashesPerSecond: number;
    violation: ViolationKind | null;
    /** 逐帧分析摘要,可用于定位问题时间段 */
    violations: Array<{
        atMs: number;
        kind: ViolationKind;
    }>;
}
/**
 * GIF/WebP/APNG 的"播出前"预检:
 * 用 ImageDecoder 一次性解码全部帧,在图片渲染到屏幕之前给出结论。
 * 适合评论区/私信列表——先分析,违规内容直接以占位图+提示渲染。
 *
 * 不支持 ImageDecoder 的环境返回 { supported: false },
 * 此时应退回到 MediaProtector 的实时检测方案。
 */
export declare function analyzeAnimatedImage(source: Blob | ArrayBuffer, options?: Partial<FlashDetectorOptions>): Promise<AnimatedImageReport>;
