import { relativeLuminance, redIntensity } from './luminance.js';
/**
 * 帧采样器:把任意可绘制源(video / img / canvas)画到小画布上,
 * 一次性读出像素并转成检测器需要的亮度/红强度网格。
 *
 * 默认 32x32 = 1024 格,每帧一次 getImageData,开销约 0.1ms 量级,
 * 可以在 requestAnimationFrame / requestVideoFrameCallback 里实时跑。
 */
export class FrameSampler {
    constructor(width = 32, height = 32) {
        this.width = width;
        this.height = height;
        if (typeof document !== 'undefined') {
            this.canvas = document.createElement('canvas');
        }
        else {
            // Web Worker 环境
            this.canvas = new OffscreenCanvas(width, height);
        }
        this.canvas.width = width;
        this.canvas.height = height;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx)
            throw new Error('FlashGuard: 无法创建 2D 上下文');
        this.ctx = ctx;
    }
    /**
     * 采样一帧。源不可绘制(未加载完成、跨域被污染)时返回 null。
     * 注意:跨域视频/图片需要 CORS(crossOrigin="anonymous"),
     * 否则 canvas 被污染后 getImageData 会抛错——这里捕获并按 null 处理。
     */
    sample(source, sw, sh) {
        if (sw === 0 || sh === 0)
            return null;
        try {
            this.ctx.drawImage(source, 0, 0, sw, sh, 0, 0, this.width, this.height);
            const img = this.ctx.getImageData(0, 0, this.width, this.height);
            return this.fromImageData(img);
        }
        catch {
            return null;
        }
    }
    /** 从原始像素计算特征(也可直接喂解码出来的帧数据,用于 GIF 预解码) */
    fromImageData(img) {
        const count = img.width * img.height;
        const luminance = new Float32Array(count);
        const red = new Float32Array(count);
        const d = img.data;
        for (let i = 0, p = 0; i < count; i++, p += 4) {
            luminance[i] = relativeLuminance(d[p], d[p + 1], d[p + 2]);
            red[i] = redIntensity(d[p], d[p + 1], d[p + 2]);
        }
        return { luminance, red };
    }
}
