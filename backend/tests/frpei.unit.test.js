const test = require('node:test');
const assert = require('node:assert');
const { createCandidate, dedupeCandidates } = require('../dist/frpei/utils');
const { rankCandidates } = require('../dist/frpei/rank');

test('FRPEI dedupe keeps highest score', () => {
  const first = createCandidate({
    title: 'Example Result',
    url: 'https://example.com/article?utm_source=test',
    snippet: 'First',
    source: { provider: 'searxng', trustTier: 'low' },
    score: 0.4
  });
  const second = createCandidate({
    title: 'Example Result',
    url: 'https://example.com/article',
    snippet: 'Second',
    source: { provider: 'beacon', trustTier: 'high' },
    score: 0.8
  });

  const deduped = dedupeCandidates([first, second]);
  assert.strictEqual(deduped.length, 1);
  assert.strictEqual(deduped[0].signals.score, 0.8);
});

test('FRPEI ranking orders by score + boosts', () => {
  const low = createCandidate({
    title: 'Low Score',
    url: 'https://low.example.com',
    snippet: 'Low',
    source: { provider: 'searxng', trustTier: 'low' },
    score: 0.2
  });
  const high = createCandidate({
    title: 'High Score',
    url: 'https://high.example.com',
    snippet: 'High',
    source: { provider: 'beacon', trustTier: 'high' },
    score: 0.9
  });

  const ranked = rankCandidates([low, high]);
  assert.strictEqual(ranked[0].title, 'High Score');
  assert.strictEqual(ranked[0].rank, 1);
  assert.strictEqual(ranked[1].rank, 2);
  assert.ok(ranked[0].explanation);
});
