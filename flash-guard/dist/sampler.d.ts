export interface FrameFeatures {
    luminance: Float32Array;
    red: Float32Array;
}
/**
 * 帧采样器:把任意可绘制源(video / img / canvas)画到小画布上,
 * 一次性读出像素并转成检测器需要的亮度/红强度网格。
 *
 * 默认 32x32 = 1024 格,每帧一次 getImageData,开销约 0.1ms 量级,
 * 可以在 requestAnimationFrame / requestVideoFrameCallback 里实时跑。
 */
export declare class FrameSampler {
    readonly width: number;
    readonly height: number;
    private canvas;
    private ctx;
    constructor(width?: number, height?: number);
    /**
     * 采样一帧。源不可绘制(未加载完成、跨域被污染)时返回 null。
     * 注意:跨域视频/图片需要 CORS(crossOrigin="anonymous"),
     * 否则 canvas 被污染后 getImageData 会抛错——这里捕获并按 null 处理。
     */
    sample(source: CanvasImageSource, sw: number, sh: number): FrameFeatures | null;
    /** 从原始像素计算特征(也可直接喂解码出来的帧数据,用于 GIF 预解码) */
    fromImageData(img: {
        data: Uint8ClampedArray;
        width: number;
        height: number;
    }): FrameFeatures;
}
