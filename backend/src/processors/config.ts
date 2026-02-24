/**
 * AI Processing Configuration
 * Offline-first with local models where possible
 */

export interface ProcessingConfig {
  // OCR Settings
  ocr: {
    enabled: boolean;
    language: string;
    supportedFormats: string[];
  };

  // Translation Settings
  translation: {
    enabled: boolean;
    targetLanguage: string;
    provider: 'libretranslate' | 'ollama' | 'none';
    libretranslateUrl?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
  };

  // AI Description Settings
  aiDescription: {
    enabled: boolean;
    imageProvider: 'ollama' | 'openai' | 'none';
    ollamaUrl?: string;
    ollamaVisionModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
  };

  // Audio/Video Settings
  mediaProcessing: {
    enabled: boolean;
    whisperProvider: 'local' | 'openai' | 'none';
    whisperModelPath?: string;
    openaiApiKey?: string;
    extractVideoFrames: boolean;
    frameInterval: number;
    maxFrames: number;
  };

  // General Settings
  autoProcess: boolean;
  maxFileSizeMb: number;
  processingConcurrency: number;
}

export const defaultConfig: ProcessingConfig = {
  ocr: {
    enabled: true,
    language: 'eng',
    supportedFormats: ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.pdf']
  },

  translation: {
    enabled: true,
    targetLanguage: 'en',
    provider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    libretranslateUrl: 'http://localhost:5000'
  },

  aiDescription: {
    enabled: true,
    imageProvider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaVisionModel: 'llava',
    openaiModel: 'gpt-4o'
  },

  mediaProcessing: {
    enabled: true,
    whisperProvider: 'local',
    whisperModelPath: 'Xenova/whisper-small',
    extractVideoFrames: true,
    frameInterval: 10,
    maxFrames: 10
  },

  autoProcess: true,
  maxFileSizeMb: 100,
  processingConcurrency: 2
};

export function loadConfig(): ProcessingConfig {
  const config = { ...defaultConfig };

  if (process.env.OCR_ENABLED === 'false') config.ocr.enabled = false;
  if (process.env.OCR_LANGUAGE) config.ocr.language = process.env.OCR_LANGUAGE;

  if (process.env.TRANSLATION_ENABLED === 'false') config.translation.enabled = false;
  if (process.env.TRANSLATION_TARGET) config.translation.targetLanguage = process.env.TRANSLATION_TARGET;
  if (process.env.TRANSLATION_PROVIDER) {
    config.translation.provider = process.env.TRANSLATION_PROVIDER as 'libretranslate' | 'ollama' | 'none';
  }
  if (process.env.LIBRETRANSLATE_URL) config.translation.libretranslateUrl = process.env.LIBRETRANSLATE_URL;

  if (process.env.AI_DESCRIPTION_ENABLED === 'false') config.aiDescription.enabled = false;
  if (process.env.OLLAMA_URL) {
    config.translation.ollamaUrl = process.env.OLLAMA_URL;
    config.aiDescription.ollamaUrl = process.env.OLLAMA_URL;
  }
  if (process.env.OLLAMA_VISION_MODEL) config.aiDescription.ollamaVisionModel = process.env.OLLAMA_VISION_MODEL;
  if (process.env.OPENAI_API_KEY) {
    config.aiDescription.openaiApiKey = process.env.OPENAI_API_KEY;
    config.mediaProcessing.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  if (process.env.MEDIA_PROCESSING_ENABLED === 'false') config.mediaProcessing.enabled = false;
  if (process.env.WHISPER_PROVIDER) {
    config.mediaProcessing.whisperProvider = process.env.WHISPER_PROVIDER as 'local' | 'openai' | 'none';
  }

  if (process.env.AUTO_PROCESS === 'false') config.autoProcess = false;
  if (process.env.MAX_FILE_SIZE_MB) config.maxFileSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB);

  return config;
}

let configInstance: ProcessingConfig | null = null;

export function getConfig(): ProcessingConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

export function updateConfig(updates: Partial<ProcessingConfig>): ProcessingConfig {
  configInstance = { ...getConfig(), ...updates };
  return configInstance;
}
