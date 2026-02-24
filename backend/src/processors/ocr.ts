/**
 * OCR Service using Tesseract.js
 * Extracts text from images and scanned PDFs
 */

import Tesseract from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getConfig } from './config';

export interface OcrResult {
  success: boolean;
  text: string;
  confidence: number;
  language?: string;
  pageCount?: number;
  error?: string;
}

export interface OcrOptions {
  language?: string;
  preprocessImage?: boolean;
  dpi?: number;
}

let worker: Tesseract.Worker | null = null;
let workerLanguage: string = 'eng';

async function getWorker(language: string): Promise<Tesseract.Worker> {
  if (worker && workerLanguage === language) {
    return worker;
  }

  if (worker) {
    await worker.terminate();
  }

  console.log(`[OCR] Initializing Tesseract worker for language: ${language}`);
  worker = await Tesseract.createWorker(language);
  workerLanguage = language;
  
  return worker;
}

async function preprocessImage(inputPath: string): Promise<Buffer> {
  const image = sharp(inputPath);
  
  return image
    .greyscale()
    .normalize()
    .sharpen()
    .threshold(128)
    .toBuffer();
}

export function isImageFile(filePath: string): boolean {
  const config = getConfig();
  const ext = path.extname(filePath).toLowerCase();
  return config.ocr.supportedFormats.includes(ext) && ext !== '.pdf';
}

export function isPdfFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf';
}

export async function ocrImage(
  input: string | Buffer,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const config = getConfig();
  
  if (!config.ocr.enabled) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: 'OCR is disabled in configuration'
    };
  }

  try {
    const language = options.language || config.ocr.language;
    const tesseractWorker = await getWorker(language);

    let imageData: string | Buffer = input;

    if (options.preprocessImage && typeof input === 'string' && fs.existsSync(input)) {
      imageData = await preprocessImage(input);
    }

    console.log(`[OCR] Processing image with language: ${language}`);
    const result = await tesseractWorker.recognize(imageData);

    return {
      success: true,
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      language: language
    };
  } catch (error) {
    console.error('[OCR] Error:', error);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function ocrPdf(
  pdfPath: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const config = getConfig();
  
  if (!config.ocr.enabled) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: 'OCR is disabled in configuration'
    };
  }

  try {
    // Try to extract text from PDF first
    const pdfParse = await import('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse.default(dataBuffer);
    
    if (data.text && data.text.trim().length > 50) {
      return {
        success: true,
        text: data.text.trim(),
        confidence: 100,
        pageCount: data.numpages
      };
    }
    
    // PDF has no text - would need image conversion for OCR
    return {
      success: false,
      text: data.text?.trim() || '',
      confidence: 0,
      pageCount: data.numpages,
      error: 'PDF contains no extractable text. Image-based OCR not yet implemented.'
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: `PDF processing failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function ocrFile(
  filePath: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: `File not found: ${filePath}`
    };
  }

  if (isPdfFile(filePath)) {
    return ocrPdf(filePath, options);
  } else if (isImageFile(filePath)) {
    return ocrImage(filePath, options);
  } else {
    return {
      success: false,
      text: '',
      confidence: 0,
      error: `Unsupported file format: ${path.extname(filePath)}`
    };
  }
}

export async function ocrBase64(
  base64Data: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  return ocrImage(buffer, options);
}

export async function cleanup(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
