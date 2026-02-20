/**
 * NostrMaxi API Client
 * Fetches Web of Trust scores from NostrMaxi service
 */

import axios, { AxiosInstance } from 'axios';

export interface WoTScore {
  pubkey: string;
  wot_score: number; // 0.0 to 1.0
  hops: number;
  path?: string[];
}

export interface WoTNetwork {
  pubkey: string;
  network: Record<string, number>; // pubkey -> score
}

export class NostrMaxiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: `${baseURL}/api/v1`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get WoT score for a single pubkey
   */
  async getScore(fromPubkey: string, toPubkey: string): Promise<WoTScore | null> {
    try {
      const response = await this.client.get(`/wot/score/${toPubkey}`, {
        params: { from: fromPubkey },
      });
      return response.data;
    } catch (error) {
      console.error(`NostrMaxi API error (getScore):`, error);
      return null;
    }
  }

  /**
   * Get entire trust network for a pubkey
   */
  async getNetwork(pubkey: string): Promise<WoTNetwork | null> {
    try {
      const response = await this.client.get(`/wot/network/${pubkey}`);
      return response.data;
    } catch (error) {
      console.error(`NostrMaxi API error (getNetwork):`, error);
      return null;
    }
  }

  /**
   * Batch lookup WoT scores
   */
  async batchLookup(fromPubkey: string, toPubkeys: string[]): Promise<Map<string, number>> {
    if (toPubkeys.length === 0) {
      return new Map();
    }

    try {
      const response = await this.client.post('/wot/batch', {
        from_pubkey: fromPubkey,
        to_pubkeys: toPubkeys,
      });

      const scores = new Map<string, number>();
      if (response.data && Array.isArray(response.data)) {
        for (const item of response.data) {
          scores.set(item.pubkey, item.wot_score || 0);
        }
      }

      return scores;
    } catch (error) {
      console.error(`NostrMaxi API error (batchLookup):`, error);
      return new Map();
    }
  }

  /**
   * Check if NostrMaxi is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
