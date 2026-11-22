export { FlashDetector, DEFAULT_DETECTOR_OPTIONS, type FlashDetectorOptions, type FrameAnalysis, type ViolationKind, } from './detector.js';
export { FrameSampler, type FrameFeatures } from './sampler.js';
export { MitigationController, DEFAULT_MITIGATION_OPTIONS, type MitigationLevel, type MitigationOptions, } from './mitigation.js';
export { MediaProtector, DEFAULT_PROTECTOR_OPTIONS, type ProtectorOptions, } from './protector.js';
export { analyzeAnimatedImage, type AnimatedImageReport } from './gif.js';
export { FlashGuard, type FlashGuardOptions } from './dom.js';
export { relativeLuminance, redIntensity, srgbToLinear } from './luminance.js';
