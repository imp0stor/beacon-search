import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { SubtitleSegment } from './types';

const TIME_REGEX = /(\d{2}:\d{2}:\d{2})[\.,](\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2})[\.,](\d{3})/;

function parseTimestamp(ts: string, ms: string): number {
  const [hh, mm, ss] = ts.split(':').map(v => parseInt(v, 10));
  return ((hh * 3600 + mm * 60 + ss) * 1000) + parseInt(ms, 10);
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSrt(content: string): SubtitleSegment[] {
  const blocks = content.replace(/\r/g, '').split(/\n{2,}/g);
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLine = lines.find(line => TIME_REGEX.test(line));
    if (!timeLine) continue;

    const match = timeLine.match(TIME_REGEX);
    if (!match) continue;

    const startMs = parseTimestamp(match[1], match[2]);
    const endMs = parseTimestamp(match[3], match[4]);
    const textLines = lines.filter(line => line !== timeLine && !/^[0-9]+$/.test(line));
    const text = cleanText(textLines.join(' '));

    if (text) {
      segments.push({ startMs, endMs, text });
    }
  }

  return segments;
}

export function parseVtt(content: string): SubtitleSegment[] {
  const sanitized = content.replace(/\r/g, '').replace(/^WEBVTT[\s\S]*?\n\n/, '');
  const blocks = sanitized.split(/\n{2,}/g);
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLine = lines.find(line => TIME_REGEX.test(line));
    if (!timeLine) continue;

    const match = timeLine.match(TIME_REGEX);
    if (!match) continue;

    const startMs = parseTimestamp(match[1], match[2]);
    const endMs = parseTimestamp(match[3], match[4]);
    const textLines = lines.filter(line => line !== timeLine && !/^[0-9]+$/.test(line));
    const text = cleanText(textLines.join(' '));

    if (text) {
      segments.push({ startMs, endMs, text });
    }
  }

  return segments;
}

export async function fetchSubtitleContent(url: string): Promise<string> {
  if (url.startsWith('file://')) {
    const filePath = url.replace('file://', '');
    return await fs.readFile(filePath, 'utf8');
  }

  if (url.startsWith('/') || url.match(/^[A-Za-z]:\\/)) {
    return await fs.readFile(url, 'utf8');
  }

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch subtitle ${url}: ${response.status}`);
  }
  return await response.text();
}

export async function parseSubtitleFromUrl(url: string, format: 'srt' | 'vtt' | 'auto' = 'auto'): Promise<SubtitleSegment[]> {
  const content = await fetchSubtitleContent(url);
  const ext = path.extname(new URL(url, 'http://local').pathname).toLowerCase();

  const targetFormat = format === 'auto'
    ? (ext === '.vtt' ? 'vtt' : 'srt')
    : format;

  return targetFormat === 'vtt' ? parseVtt(content) : parseSrt(content);
}

export function estimateSegmentDuration(segments: SubtitleSegment[]): number {
  if (!segments.length) return 0;
  return Math.max(...segments.map(seg => seg.endMs));
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(Boolean);
}

export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (!tokensA.size || !tokensB.size) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
