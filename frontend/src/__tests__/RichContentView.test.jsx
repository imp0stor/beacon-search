import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('react-markdown', () => ({ children }) => <div>{children}</div>);
jest.mock('remark-gfm', () => ({}));

import RichContentView from '../components/RichContentView';

beforeEach(() => {
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  };

  global.fetch = jest.fn().mockResolvedValue({
    json: async () => ({ contents: '<html><head><meta property="og:title" content="Example Title" /></head></html>' }),
  });

  global.AbortSignal.timeout = () => undefined;
});

afterEach(() => jest.resetAllMocks());

it('supports expand, rich view, tag callback, and collapse', async () => {
  const onTagClick = jest.fn();
  const doc = {
    title: 'Nostr Post',
    content: 'Hello #nostr with link https://example.com',
    source_type: 'nostr',
    created_at: Date.now(),
    tags: ['bitcoin'],
  };

  render(<RichContentView document={doc} onTagClick={onTagClick} />);

  fireEvent.click(screen.getByRole('button', { name: /expand/i }));
  expect(screen.getByRole('button', { name: /show rich view/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /show rich view/i }));
  await waitFor(() => expect(screen.getByText(/example title/i)).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: '#nostr' }));
  expect(onTagClick).toHaveBeenCalledWith('nostr');

  fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
  expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
});
