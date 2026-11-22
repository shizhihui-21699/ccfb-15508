import { type ProtectorOptions } from './protector.js';
export interface FlashGuardOptions extends Partial<ProtectorOptions> {
    /** 是否保护 <img>(GIF/WebP/APNG 动图),默认 true */
    protectImages: boolean;
    /** 是否保护 <video>,默认 true */
    protectVideos: boolean;
    /** 是否保护 <canvas>(游戏/动效),默认 false */
    protectCanvases: boolean;
}
/**
 * 页面级自动防护:扫描现有媒体元素,并用 MutationObserver
 * 接管后续动态插入的内容(评论流、私信气泡等)。
 *
 * 用法:
 *   const guard = FlashGuard.init();
 *   // 单元素退出防护:<video data-flash-guard="off">
 *   // 卸载:guard.dispose();
 */
export declare class FlashGuard {
    private opts;
    private protectors;
    private observer;
    private root;
    private constructor();
    static init(options?: Partial<FlashGuardOptions>, root?: ParentNode): FlashGuard;
    private shouldProtect;
    private scan;
    private unscan;
    dispose(): void;
}
