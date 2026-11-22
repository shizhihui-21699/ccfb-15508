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
export const DEFAULT_MITIGATION_OPTIONS = {
    filters: [
        '',
        'contrast(0.75) brightness(0.92)',
        'contrast(0.5) brightness(0.8) saturate(0.5)',
        'contrast(0.4) brightness(0.6) saturate(0.3)',
    ],
    pauseOnSevere: true,
    shieldText: '此内容含有可能诱发光敏性癫痫的闪烁,已自动屏蔽',
    shieldAllowText: '我了解风险,仍要查看',
};
export class MitigationController {
    constructor(el, options = {}, onAllow) {
        this.level = 0;
        this.wrapper = null;
        this.shield = null;
        this.el = el;
        this.opts = { ...DEFAULT_MITIGATION_OPTIONS, ...options };
        this.onAllow = onAllow;
    }
    get currentLevel() {
        return this.level;
    }
    apply(level) {
        if (level === this.level)
            return;
        this.level = level;
        this.el.style.filter = this.opts.filters[level];
        // 平滑过渡,避免削弱本身造成跳变
        this.el.style.transition = 'filter 200ms linear';
        if (level >= 3) {
            if (this.opts.pauseOnSevere && this.el instanceof HTMLVideoElement) {
                this.el.pause();
            }
            this.showShield();
        }
        else {
            this.hideShield();
        }
    }
    /** 用户点击"仍要查看"后调用:临时解除到 1 级防护 */
    allowAnyway() {
        this.hideShield();
        this.level = 1;
        this.el.style.filter = this.opts.filters[1];
        this.onAllow?.();
    }
    dispose() {
        this.apply(0);
        this.el.style.filter = '';
        this.el.style.transition = '';
        this.shield?.remove();
        this.wrapper = null;
    }
    ensureWrapper() {
        if (this.wrapper)
            return this.wrapper;
        const parent = this.el.parentElement;
        if (!parent)
            throw new Error('FlashGuard: 元素不在 DOM 中');
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.maxWidth = '100%';
        parent.insertBefore(wrapper, this.el);
        wrapper.appendChild(this.el);
        this.wrapper = wrapper;
        return wrapper;
    }
    showShield() {
        if (this.shield) {
            this.shield.style.display = 'flex';
            return;
        }
        const wrapper = this.ensureWrapper();
        const shield = document.createElement('div');
        shield.setAttribute('role', 'alert');
        shield.style.cssText =
            'position:absolute;inset:0;display:flex;flex-direction:column;' +
                'align-items:center;justify-content:center;gap:12px;padding:16px;' +
                'background:rgba(0,0,0,0.88);color:#fff;font:14px/1.6 system-ui;' +
                'text-align:center;z-index:1;';
        const text = document.createElement('div');
        text.textContent = this.opts.shieldText;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = this.opts.shieldAllowText;
        btn.style.cssText =
            'padding:6px 14px;border:1px solid #fff;border-radius:4px;' +
                'background:transparent;color:#fff;cursor:pointer;font:inherit;';
        btn.addEventListener('click', () => this.allowAnyway());
        shield.append(text, btn);
        wrapper.appendChild(shield);
        this.shield = shield;
    }
    hideShield() {
        if (this.shield)
            this.shield.style.display = 'none';
    }
}
