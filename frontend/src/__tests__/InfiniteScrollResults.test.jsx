import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InfiniteScrollResults from '../components/InfiniteScrollResults';

beforeEach(() => {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [{ id: 1, title: 'Result A', content: 'Some content', media_urls: [], tags: ['nostr'], quality_score: 0.7, score: 0.95, url: 'https://example.com' }],
      total: 1,
      hasMore: false,
    }),
  });
});

afterEach(() => jest.resetAllMocks());

it('loads results, renders filters and triggers click callback', async () => {
  const onResultClick = jest.fn();
  render(<InfiniteScrollResults query="nostr" mode="hybrid" filters={{ tags: ['nostr'], minQuality: 0.5, hasMedia: false }} onResultClick={onResultClick} />);

  await waitFor(() => expect(screen.getByText('Result A')).toBeInTheDocument());
  expect(screen.getByText(/1 of 1 results/i)).toBeInTheDocument();
  expect(screen.getByText(/Filtered by 1 tag/i)).toBeInTheDocument();

  fireEvent.click(screen.getByText('Result A'));
  expect(onResultClick).toHaveBeenCalled();
});

it('shows error state when fetch fails and retry button exists', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('boom'));
  render(<InfiniteScrollResults query="x" mode="hybrid" filters={{ tags: [], minQuality: 0.3, hasMedia: false }} onResultClick={jest.fn()} />);

  await waitFor(() => expect(screen.getByText(/failed to load results/i)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
