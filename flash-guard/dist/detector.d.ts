/**
 * 核心闪烁检测器(纯逻辑,不依赖 DOM,可在 Node / Web Worker / RN 中运行)。
 *
 * 判定标准(默认阈值对应 WCAG 2.3.1 + Harding FPA / Ofcom 广播标准):
 *  - 亮度闪烁:相对亮度变化 ≥ 0.1,且较暗状态 < 0.8,
 *    且变化区域 ≥ 画面 25%(近似 WCAG 的 0.006 球面度视野面积);
 *  - 红色闪烁:饱和红强度变化 ≥ 0.2,面积阈值同上;
 *  - 一对反向跳变记为一次"闪烁",任意 1 秒窗口内 ≥ 3 次即违规。
 *
 * 输入是降采样后的网格(如 32x32),每格一个亮度值/红强度值,
 * 因此正常剪辑的局部运动、字幕、小图标闪烁不会触发(面积阈值),
 * 而全屏或大面积频闪会被捕获。
 */
export interface FlashDetectorOptions {
    /** 亮度跳变阈值(相对亮度差),默认 0.1 */
    luminanceDeltaThreshold: number;
    /** 较暗状态上限,默认 0.8(亮→更亮的跳变不计) */
    darkStateThreshold: number;
    /** 饱和红跳变阈值,默认 0.2 */
    redDeltaThreshold: number;
    /** 触发面积占比阈值,默认 0.25 */
    areaFractionThreshold: number;
    /** 每秒闪烁次数上限,默认 3 */
    flashesPerSecondLimit: number;
    /** 统计窗口(毫秒),默认 1000 */
    windowMs: number;
}
export declare const DEFAULT_DETECTOR_OPTIONS: FlashDetectorOptions;
export type ViolationKind = 'luminance' | 'red';
export interface FrameAnalysis {
    timestamp: number;
    /** 本帧相对上一帧是否发生了大面积亮度跳变 */
    luminanceTransition: boolean;
    /** 本帧相对上一帧是否发生了大面积红色跳变 */
    redTransition: boolean;
    /** 亮度跳变覆盖的面积占比(0-1) */
    luminanceAreaFraction: number;
    /** 红色跳变覆盖的面积占比(0-1) */
    redAreaFraction: number;
    /** 当前 1 秒窗口内的亮度闪烁次数 */
    luminanceFlashesPerSecond: number;
    /** 当前 1 秒窗口内的红色闪烁次数 */
    redFlashesPerSecond: number;
    /** 是否违规,以及违规类型 */
    violation: ViolationKind | null;
    /** 0-1 的风险分,1 表示达到违规线,可用于分级削弱 */
    riskScore: number;
}
export declare class FlashDetector {
    private opts;
    private prevLum;
    private prevRed;
    private transitions;
    constructor(options?: Partial<FlashDetectorOptions>);
    /** 换内容(视频切换、GIF 重载)时重置状态 */
    reset(): void;
    /**
     * 输入一帧的降采样特征。
     * @param luminance 每格相对亮度(0-1),长度 = 网格格数
     * @param red       每格饱和红强度(0-1),同长度
     * @param timestamp 帧时间戳(毫秒,单调递增)
     */
    addFrame(luminance: Float32Array, red: Float32Array, timestamp: number): FrameAnalysis;
    /**
     * 同方向连续跳变(渐变/扫光)只保留最新一次,
     * 只有方向反转才构成"闪烁对"。
     */
    private pushTransition;
    private prune;
    /** 一对反向跳变 = 一次闪烁 */
    private countFlashes;
}
