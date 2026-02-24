/**
 * AI Processing Module
 * Exports all processing functionality
 */

export {
  ProcessingConfig,
  defaultConfig,
  loadConfig,
  getConfig,
  updateConfig
} from './config';

export {
  OcrResult,
  OcrOptions,
  ocrFile,
  ocrImage,
  ocrPdf,
  ocrBase64,
  isImageFile,
  isPdfFile,
  cleanup as ocrCleanup
} from './ocr';

export {
  TranslationResult,
  TranslationOptions,
  detectLanguage,
  translate,
  translateBatch,
  checkTranslationService
} from './translate';

export {
  DescriptionResult,
  ImageDescriptionOptions,
  AudioTranscriptionOptions,
  VideoProcessingOptions,
  getMediaType,
  describeImage,
  describeImageBase64,
  transcribeAudio,
  processVideo,
  describeMedia,
  checkServices as checkDescriptionServices
} from './describe';

export {
  ProcessingResult,
  ProcessingOptions,
  getContentType,
  processFile,
  processText,
  processBase64,
  processBatch,
  getProcessingStats
} from './pipeline';
