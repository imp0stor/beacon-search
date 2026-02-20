import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { pipeline as streamPipeline } from 'stream/promises';
import fetch from 'node-fetch';
import cheerio from 'cheerio';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface TranscriptChunk {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function chunkTranscript(
  transcript: string,
  chunkSize: number = 1200,
  chunkOverlap: number = 200
): TranscriptChunk[] {
  const normalized = transcript.replace(/\r/g, '');
  const paragraphs = normalized.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);

  const chunks: TranscriptChunk[] = [];
  let current = '';
  let startOffset = 0;
  let index = 0;
  let cursor = 0;

  const pushChunk = (text: string, start: number, end: number) => {
    const clean = normalizeText(text);
    if (!clean) return;
    chunks.push({
      index,
      text: clean,
      startOffset: start,
      endOffset: end
    });
    index += 1;
  };

  for (const para of paragraphs) {
    if ((current + ' ' + para).length <= chunkSize) {
      if (!current) {
        startOffset = cursor;
      }
      current = current ? `${current}\n\n${para}` : para;
    } else {
      const endOffset = cursor + current.length;
      pushChunk(current, startOffset, endOffset);

      // overlap: take last chunkOverlap chars from previous chunk
      const overlap = current.slice(Math.max(0, current.length - chunkOverlap));
      current = overlap ? `${overlap}\n\n${para}` : para;
      startOffset = Math.max(0, endOffset - overlap.length);
    }
    cursor += para.length + 2;
  }

  if (current.trim()) {
    const endOffset = cursor + current.length;
    pushChunk(current, startOffset, endOffset);
  }

  return chunks;
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return await response.text();
}

export function extractTranscriptFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside').remove();

  const candidates: { selector: string; text: string }[] = [];

  const transcriptSelectors = [
    '[class*="transcript"]',
    '[id*="transcript"]',
    'article',
    'main'
  ];

  for (const selector of transcriptSelectors) {
    $(selector).each((_idx, el) => {
      const text = normalizeText($(el).text());
      if (text.length > 200) {
        candidates.push({ selector, text });
      }
    });
  }

  if (candidates.length === 0) {
    const bodyText = normalizeText($('body').text());
    return bodyText.length > 500 ? bodyText : null;
  }

  candidates.sort((a, b) => b.text.length - a.text.length);
  return candidates[0].text;
}

export async function extractTranscriptFromUrl(url: string): Promise<string | null> {
  const html = await fetchHtml(url);
  return extractTranscriptFromHtml(html);
}

export async function downloadAudio(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const maxAudioBytes = parseInt(process.env.PODCAST_MAX_AUDIO_BYTES || '500000000', 10);
  if (contentLength && !isNaN(maxAudioBytes) && parseInt(contentLength, 10) > maxAudioBytes) {
    throw new Error(`Audio file too large: ${contentLength} bytes (limit ${maxAudioBytes})`);
  }

  const extFromUrl = path.extname(new URL(audioUrl).pathname) || '.audio';
  const tempPath = path.join(os.tmpdir(), `podcast-audio-${Date.now()}${extFromUrl}`);

  await streamPipeline(response.body as unknown as NodeJS.ReadableStream, fs.createWriteStream(tempPath));
  return tempPath;
}

export async function transcribeAudio(audioPath: string): Promise<string> {
  const scriptPath = process.env.PODCAST_TRANSCRIBE_SCRIPT || `${process.env.HOME}/.openclaw/bin/transcribe-audio.py`;
  const maxChars = process.env.PODCAST_TRANSCRIBE_MAX_CHARS || '200000';

  const { stdout } = await execFileAsync('python3', [scriptPath, audioPath], {
    env: {
      ...process.env,
      TRANSCRIBE_MAX_CHARS: maxChars
    },
    maxBuffer: 1024 * 1024 * 20
  });

  return stdout.trim();
}

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fsPromises.unlink(filePath);
  } catch (_err) {
    // ignore
  }
}
