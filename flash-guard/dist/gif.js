import { FlashDetector } from './detector.js';
import { FrameSampler } from './sampler.js';
/**
 * GIF/WebP/APNG 的"播出前"预检:
 * 用 ImageDecoder 一次性解码全部帧,在图片渲染到屏幕之前给出结论。
 * 适合评论区/私信列表——先分析,违规内容直接以占位图+提示渲染。
 *
 * 不支持 ImageDecoder 的环境返回 { supported: false },
 * 此时应退回到 MediaProtector 的实时检测方案。
 */
export async function analyzeAnimatedImage(source, options = {}) {
    const report = {
        supported: false,
        frameCount: 0,
        durationMs: 0,
        maxFlashesPerSecond: 0,
        violation: null,
        violations: [],
    };
    if (typeof ImageDecoder === 'undefined')
        return report;
    const data = source instanceof Blob ? await source.arrayBuffer() : source;
    const decoder = new ImageDecoder({ data, type: 'image/gif' });
    const detector = new FlashDetector(options);
    const sampler = new FrameSampler(32, 32);
    try {
        const track = decoder.tracks.selectedTrack;
        if (!track)
            return report;
        report.supported = true;
        report.frameCount = track.frameCount;
        let t = 0;
        for (let i = 0; i < track.frameCount; i++) {
            const { image } = await decoder.decode({ frameIndex: i });
            const features = sampler.sample(image, image.width, image.height);
            image.close?.();
            if (!features)
                continue;
            const a = detector.addFrame(features.luminance, features.red, t);
            report.maxFlashesPerSecond = Math.max(report.maxFlashesPerSecond, a.luminanceFlashesPerSecond, a.redFlashesPerSecond);
            if (a.violation) {
                report.violation = report.violation ?? a.violation;
                report.violations.push({ atMs: t, kind: a.violation });
            }
            t += image.duration ? image.duration / 1000 : 100; // duration 单位是微秒
        }
        report.durationMs = t;
        return report;
    }
    finally {
        decoder.close();
    }
}
