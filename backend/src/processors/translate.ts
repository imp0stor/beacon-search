/**
 * Translation Service
 * Language detection and translation with offline-first approach
 */

import { franc } from 'franc';
import { getConfig } from './config';

export interface TranslationResult {
  success: boolean;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  detectedLanguageName: string;
  targetLanguage: string;
  confidence: number;
  provider: string;
  error?: string;
}

export interface TranslationOptions {
  sourceLanguage?: string;
  targetLanguage?: string;
  forceTranslate?: boolean;
}

const iso3to1: Record<string, string> = {
  'eng': 'en', 'deu': 'de', 'fra': 'fr', 'spa': 'es', 'ita': 'it',
  'por': 'pt', 'rus': 'ru', 'jpn': 'ja', 'zho': 'zh', 'kor': 'ko',
  'ara': 'ar', 'hin': 'hi', 'nld': 'nl', 'pol': 'pl', 'swe': 'sv'
};

const langNames: Record<string, string> = {
  'en': 'English', 'de': 'German', 'fr': 'French', 'es': 'Spanish',
  'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
  'zh': 'Chinese', 'ko': 'Korean', 'ar': 'Arabic', 'hi': 'Hindi'
};

export function detectLanguage(text: string): { 
  code: string; 
  iso1Code: string;
  name: string; 
  confidence: number 
} {
  if (!text || text.length < 10) {
    return { code: 'und', iso1Code: 'und', name: 'Unknown', confidence: 0 };
  }

  const detected = franc(text);
  
  if (detected === 'und') {
    return { code: 'und', iso1Code: 'und', name: 'Unknown', confidence: 0 };
  }

  const iso1Code = iso3to1[detected] || detected;
  const name = langNames[iso1Code] || detected;
  const confidence = Math.min(100, 50 + text.length / 10);

  return { code: detected, iso1Code, name, confidence };
}

async function translateWithOllama(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<{ success: boolean; text: string; error?: string }> {
  const config = getConfig();
  const url = config.translation.ollamaUrl || 'http://localhost:11434';
  const model = config.translation.ollamaModel || 'llama3.2';

  const sourceName = langNames[sourceLang] || sourceLang;
  const targetName = langNames[targetLang] || targetLang;

  const prompt = `Translate the following text from ${sourceName} to ${targetName}. Output ONLY the translation, nothing else.\n\nText to translate:\n${text}`;

  try {
    const response = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.3 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, text: '', error: `Ollama error: ${errorText}` };
    }

    const data = await response.json() as { response: string };
    return { success: true, text: data.response.trim() };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: `Ollama connection failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function translate(
  text: string,
  options: TranslationOptions = {}
): Promise<TranslationResult> {
  const config = getConfig();
  
  if (!config.translation.enabled || config.translation.provider === 'none') {
    return {
      success: false,
      originalText: text,
      translatedText: text,
      detectedLanguage: 'und',
      detectedLanguageName: 'Unknown',
      targetLanguage: options.targetLanguage || config.translation.targetLanguage,
      confidence: 0,
      provider: 'none',
      error: 'Translation is disabled'
    };
  }

  let detectedLang = { code: 'und', iso1Code: 'und', name: 'Unknown', confidence: 0 };
  
  if (options.sourceLanguage) {
    detectedLang = {
      code: options.sourceLanguage,
      iso1Code: options.sourceLanguage,
      name: langNames[options.sourceLanguage] || options.sourceLanguage,
      confidence: 100
    };
  } else {
    detectedLang = detectLanguage(text);
  }

  const targetLang = options.targetLanguage || config.translation.targetLanguage;

  if (!options.forceTranslate && detectedLang.iso1Code === targetLang) {
    return {
      success: true,
      originalText: text,
      translatedText: text,
      detectedLanguage: detectedLang.iso1Code,
      detectedLanguageName: detectedLang.name,
      targetLanguage: targetLang,
      confidence: detectedLang.confidence,
      provider: 'none'
    };
  }

  const result = await translateWithOllama(text, detectedLang.iso1Code, targetLang);

  return {
    success: result.success,
    originalText: text,
    translatedText: result.success ? result.text : text,
    detectedLanguage: detectedLang.iso1Code,
    detectedLanguageName: detectedLang.name,
    targetLanguage: targetLang,
    confidence: detectedLang.confidence,
    provider: 'ollama',
    error: result.error
  };
}

export async function translateBatch(
  texts: string[],
  options: TranslationOptions = {}
): Promise<TranslationResult[]> {
  return Promise.all(texts.map(text => translate(text, options)));
}

export async function checkTranslationService(): Promise<{
  available: boolean;
  provider: string;
  error?: string
}> {
  const config = getConfig();
  
  if (!config.translation.enabled || config.translation.provider === 'none') {
    return { available: false, provider: 'none', error: 'Translation disabled' };
  }

  const result = await translate('Hello world', { 
    sourceLanguage: 'en',
    targetLanguage: 'es',
    forceTranslate: true
  });

  return {
    available: result.success,
    provider: config.translation.provider,
    error: result.error
  };
}
