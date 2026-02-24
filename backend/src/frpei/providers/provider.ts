import { Pool } from 'pg';
import { FrpeiRetrieveRequest, FrpeiCandidate, ProviderName, TrustTier } from '../types';

export interface ProviderContext {
  pool: Pool;
  generateEmbedding: (text: string) => Promise<number[]>;
}

export interface ProviderSearchResult {
  provider: ProviderName;
  items: FrpeiCandidate[];
  warnings?: string[];
  raw?: any;
}

export interface FrpeiProvider {
  name: ProviderName;
  trustTier: TrustTier;
  weight: number;
  timeoutMs: number;
  search(request: FrpeiRetrieveRequest, context: ProviderContext): Promise<ProviderSearchResult>;
}
