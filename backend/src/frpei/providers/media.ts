import { MediaService } from '../../media/service';
import { MediaSearchRequest, MediaType } from '../../media/types';
import { FrpeiRetrieveRequest } from '../types';
import { createCandidate, mapDocumentTypeToContentType, truncateSnippet } from '../utils';
import { FrpeiProvider, ProviderContext, ProviderSearchResult } from './provider';

export class MediaProvider implements FrpeiProvider {
  name = 'media' as const;
  trustTier: 'medium' = 'medium';
  weight = 0.85;
  timeoutMs: number;
  private service: MediaService | null = null;

  constructor(options?: { timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? Number(process.env.MEDIA_TIMEOUT_MS || 2000);
  }

  async search(request: FrpeiRetrieveRequest, context: ProviderContext): Promise<ProviderSearchResult> {
    if (!this.service) {
      this.service = new MediaService(context.pool, context.generateEmbedding);
    }

    const limit = request.limit ?? 10;
    const types = (request.types || []).filter(t => ['podcast', 'tv', 'movie'].includes(t)) as MediaType[];
    const payload: MediaSearchRequest = {
      query: request.query,
      limit,
      mode: request.mode || 'hybrid',
      types: types.length ? types : undefined
    };

    const result = await this.service.search(payload);

    const items = result.results.map((row: any, index: number) =>
      createCandidate({
        title: row.title,
        url: row.url,
        snippet: truncateSnippet(row.content),
        contentType: mapDocumentTypeToContentType(row.document_type),
        score: Number(row.score || 0),
        rank: index + 1,
        source: {
          provider: this.name,
          providerRef: row.id,
          trustTier: this.trustTier
        },
        metadata: {
          documentId: row.id,
          documentType: row.document_type,
          attributes: row.attributes || {}
        }
      })
    );

    return {
      provider: this.name,
      items,
      raw: { count: result.results.length }
    };
  }
}
