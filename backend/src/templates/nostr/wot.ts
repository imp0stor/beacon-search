/**
 * Web of Trust (WoT) Integration for Nostr
 * Weights search results by WoT scores
 */

import { Event } from 'nostr-tools';

export interface WoTScore {
  pubkey: string;
  score: number; // 0.0 to 1.0
  hops: number; // Degrees of separation
}

export interface WoTGraph {
  follows: Map<string, Set<string>>;
  scores: Map<string, number>;
}

/**
 * Build follow graph from kind:3 contact list events
 */
export function buildFollowGraph(contactLists: Event[]): WoTGraph {
  const follows = new Map<string, Set<string>>();

  for (const event of contactLists) {
    if (event.kind !== 3) continue;

    const follower = event.pubkey;
    const following = new Set<string>();

    for (const tag of event.tags) {
      if (tag[0] === 'p' && tag[1]) {
        following.add(tag[1]);
      }
    }

    follows.set(follower, following);
  }

  return {
    follows,
    scores: new Map(),
  };
}

/**
 * Calculate WoT score for a pubkey from perspective of myPubkey
 * Uses breadth-first search with decay
 */
export function calculateWoTScore(
  targetPubkey: string,
  myPubkey: string,
  graph: WoTGraph,
  maxHops: number = 3
): WoTScore {
  if (targetPubkey === myPubkey) {
    return { pubkey: targetPubkey, score: 1.0, hops: 0 };
  }

  // Check cache
  const cacheKey = `${myPubkey}:${targetPubkey}`;
  if (graph.scores.has(cacheKey)) {
    const score = graph.scores.get(cacheKey)!;
    return { pubkey: targetPubkey, score, hops: score > 0 ? Math.ceil(-Math.log2(score)) : maxHops + 1 };
  }

  // BFS
  const queue: Array<{ pubkey: string; hops: number }> = [{ pubkey: myPubkey, hops: 0 }];
  const visited = new Set<string>();
  const scores = new Map<string, { score: number; hops: number }>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current.pubkey) || current.hops > maxHops) {
      continue;
    }

    visited.add(current.pubkey);

    const following = graph.follows.get(current.pubkey) || new Set();

    for (const followedPubkey of following) {
      if (visited.has(followedPubkey)) continue;

      const newHops = current.hops + 1;
      const newScore = Math.pow(0.5, newHops); // Decay by 50% per hop

      if (!scores.has(followedPubkey) || scores.get(followedPubkey)!.score < newScore) {
        scores.set(followedPubkey, { score: newScore, hops: newHops });
      }

      if (followedPubkey === targetPubkey) {
        // Found target
        const result = scores.get(targetPubkey)!;
        graph.scores.set(cacheKey, result.score);
        return { pubkey: targetPubkey, score: result.score, hops: result.hops };
      }

      if (newHops < maxHops) {
        queue.push({ pubkey: followedPubkey, hops: newHops });
      }
    }
  }

  // Not found in WoT
  const defaultScore = 0.1;
  graph.scores.set(cacheKey, defaultScore);
  return { pubkey: targetPubkey, score: defaultScore, hops: maxHops + 1 };
}

/**
 * Batch calculate WoT scores for multiple pubkeys
 */
export function calculateWoTScores(
  targetPubkeys: string[],
  myPubkey: string,
  graph: WoTGraph,
  maxHops: number = 3
): Map<string, WoTScore> {
  const results = new Map<string, WoTScore>();

  for (const pubkey of targetPubkeys) {
    results.set(pubkey, calculateWoTScore(pubkey, myPubkey, graph, maxHops));
  }

  return results;
}

/**
 * Weight a search result score by WoT
 */
export function applyWoTWeight(
  baseScore: number,
  wotScore: WoTScore,
  wotWeight: number = 0.3 // 30% WoT, 70% relevance
): number {
  return baseScore * (1 - wotWeight) + wotScore.score * wotWeight;
}

/**
 * Filter results by minimum WoT score
 */
export function filterByWoT<T extends { pubkey: string }>(
  items: T[],
  wotScores: Map<string, WoTScore>,
  minScore: number = 0.1
): T[] {
  return items.filter(item => {
    const wot = wotScores.get(item.pubkey);
    return wot && wot.score >= minScore;
  });
}
