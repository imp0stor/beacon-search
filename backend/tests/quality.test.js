const test = require('node:test');
const assert = require('node:assert');

const {
  calculateQualityScore,
  extractMediaUrls,
  extractTitle,
  isSpam,
  meetsQualityThreshold
} = require('../dist/services/quality');

test('extractMediaUrls handles JSON, markdown, and dedupes', () => {
  const content = 'See ![img](https://example.com/a.jpg) and https://example.com/a.jpg and https://example.com/video.mp4';
  const media = extractMediaUrls(content);
  assert.strictEqual(media.hasMedia, true);
  assert.strictEqual(media.urls.length, 2);
});

test('calculateQualityScore returns bounded score', () => {
  const score = calculateQualityScore('Useful Beacon Update', 'word '.repeat(120), new Date(), { likes: 10, reposts: 2 });
  assert.ok(score >= 0 && score <= 1);
  assert.ok(score > 0.5);
});

test('extractTitle uses best available source', () => {
  const title = extractTitle('', 'First line title\nsecond line', 'https://example.com/path', { title: 'Metadata Title' });
  assert.strictEqual(title, 'Metadata Title');
});

test('spam and threshold checks behave as expected', () => {
  assert.strictEqual(isSpam('Buy now!!!', 'Limited time free money'), true);
  assert.strictEqual(meetsQualityThreshold(0.6, 0.5), true);
  assert.strictEqual(meetsQualityThreshold(0.4, 0.5), false);
});
