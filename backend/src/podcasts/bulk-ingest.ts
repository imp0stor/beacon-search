#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { pipeline, env } from '@xenova/transformers';
import { PodcastService } from './service';
import { PodcastIngestSource } from './types';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

env.cacheDir = '/tmp/transformers-cache';

interface BulkIngestCheckpointSource {
  title?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
  lastRunId?: string;
  lastUpdatedAt?: string;
  result?: any;
}

interface BulkIngestCheckpoint {
  startedAt: string;
  updatedAt: string;
  options: Record<string, any>;
  totals: {
    sourcesTotal: number;
    sourcesCompleted: number;
    sourcesFailed: number;
    episodesDiscovered: number;
    episodesUpdated: number;
    transcriptsCreated: number;
    transcriptsTranscribed: number;
  };
  sources: Record<string, BulkIngestCheckpointSource>;
}

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const args: Record<string, string | boolean> = {};

  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (!token.startsWith('--')) continue;

    const key = token.replace(/^--/, '');
    const next = rawArgs[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  if (args['no-resume']) {
    args['resume'] = false;
  }

  return args;
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadSeedSources(seedFile: string): PodcastIngestSource[] {
  const raw = fs.readFileSync(seedFile, 'utf-8');
  const payload = JSON.parse(raw);
  const list = Array.isArray(payload) ? payload : payload.sources;
  if (!Array.isArray(list)) {
    throw new Error(`Seed file ${seedFile} must contain an array or { sources: [] }`);
  }

  return list
    .map((item: any) => ({
      rssUrl: item.rssUrl,
      title: item.title,
      siteUrl: item.siteUrl,
      transcriptPages: item.transcriptPages,
      episodePages: item.episodePages,
      transcriptUrlByEpisode: item.transcriptUrlByEpisode
    }))
    .filter((item: PodcastIngestSource) => !!item.rssUrl);
}

async function main() {
  const args = parseArgs();

  const seedFile =
    (args['seed-file'] as string) ||
    path.resolve(__dirname, '../../../docs/podcasts/seed-sources-2026-02-16.json');
  const checkpointFile =
    (args['checkpoint'] as string) ||
    path.resolve(__dirname, '../../../docs/status/podcast-bulk-ingest-checkpoint.json');
  const stopFile =
    (args['stop-file'] as string) ||
    path.resolve(__dirname, '../../../docs/status/podcast-bulk-ingest.stop');

  const batchSize = parseInt((args['batch-size'] as string) || '5', 10);
  const maxEpisodes = parseInt((args['max-episodes'] as string) || '10', 10);
  const maxSources = parseInt((args['max-sources'] as string) || '0', 10);
  const maxRetries = parseInt((args['max-retries'] as string) || '2', 10);
  const sleepMs = parseInt((args['sleep-ms'] as string) || '800', 10);
  const chunkSize = parseInt((args['chunk-size'] as string) || '1200', 10);
  const chunkOverlap = parseInt((args['chunk-overlap'] as string) || '200', 10);
  const maxTranscriptions = parseInt((args['max-transcriptions'] as string) || '20', 10);
  const maxTranscriptionsPerSource = parseInt((args['max-transcriptions-per-source'] as string) || '2', 10);
  const resume = args['resume'] !== false;
  const transcribeMissing = args['transcribe-missing'] !== false;
  const forceReindex = args['force-reindex'] === true;

  const seedSources = loadSeedSources(seedFile);
  const deduped: PodcastIngestSource[] = [];
  const seen = new Set<string>();

  for (const source of seedSources) {
    const key = source.rssUrl.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }

  const sources = maxSources > 0 ? deduped.slice(0, maxSources) : deduped;

  let checkpoint: BulkIngestCheckpoint | null = null;
  if (resume && fs.existsSync(checkpointFile)) {
    checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
  }

  if (!checkpoint) {
    checkpoint = {
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      options: {
        seedFile,
        batchSize,
        maxEpisodes,
        maxSources: maxSources || null,
        maxRetries,
        sleepMs,
        chunkSize,
        chunkOverlap,
        maxTranscriptions,
        maxTranscriptionsPerSource,
        transcribeMissing,
        forceReindex
      },
      totals: {
        sourcesTotal: sources.length,
        sourcesCompleted: 0,
        sourcesFailed: 0,
        episodesDiscovered: 0,
        episodesUpdated: 0,
        transcriptsCreated: 0,
        transcriptsTranscribed: 0
      },
      sources: {}
    };
  }

  const db = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://beacon:beacon_secret@localhost:5432/beacon_search'
  });

  let embedder: any = null;
  async function generateEmbedding(text: string): Promise<number[]> {
    if (!embedder) {
      console.log('[PodcastBulk] Loading embedding model...');
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('[PodcastBulk] Embedding model ready.');
    }
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  const service = new PodcastService(db, generateEmbedding);

  const runStartedAt = new Date();
  let transcriptionsRemaining = maxTranscriptions;

  const updateCheckpoint = () => {
    if (!checkpoint) return;
    checkpoint.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
    fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2));
  };

  const processSource = async (source: PodcastIngestSource, index: number) => {
    const key = source.rssUrl.trim();
    const existing = checkpoint?.sources[key];

    if (existing?.status === 'completed') {
      return;
    }

    if (fs.existsSync(stopFile)) {
      console.log(`[PodcastBulk] Stop file detected at ${stopFile}. Halting after checkpoint.`);
      updateCheckpoint();
      process.exit(0);
    }

    const attempts = existing?.attempts || 0;
    if (attempts >= maxRetries + 1) {
      console.log(`[PodcastBulk] Skipping ${key} (attempts exhausted).`);
      return;
    }

    const allowedTranscriptions = Math.max(0, Math.min(transcriptionsRemaining, maxTranscriptionsPerSource));
    const allowTranscribe = transcribeMissing && allowedTranscriptions > 0;

    const sourceState: BulkIngestCheckpointSource = {
      title: source.title,
      status: 'running',
      attempts: attempts + 1,
      lastUpdatedAt: new Date().toISOString()
    };

    checkpoint!.sources[key] = sourceState;
    updateCheckpoint();

    try {
      const [result] = await service.ingest({
        sources: [source],
        transcribeMissing: allowTranscribe,
        maxEpisodes,
        maxTranscriptions: allowedTranscriptions,
        maxTranscriptionsPerSource: allowedTranscriptions,
        chunkSize,
        chunkOverlap,
        forceReindex
      });

      sourceState.status = 'completed';
      sourceState.lastRunId = result.runId;
      sourceState.result = result;
      sourceState.lastUpdatedAt = new Date().toISOString();

      checkpoint!.totals.sourcesCompleted += 1;
      checkpoint!.totals.episodesDiscovered += result.episodesDiscovered;
      checkpoint!.totals.episodesUpdated += result.episodesUpdated;
      checkpoint!.totals.transcriptsCreated += result.transcriptsCreated;
      checkpoint!.totals.transcriptsTranscribed += result.transcriptsTranscribed;

      transcriptionsRemaining = Math.max(0, transcriptionsRemaining - result.transcriptsTranscribed);

      console.log(
        `[PodcastBulk] ${index + 1}/${sources.length} ${result.title} -> ` +
          `${result.episodesDiscovered} episodes, ${result.transcriptsCreated} transcripts ` +
          `(transcribed ${result.transcriptsTranscribed}). Remaining transcriptions: ${transcriptionsRemaining}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sourceState.status = 'failed';
      sourceState.lastError = message;
      sourceState.lastUpdatedAt = new Date().toISOString();

      checkpoint!.totals.sourcesFailed += 1;

      console.error(`[PodcastBulk] Failed ${key}: ${message}`);

      if (attempts + 1 <= maxRetries) {
        const backoff = Math.min(10000, 1000 * Math.pow(2, attempts));
        console.log(`[PodcastBulk] Retrying ${key} after ${backoff}ms...`);
        await sleep(backoff);
        return processSource(source, index);
      }
    } finally {
      updateCheckpoint();
    }
  };

  try {
    await db.query('SELECT NOW()');
    console.log('[PodcastBulk] Database connected.');

    for (let i = 0; i < sources.length; i += 1) {
      await processSource(sources[i], i);

      if ((i + 1) % batchSize === 0) {
        console.log(`[PodcastBulk] Batch ${(i + 1) / batchSize} complete. Checkpoint updated.`);
        updateCheckpoint();
      }

      await sleep(sleepMs);
    }

    const chunkResult = await db.query(
      `SELECT COUNT(*) as count FROM documents
       WHERE document_type = 'podcast_transcript_chunk'
         AND created_at >= $1`,
      [runStartedAt]
    );

    const chunkCount = parseInt(chunkResult.rows[0]?.count || '0', 10);
    console.log(`[PodcastBulk] Newly indexed chunks since ${runStartedAt.toISOString()}: ${chunkCount}`);

    updateCheckpoint();
  } catch (error) {
    console.error('[PodcastBulk] Fatal error:', error);
    updateCheckpoint();
    process.exit(1);
  } finally {
    await db.end();
  }
}

process.on('SIGINT', () => {
  console.log('\n[PodcastBulk] SIGINT received. Exiting gracefully.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[PodcastBulk] SIGTERM received. Exiting gracefully.');
  process.exit(0);
});

main();
