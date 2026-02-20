/**
 * Processing API Routes
 * Endpoints for OCR, translation, and AI description
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import {
  getConfig,
  updateConfig,
  ocrFile,
  ocrBase64,
  translate,
  translateBatch,
  detectLanguage,
  describeImage,
  describeImageBase64,
  transcribeAudio,
  processVideo,
  processFile,
  processText,
  processBase64,
  checkTranslationService,
  checkDescriptionServices,
  ProcessingConfig
} from '../processors';

const router = Router();

const storage = multer.diskStorage({
  destination: '/tmp/beacon-uploads',
  filename: (_req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

if (!fs.existsSync('/tmp/beacon-uploads')) {
  fs.mkdirSync('/tmp/beacon-uploads', { recursive: true });
}

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const config = getConfig();
    const translationStatus = await checkTranslationService();
    const descriptionStatus = await checkDescriptionServices();

    res.json({
      config: {
        ocr: { enabled: config.ocr.enabled, language: config.ocr.language, supportedFormats: config.ocr.supportedFormats },
        translation: { enabled: config.translation.enabled, provider: config.translation.provider, targetLanguage: config.translation.targetLanguage, available: translationStatus.available },
        aiDescription: { enabled: config.aiDescription.enabled, imageProvider: config.aiDescription.imageProvider, available: descriptionStatus.image.available },
        mediaProcessing: { enabled: config.mediaProcessing.enabled, whisperProvider: config.mediaProcessing.whisperProvider, available: descriptionStatus.audio.available },
        autoProcess: config.autoProcess,
        maxFileSizeMb: config.maxFileSizeMb
      },
      services: { translation: translationStatus, image: descriptionStatus.image, audio: descriptionStatus.audio }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status', message: error instanceof Error ? error.message : String(error) });
  }
});

router.patch('/config', (req: Request, res: Response) => {
  try {
    const updates = req.body as Partial<ProcessingConfig>;
    const newConfig = updateConfig(updates);
    res.json({ success: true, config: newConfig });
  } catch (error) {
    res.status(400).json({ error: 'Failed to update config', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/ocr', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let result;

    if (req.file) {
      result = await ocrFile(req.file.path, { language: req.body.language, preprocessImage: req.body.preprocess === 'true' });
      fs.unlinkSync(req.file.path);
    } else if (req.body.base64) {
      result = await ocrBase64(req.body.base64, { language: req.body.language });
    } else if (req.body.path) {
      result = await ocrFile(req.body.path, { language: req.body.language, preprocessImage: req.body.preprocess === 'true' });
    } else {
      return res.status(400).json({ error: 'No file, base64, or path provided' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'OCR failed', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text, texts, sourceLanguage, targetLanguage, forceTranslate } = req.body;

    if (texts && Array.isArray(texts)) {
      const results = await translateBatch(texts, { sourceLanguage, targetLanguage, forceTranslate });
      res.json({ results });
    } else if (text) {
      const result = await translate(text, { sourceLanguage, targetLanguage, forceTranslate });
      res.json(result);
    } else {
      res.status(400).json({ error: 'No text provided' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Translation failed', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/detect-language', (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    const result = detectLanguage(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Language detection failed', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/describe', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let result;
    const options = {
      detailed: req.body.detailed === 'true',
      extractText: req.body.extractText === 'true',
      customPrompt: req.body.prompt,
      language: req.body.language,
      timestamps: req.body.timestamps === 'true',
      transcribeAudio: req.body.transcribeAudio !== 'false'
    };

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const audioExts = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];
      const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

      if (imageExts.includes(ext)) {
        result = await describeImage(req.file.path, options);
      } else if (audioExts.includes(ext)) {
        result = await transcribeAudio(req.file.path, options);
      } else if (videoExts.includes(ext)) {
        result = await processVideo(req.file.path, options);
      } else {
        return res.status(400).json({ error: `Unsupported file type: ${ext}` });
      }
      fs.unlinkSync(req.file.path);
    } else if (req.body.base64) {
      result = await describeImageBase64(req.body.base64, options);
    } else if (req.body.path) {
      const ext = path.extname(req.body.path).toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const audioExts = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];
      const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

      if (imageExts.includes(ext)) {
        result = await describeImage(req.body.path, options);
      } else if (audioExts.includes(ext)) {
        result = await transcribeAudio(req.body.path, options);
      } else if (videoExts.includes(ext)) {
        result = await processVideo(req.body.path, options);
      } else {
        return res.status(400).json({ error: `Unsupported file type: ${ext}` });
      }
    } else {
      return res.status(400).json({ error: 'No file, base64, or path provided' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Description generation failed', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/file', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const options = {
      skipOcr: req.body.skipOcr === 'true',
      skipTranslation: req.body.skipTranslation === 'true',
      skipAiDescription: req.body.skipAiDescription === 'true',
      forceOcr: req.body.forceOcr === 'true',
      ocrLanguage: req.body.ocrLanguage,
      targetLanguage: req.body.targetLanguage
    };

    let result;

    if (req.file) {
      result = await processFile(req.file.path, options);
      fs.unlinkSync(req.file.path);
    } else if (req.body.path) {
      result = await processFile(req.body.path, options);
    } else if (req.body.base64 && req.body.mimeType) {
      result = await processBase64(req.body.base64, req.body.mimeType, options);
    } else {
      return res.status(400).json({ error: 'No file, path, or base64+mimeType provided' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'File processing failed', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/text', async (req: Request, res: Response) => {
  try {
    const { text, skipTranslation, targetLanguage } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const result = await processText(text, { skipTranslation, targetLanguage });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Text processing failed', message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
