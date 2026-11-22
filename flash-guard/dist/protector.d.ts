import { type FlashDetectorOptions, type FrameAnalysis } from './detector.js';
import { type MitigationLevel, type MitigationOptions } from './mitigation.js';
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
export declare const DEFAULT_PROTECTOR_OPTIONS: Omit<ProtectorOptions, 'onLevelChange'>;
/**
 * 媒体保护器:绑定一个 video / img(GIF)/ canvas,
 * 每帧采样 → 检测 → 按等级削弱。检测与渲染同帧进行,
 * 违规内容最多露出 1-2 帧(约 16-33ms)即被压制。
 */
export declare class MediaProtector {
    private el;
    private opts;
    private detector;
    private sampler;
    private mitigation;
    private onLevelChange?;
    private running;
    private rafHandle;
    private rvfcHandle;
    private level;
    private violationSince;
    private cleanSince;
    private allowedByUser;
    constructor(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, options?: Partial<ProtectorOptions>);
    private lastAnalysis;
    start(): void;
    stop(): void;
    dispose(): void;
    /** 内容源切换(新视频、新 GIF)时调用 */
    resetContent(): void;
    private tick;
    private updateLevel;
    private setLevel;
}
