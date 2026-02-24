import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MediaViewer from '../components/MediaViewer';

describe('MediaViewer', () => {
  const mediaUrls = ['https://example.com/a.jpg', 'https://example.com/b.mp4'];

  it('renders image media and open link', () => {
    render(<MediaViewer mediaUrls={mediaUrls} currentIndex={0} onClose={jest.fn()} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByAltText('Media 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', mediaUrls[0]);
  });

  it('navigates with keyboard and closes on escape', () => {
    const onClose = jest.fn();
    const { container } = render(<MediaViewer mediaUrls={mediaUrls} currentIndex={0} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(container.querySelector('video')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error state when media fails', () => {
    render(<MediaViewer mediaUrls={mediaUrls} currentIndex={0} onClose={jest.fn()} />);
    const img = screen.getByAltText('Media 1');
    fireEvent.error(img);
    expect(screen.getByText(/failed to load media/i)).toBeInTheDocument();
  });
});
