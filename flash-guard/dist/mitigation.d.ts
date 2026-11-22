/**
 * 削弱控制器:把检测结论变成对元素的实际处理。
 *
 * 分级策略(默认):
 *  - 1 级(预警,闪烁接近上限):轻度降对比度,画面几乎无感;
 *  - 2 级(违规):明显降对比度+降亮度+去饱和(针对红色闪烁),内容仍可观看;
 *  - 3 级(持续违规):暂停播放并用遮挡层覆盖,用户主动点击才放行。
 *
 * 对比度压缩之所以能削弱闪烁:CSS contrast(k) 以中灰为轴缩放亮度,
 * 亮度跳变幅度近似乘以 k,0.1 的危险跳变在 contrast(0.5) 下只剩约 0.05,
 * 低于 WCAG 阈值,同时画面内容仍然可辨认。
 */
export type MitigationLevel = 0 | 1 | 2 | 3;
export interface MitigationOptions {
    /** 各等级对应的 CSS filter,等级 0 为空字符串 */
    filters: [string, string, string, string];
    /** 3 级时是否暂停视频 */
    pauseOnSevere: boolean;
    /** 3 级遮挡层提示文案 */
    shieldText: string;
    /** 遮挡层"仍要查看"按钮文案 */
    shieldAllowText: string;
}
export declare const DEFAULT_MITIGATION_OPTIONS: MitigationOptions;
export declare class MitigationController {
    private opts;
    private level;
    private wrapper;
    private shield;
    private el;
    private onAllow?;
    constructor(el: HTMLElement, options?: Partial<MitigationOptions>, onAllow?: () => void);
    get currentLevel(): MitigationLevel;
    apply(level: MitigationLevel): void;
    /** 用户点击"仍要查看"后调用:临时解除到 1 级防护 */
    allowAnyway(): void;
    dispose(): void;
    private ensureWrapper;
    private showShield;
    private hideShield;
}
