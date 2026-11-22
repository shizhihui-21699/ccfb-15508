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
export const DEFAULT_DETECTOR_OPTIONS = {
    luminanceDeltaThreshold: 0.1,
    darkStateThreshold: 0.8,
    redDeltaThreshold: 0.2,
    areaFractionThreshold: 0.25,
    flashesPerSecondLimit: 3,
    windowMs: 1000,
};
export class FlashDetector {
    constructor(options = {}) {
        this.prevLum = null;
        this.prevRed = null;
        this.transitions = [];
        this.opts = { ...DEFAULT_DETECTOR_OPTIONS, ...options };
    }
    /** 换内容(视频切换、GIF 重载)时重置状态 */
    reset() {
        this.prevLum = null;
        this.prevRed = null;
        this.transitions = [];
    }
    /**
     * 输入一帧的降采样特征。
     * @param luminance 每格相对亮度(0-1),长度 = 网格格数
     * @param red       每格饱和红强度(0-1),同长度
     * @param timestamp 帧时间戳(毫秒,单调递增)
     */
    addFrame(luminance, red, timestamp) {
        const o = this.opts;
        const n = luminance.length;
        let lumTransition = false;
        let redTransition = false;
        let lumFraction = 0;
        let redFraction = 0;
        if (this.prevLum && this.prevRed && this.prevLum.length === n) {
            let lumUp = 0;
            let lumDown = 0;
            let redUp = 0;
            let redDown = 0;
            for (let i = 0; i < n; i++) {
                const dL = luminance[i] - this.prevLum[i];
                if (Math.abs(dL) >= o.luminanceDeltaThreshold &&
                    Math.min(luminance[i], this.prevLum[i]) < o.darkStateThreshold) {
                    if (dL > 0)
                        lumUp++;
                    else
                        lumDown++;
                }
                const dR = red[i] - this.prevRed[i];
                if (Math.abs(dR) >= o.redDeltaThreshold) {
                    if (dR > 0)
                        redUp++;
                    else
                        redDown++;
                }
            }
            const lumCount = Math.max(lumUp, lumDown);
            const redCount = Math.max(redUp, redDown);
            lumFraction = lumCount / n;
            redFraction = redCount / n;
            if (lumFraction >= o.areaFractionThreshold) {
                lumTransition = true;
                this.pushTransition(timestamp, lumUp >= lumDown ? 1 : -1, 'luminance');
            }
            if (redFraction >= o.areaFractionThreshold) {
                redTransition = true;
                this.pushTransition(timestamp, redUp >= redDown ? 1 : -1, 'red');
            }
        }
        this.prevLum = Float32Array.from(luminance);
        this.prevRed = Float32Array.from(red);
        this.prune(timestamp);
        const lumFlashes = this.countFlashes('luminance');
        const redFlashes = this.countFlashes('red');
        const violation = lumFlashes >= o.flashesPerSecondLimit
            ? 'luminance'
            : redFlashes >= o.flashesPerSecondLimit
                ? 'red'
                : null;
        return {
            timestamp,
            luminanceTransition: lumTransition,
            redTransition: redTransition,
            luminanceAreaFraction: lumFraction,
            redAreaFraction: redFraction,
            luminanceFlashesPerSecond: lumFlashes,
            redFlashesPerSecond: redFlashes,
            violation,
            riskScore: Math.min(1, Math.max(lumFlashes, redFlashes) / o.flashesPerSecondLimit),
        };
    }
    /**
     * 同方向连续跳变(渐变/扫光)只保留最新一次,
     * 只有方向反转才构成"闪烁对"。
     */
    pushTransition(t, dir, kind) {
        for (let i = this.transitions.length - 1; i >= 0; i--) {
            const tr = this.transitions[i];
            if (tr.kind !== kind)
                continue;
            if (tr.dir === dir) {
                tr.t = t; // 同方向:更新时间戳,不新增
                return;
            }
            break;
        }
        this.transitions.push({ t, dir, kind });
    }
    prune(now) {
        const cutoff = now - this.opts.windowMs;
        while (this.transitions.length && this.transitions[0].t < cutoff) {
            this.transitions.shift();
        }
    }
    /** 一对反向跳变 = 一次闪烁 */
    countFlashes(kind) {
        const list = this.transitions.filter((t) => t.kind === kind);
        let flashes = 0;
        let i = 0;
        while (i + 1 < list.length) {
            if (list[i].dir !== list[i + 1].dir) {
                flashes++;
                i += 2;
            }
            else {
                i++;
            }
        }
        return flashes;
    }
}
