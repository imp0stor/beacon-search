/**
 * Document Processing Pipeline
 * Automatically processes documents through OCR, translation, and AI description
 */

import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config';
import { ocrFile, OcrResult } from './ocr';
import { translate, detectLanguage, TranslationResult } from './translate';
import { describeMedia, getMediaType, DescriptionResult } from './describe';

export interface ProcessingResult {
  success: boolean;
  originalContent: string;
  processedContent: string;
  
  ocr?: OcrResult;
  translation?: TranslationResult;
  aiDescription?: DescriptionResult;
  
  detectedLanguage?: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'document';
  processingSteps: string[];
  processingTime: number;
  
  error?: string;
}

export interface ProcessingOptions {
  skipOcr?: boolean;
  skipTranslation?: boolean;
  skipAiDescription?: boolean;
  forceOcr?: boolean;
  ocrLanguage?: string;
  targetLanguage?: string;
}

export function getContentType(filePath: string): 'text' | 'image' | 'audio' | 'video' | 'document' {
  const ext = path.extname(filePath).toLowerCase();
  
  const textExts = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.htm'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
  const audioExts = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
  const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv'];
  const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

  if (textExts.includes(ext)) return 'text';
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  if (docExts.includes(ext)) return 'document';
  
  return 'text';
}

export async function processFile(
  filePath: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const config = getConfig();
  const processingSteps: string[] = [];
  
  const result: ProcessingResult = {
    success: false,
    originalContent: '',
    processedContent: '',
    contentType: getContentType(filePath),
    processingSteps,
    processingTime: 0
  };

  if (!fs.existsSync(filePath)) {
    result.error = `File not found: ${filePath}`;
    result.processingTime = Date.now() - startTime;
    return result;
  }

  const stats = fs.statSync(filePath);
  const fileSizeMb = stats.size / (1024 * 1024);
  
  if (fileSizeMb > config.maxFileSizeMb) {
    result.error = `File too large: ${fileSizeMb.toFixed(2)}MB (max: ${config.maxFileSizeMb}MB)`;
    result.processingTime = Date.now() - startTime;
    return result;
  }

  try {
    let extractedText = '';

    switch (result.contentType) {
      case 'text':
        extractedText = fs.readFileSync(filePath, 'utf-8');
        result.originalContent = extractedText;
        processingSteps.push('text_read');
        break;

      case 'image':
        if (!options.skipOcr && config.ocr.enabled) {
          processingSteps.push('ocr_started');
          const ocrResult = await ocrFile(filePath, { language: options.ocrLanguage });
          result.ocr = ocrResult;
          
          if (ocrResult.success && ocrResult.text.trim().length > 0) {
            extractedText = ocrResult.text;
            processingSteps.push('ocr_completed');
          }
        }
        
        if (!options.skipAiDescription && config.aiDescription.enabled) {
          processingSteps.push('ai_description_started');
          const descResult = await describeMedia(filePath, { detailed: true, extractText: true });
          result.aiDescription = descResult;
          
          if (descResult.success) {
            if (extractedText) {
              extractedText += '\n\n[AI Description]: ' + descResult.description;
            } else {
              extractedText = descResult.description;
            }
            processingSteps.push('ai_description_completed');
          }
        }
        
        result.originalContent = extractedText || '[No text extracted from image]';
        break;

      case 'audio':
        if (!options.skipAiDescription && config.mediaProcessing.enabled) {
          processingSteps.push('audio_transcription_started');
          const audioResult = await describeMedia(filePath);
          result.aiDescription = audioResult;
          
          if (audioResult.success) {
            extractedText = audioResult.description;
            processingSteps.push('audio_transcription_completed');
          }
        }
        result.originalContent = extractedText || '[No transcription available]';
        break;

      case 'video':
        if (!options.skipAiDescription && config.mediaProcessing.enabled) {
          processingSteps.push('video_processing_started');
          const videoResult = await describeMedia(filePath, { transcribeAudio: true });
          result.aiDescription = videoResult;
          
          if (videoResult.success) {
            extractedText = videoResult.description;
            processingSteps.push('video_processing_completed');
          }
        }
        result.originalContent = extractedText || '[No content extracted from video]';
        break;

      case 'document':
        if (!options.skipOcr && config.ocr.enabled) {
          processingSteps.push('document_ocr_started');
          const ocrResult = await ocrFile(filePath, { language: options.ocrLanguage });
          result.ocr = ocrResult;
          
          if (ocrResult.success) {
            extractedText = ocrResult.text;
            processingSteps.push('document_ocr_completed');
          }
        }
        result.originalContent = extractedText || '[Could not extract document content]';
        break;
    }

    if (extractedText && extractedText.length >= 10) {
      const langDetection = detectLanguage(extractedText);
      result.detectedLanguage = langDetection.iso1Code;
      processingSteps.push(`language_detected:${langDetection.name}`);
    }

    let finalText = extractedText;
    
    if (!options.skipTranslation && 
        config.translation.enabled && 
        extractedText &&
        result.detectedLanguage && 
        result.detectedLanguage !== 'und' &&
        result.detectedLanguage !== (options.targetLanguage || config.translation.targetLanguage)) {
      
      processingSteps.push('translation_started');
      const translationResult = await translate(extractedText, { targetLanguage: options.targetLanguage });
      result.translation = translationResult;
      
      if (translationResult.success && translationResult.translatedText !== extractedText) {
        finalText = translationResult.translatedText;
        processingSteps.push('translation_completed');
        finalText += `\n\n[Original (${result.detectedLanguage})]: ${extractedText}`;
      }
    }

    result.processedContent = finalText || extractedText || '';
    result.success = result.processedContent.length > 0;
    
  } catch (error) {
    result.error = `Processing failed: ${error instanceof Error ? error.message : String(error)}`;
    processingSteps.push('error');
  }

  result.processingTime = Date.now() - startTime;
  return result;
}

export async function processText(
  text: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const config = getConfig();
  const processingSteps: string[] = ['text_input'];
  
  const result: ProcessingResult = {
    success: false,
    originalContent: text,
    processedContent: text,
    contentType: 'text',
    processingSteps,
    processingTime: 0
  };

  try {
    if (text && text.length >= 10) {
      const langDetection = detectLanguage(text);
      result.detectedLanguage = langDetection.iso1Code;
      processingSteps.push(`language_detected:${langDetection.name}`);
    }

    let finalText = text;
    
    if (!options.skipTranslation && 
        config.translation.enabled && 
        text &&
        result.detectedLanguage && 
        result.detectedLanguage !== 'und' &&
        result.detectedLanguage !== (options.targetLanguage || config.translation.targetLanguage)) {
      
      processingSteps.push('translation_started');
      const translationResult = await translate(text, { targetLanguage: options.targetLanguage });
      result.translation = translationResult;
      
      if (translationResult.success && translationResult.translatedText !== text) {
        finalText = translationResult.translatedText;
        processingSteps.push('translation_completed');
      }
    }

    result.processedContent = finalText;
    result.success = true;
    
  } catch (error) {
    result.error = `Processing failed: ${error instanceof Error ? error.message : String(error)}`;
    processingSteps.push('error');
  }

  result.processingTime = Date.now() - startTime;
  return result;
}

export async function processBase64(
  base64Data: string,
  mimeType: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf'
  };

  const ext = extMap[mimeType] || '.bin';
  const tempPath = `/tmp/beacon-process-${Date.now()}${ext}`;
  
  const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
  fs.writeFileSync(tempPath, Buffer.from(base64Clean, 'base64'));

  try {
    return await processFile(tempPath, options);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

export async function processBatch(
  filePaths: string[],
  options: ProcessingOptions = {}
): Promise<ProcessingResult[]> {
  const config = getConfig();
  const concurrency = config.processingConcurrency || 2;
  const results: ProcessingResult[] = [];

  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(filePath => processFile(filePath, options))
    );
    results.push(...batchResults);
  }

  return results;
}

export function getProcessingStats(results: ProcessingResult[]): {
  total: number;
  successful: number;
  failed: number;
  byContentType: Record<string, number>;
  averageTime: number;
  stepsUsed: Record<string, number>;
} {
  const stats = {
    total: results.length,
    successful: 0,
    failed: 0,
    byContentType: {} as Record<string, number>,
    averageTime: 0,
    stepsUsed: {} as Record<string, number>
  };

  let totalTime = 0;

  for (const result of results) {
    if (result.success) {
      stats.successful++;
    } else {
      stats.failed++;
    }

    stats.byContentType[result.contentType] = (stats.byContentType[result.contentType] || 0) + 1;
    totalTime += result.processingTime;

    for (const step of result.processingSteps) {
      const cleanStep = step.split(':')[0];
      stats.stepsUsed[cleanStep] = (stats.stepsUsed[cleanStep] || 0) + 1;
    }
  }

  stats.averageTime = results.length > 0 ? Math.round(totalTime / results.length) : 0;

  return stats;
}
