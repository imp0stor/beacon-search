/**
 * AI Description Service
 * Generate descriptions for images, audio, and video
 */

import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config';

export interface DescriptionResult {
  success: boolean;
  description: string;
  mediaType: 'image' | 'audio' | 'video';
  provider: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ImageDescriptionOptions {
  detailed?: boolean;
  extractText?: boolean;
  customPrompt?: string;
}

export interface AudioTranscriptionOptions {
  language?: string;
  timestamps?: boolean;
}

export interface VideoProcessingOptions {
  frameInterval?: number;
  maxFrames?: number;
  transcribeAudio?: boolean;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.wmv'];

export function getMediaType(filePath: string): 'image' | 'audio' | 'video' | 'unknown' {
  const ext = path.extname(filePath).toLowerCase();
  
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'unknown';
}

async function describeImageWithOllama(
  imagePath: string,
  options: ImageDescriptionOptions = {}
): Promise<{ success: boolean; description: string; error?: string }> {
  const config = getConfig();
  const url = config.aiDescription.ollamaUrl || 'http://localhost:11434';
  const model = config.aiDescription.ollamaVisionModel || 'llava';

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    let prompt = options.customPrompt || 
      (options.detailed
        ? 'Describe this image in detail. Include objects, colors, scene, mood, and any text visible.'
        : 'Briefly describe what you see in this image.');
    
    if (options.extractText) {
      prompt += ' Also extract any text that is visible in the image.';
    }

    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images: [base64Image],
        stream: false,
        options: { temperature: 0.5 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, description: '', error: `Ollama error: ${errorText}` };
    }

    const data = await response.json() as { response: string };
    return { success: true, description: data.response.trim() };
  } catch (error) {
    return {
      success: false,
      description: '',
      error: `Ollama vision failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function describeImage(
  imagePath: string,
  options: ImageDescriptionOptions = {}
): Promise<DescriptionResult> {
  const config = getConfig();

  if (!config.aiDescription.enabled || config.aiDescription.imageProvider === 'none') {
    return {
      success: false,
      description: '',
      mediaType: 'image',
      provider: 'none',
      error: 'AI description is disabled'
    };
  }

  if (!fs.existsSync(imagePath)) {
    return {
      success: false,
      description: '',
      mediaType: 'image',
      provider: 'none',
      error: `File not found: ${imagePath}`
    };
  }

  const result = await describeImageWithOllama(imagePath, options);

  return {
    success: result.success,
    description: result.description,
    mediaType: 'image',
    provider: 'ollama',
    error: result.error
  };
}

export async function transcribeAudio(
  audioPath: string,
  options: AudioTranscriptionOptions = {}
): Promise<DescriptionResult> {
  const config = getConfig();

  if (!config.mediaProcessing.enabled || config.mediaProcessing.whisperProvider === 'none') {
    return {
      success: false,
      description: '',
      mediaType: 'audio',
      provider: 'none',
      error: 'Audio processing is disabled'
    };
  }

  if (!fs.existsSync(audioPath)) {
    return {
      success: false,
      description: '',
      mediaType: 'audio',
      provider: 'none',
      error: `File not found: ${audioPath}`
    };
  }

  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.cacheDir = '/tmp/transformers-cache';
    
    const modelName = config.mediaProcessing.whisperModelPath || 'Xenova/whisper-small';
    console.log(`[Whisper] Loading model: ${modelName}`);
    
    const transcriber = await pipeline('automatic-speech-recognition', modelName);
    
    const result = await transcriber(audioPath, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: options.language || 'english',
      task: 'transcribe',
      return_timestamps: options.timestamps
    });

    const text = Array.isArray(result) 
      ? result.map((r: any) => r.text).join(' ')
      : (result as any).text;

    return {
      success: true,
      description: text.trim(),
      mediaType: 'audio',
      provider: 'local'
    };
  } catch (error) {
    return {
      success: false,
      description: '',
      mediaType: 'audio',
      provider: 'local',
      error: `Whisper failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function processVideo(
  videoPath: string,
  options: VideoProcessingOptions = {}
): Promise<DescriptionResult> {
  const config = getConfig();

  if (!config.mediaProcessing.enabled) {
    return {
      success: false,
      description: '',
      mediaType: 'video',
      provider: 'none',
      error: 'Media processing is disabled'
    };
  }

  // Video processing requires ffmpeg - simplified for now
  return {
    success: false,
    description: '',
    mediaType: 'video',
    provider: 'none',
    error: 'Video processing not yet implemented'
  };
}

export async function describeMedia(
  filePath: string,
  options: ImageDescriptionOptions & AudioTranscriptionOptions & VideoProcessingOptions = {}
): Promise<DescriptionResult> {
  const mediaType = getMediaType(filePath);

  switch (mediaType) {
    case 'image':
      return describeImage(filePath, options);
    case 'audio':
      return transcribeAudio(filePath, options);
    case 'video':
      return processVideo(filePath, options);
    default:
      return {
        success: false,
        description: '',
        mediaType: 'image',
        provider: 'none',
        error: `Unsupported file type: ${path.extname(filePath)}`
      };
  }
}

export async function describeImageBase64(
  base64Data: string,
  options: ImageDescriptionOptions = {}
): Promise<DescriptionResult> {
  const tempPath = `/tmp/beacon-image-${Date.now()}.jpg`;
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(tempPath, Buffer.from(base64Clean, 'base64'));

  try {
    return await describeImage(tempPath, options);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

export async function checkServices(): Promise<{
  image: { available: boolean; provider: string; error?: string };
  audio: { available: boolean; provider: string; error?: string };
}> {
  const config = getConfig();

  const imageCheck = { 
    available: false, 
    provider: config.aiDescription.imageProvider,
    error: undefined as string | undefined
  };
  
  const audioCheck = { 
    available: false, 
    provider: config.mediaProcessing.whisperProvider,
    error: undefined as string | undefined
  };

  if (config.aiDescription.enabled && config.aiDescription.imageProvider === 'ollama') {
    try {
      const response = await fetch(`${config.aiDescription.ollamaUrl}/api/tags`);
      imageCheck.available = response.ok;
    } catch (e) {
      imageCheck.error = e instanceof Error ? e.message : String(e);
    }
  }

  if (config.mediaProcessing.enabled && config.mediaProcessing.whisperProvider === 'local') {
    try {
      await import('@xenova/transformers');
      audioCheck.available = true;
    } catch (e) {
      audioCheck.error = e instanceof Error ? e.message : String(e);
    }
  }

  return { image: imageCheck, audio: audioCheck };
}
