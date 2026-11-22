import { MediaProtector } from './protector.js';
const PROTECTED_ATTR = 'data-flash-guard';
/**
 * 页面级自动防护:扫描现有媒体元素,并用 MutationObserver
 * 接管后续动态插入的内容(评论流、私信气泡等)。
 *
 * 用法:
 *   const guard = FlashGuard.init();
 *   // 单元素退出防护:<video data-flash-guard="off">
 *   // 卸载:guard.dispose();
 */
export class FlashGuard {
    constructor(root, options) {
        this.protectors = new Map();
        this.observer = null;
        this.root = root;
        this.opts = {
            protectImages: true,
            protectVideos: true,
            protectCanvases: false,
            ...options,
        };
    }
    static init(options = {}, root = document) {
        const guard = new FlashGuard(root, options);
        guard.scan(root);
        guard.observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node instanceof Element)
                        guard.scan(node);
                }
                for (const node of m.removedNodes) {
                    if (node instanceof Element)
                        guard.unscan(node);
                }
            }
        });
        guard.observer.observe(root instanceof Document ? root.documentElement : root, {
            childList: true,
            subtree: true,
        });
        return guard;
    }
    shouldProtect(el) {
        if (el.getAttribute(PROTECTED_ATTR) === 'off')
            return false;
        if (el instanceof HTMLVideoElement)
            return this.opts.protectVideos;
        if (el instanceof HTMLImageElement) {
            if (!this.opts.protectImages)
                return false;
            const src = el.currentSrc || el.src || '';
            // 静态图跳过;动图格式或无法判断时都纳入实时采样(采样本身很便宜)
            return !/\.(jpe?g|png|svg|avif)(\?|#|$)/i.test(src);
        }
        if (el instanceof HTMLCanvasElement)
            return this.opts.protectCanvases;
        return false;
    }
    scan(root) {
        const candidates = [];
        if (root instanceof Element)
            candidates.push(root);
        candidates.push(...root.querySelectorAll('video, img, canvas'));
        for (const el of candidates) {
            if (this.protectors.has(el) || !this.shouldProtect(el))
                continue;
            const protector = new MediaProtector(el, this.opts);
            protector.start();
            this.protectors.set(el, protector);
        }
    }
    unscan(root) {
        for (const [el, protector] of this.protectors) {
            if (el === root || root.contains(el)) {
                protector.dispose();
                this.protectors.delete(el);
            }
        }
    }
    dispose() {
        this.observer?.disconnect();
        for (const p of this.protectors.values())
            p.dispose();
        this.protectors.clear();
    }
}
