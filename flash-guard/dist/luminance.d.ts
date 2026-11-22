/**
 * 颜色科学工具:WCAG 相对亮度与饱和红强度。
 * 标准依据:WCAG 2.3.1 定义 + Harding FPA / ITU-R BT.1702 红色闪烁定义。
 */
/** sRGB 通道 (0-255) → 线性光强度 (0-1) */
export declare function srgbToLinear(c8: number): number;
/** WCAG 相对亮度,范围 0(纯黑)到 1(纯白) */
export declare function relativeLuminance(r: number, g: number, b: number): number;
/**
 * 饱和红强度,范围 0-1。
 * Harding 测试关注的是"饱和红"的突变(红色闪烁对光敏性癫痫的刺激最强),
 * 用 R 超出 G/B 均值的部分衡量红色的饱和程度。
 */
export declare function redIntensity(r: number, g: number, b: number): number;
