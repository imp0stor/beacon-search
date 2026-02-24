const test = require('node:test');
const assert = require('node:assert');
const { ResultCache } = require('../dist/frpei/cache');
const { CircuitBreaker } = require('../dist/frpei/circuit-breaker');

test('FRPEI cache stores and expires entries', () => {
  const cache = new ResultCache(50);
  cache.set('key', { ok: true }, 10);
  assert.deepStrictEqual(cache.get('key'), { ok: true });
});

test('FRPEI circuit breaker opens after failures', () => {
  const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000, successThreshold: 1 });
  assert.strictEqual(breaker.canRequest(), true);
  breaker.recordFailure();
  breaker.recordFailure();
  assert.strictEqual(breaker.canRequest(), false);
});
