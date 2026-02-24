import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagFilterSidebar from '../components/TagFilterSidebar';

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (url.toString().includes('/api/tags/categories')) {
      return Promise.resolve({ ok: true, json: async () => ({ categories: [{ category: 'topic', tag_count: 2 }] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ tags: [{ name: 'nostr', count: 12, category: 'topic' }] }) });
  });
});

afterEach(() => jest.resetAllMocks());

it('loads tag data and handles filter interactions', async () => {
  const onTagToggle = jest.fn();
  const onClearFilters = jest.fn();
  const onMinQualityChange = jest.fn();
  const onShowMediaOnlyChange = jest.fn();

  render(
    <TagFilterSidebar
      selectedTags={['nostr', 'bitcoin']}
      onTagToggle={onTagToggle}
      onClearFilters={onClearFilters}
      minQuality={0.6}
      onMinQualityChange={onMinQualityChange}
      showMediaOnly={true}
      onShowMediaOnlyChange={onShowMediaOnlyChange}
    />
  );

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  fireEvent.click(screen.getByText('Clear All'));
  expect(onClearFilters).toHaveBeenCalled();

  fireEvent.click(screen.getAllByText('nostr')[0]);
  expect(onTagToggle).toHaveBeenCalledWith('nostr');

  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.8' } });
  expect(onMinQualityChange).toHaveBeenCalledWith(0.8);

  fireEvent.click(screen.getByRole('checkbox'));
  expect(onShowMediaOnlyChange).toHaveBeenCalledWith(false);
});
