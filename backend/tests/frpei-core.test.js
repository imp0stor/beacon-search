const test = require('node:test');
const assert = require('node:assert');

const { createCandidate, dedupeCandidates } = require('../dist/frpei/utils');
const { rankCandidates } = require('../dist/frpei/rank');
const { CircuitBreaker } = require('../dist/frpei/circuit-breaker');

test('dedupeCandidates keeps highest score per URL', () => {
  const base = {
    title: 'Beacon Search',
    url: 'https://example.com/page?utm_source=x',
    snippet: 'Example',
    source: { provider: 'searxng', trustTier: 'low' },
    score: 0.2
  };
  const first = createCandidate(base);
  const second = createCandidate({ ...base, score: 0.9 });

  const deduped = dedupeCandidates([first, second]);
  assert.strictEqual(deduped.length, 1);
  assert.ok(deduped[0].signals.score >= 0.9);
});

test('rankCandidates applies provider weight and canonical boost', () => {
  const beacon = createCandidate({
    title: 'Beacon Doc',
    url: 'https://beacon.local/doc',
    snippet: 'Beacon snippet',
    source: { provider: 'beacon', trustTier: 'high' },
    score: 0.6
  });
  beacon.canonical = {
    conceptId: 'c1',
    preferredTerm: 'Beacon',
    matchedBy: 'term',
    matchedValue: 'beacon',
    confidence: 0.9,
    taxonomies: [],
    provenance: { source: 'ontology', matchedOn: 'beacon', timestamp: new Date().toISOString() }
  };

  const web = createCandidate({
    title: 'Web Doc',
    url: 'https://example.com',
    snippet: 'Web snippet',
    source: { provider: 'searxng', trustTier: 'low' },
    score: 0.8
  });

  const ranked = rankCandidates([web, beacon]);
  assert.strictEqual(ranked[0].source.provider, 'beacon');
  assert.ok(ranked[0].rankScore >= ranked[1].rankScore);
});

test('CircuitBreaker opens after failures', () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 10000 });
  assert.ok(breaker.canRequest());
  breaker.recordFailure();
  assert.ok(breaker.canRequest());
  breaker.recordFailure();
  assert.ok(!breaker.canRequest());
});
