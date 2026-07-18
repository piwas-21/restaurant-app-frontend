import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MenuSectionStatus from './MenuSectionStatus';
import type { MenuSectionStatusProps } from './MenuSectionStatus';

const base: MenuSectionStatusProps = {
  headingId: 'category-heading-all',
  title: 'Grills',
  isLoading: false,
  errorMessage: null,
  isEmpty: false,
  loadingMessage: 'Loading items…',
  emptyMessage: 'No items in Grills',
};

describe('MenuSectionStatus (shared default)', () => {
  it('always renders the heading with the given id and title', () => {
    render(<MenuSectionStatus {...base} />);
    expect(screen.getByRole('heading', { name: 'Grills' })).toHaveAttribute('id', 'category-heading-all');
  });

  it('shows the loading message only when loading', () => {
    render(<MenuSectionStatus {...base} isLoading />);
    expect(screen.getByText('Loading items…')).toBeInTheDocument();
  });

  it('shows the error message and NOT the empty message when an error is present', () => {
    render(<MenuSectionStatus {...base} errorMessage="Something broke" isEmpty />);
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.queryByText('No items in Grills')).not.toBeInTheDocument();
  });

  it('shows the empty message only when not loading, no error, and empty', () => {
    render(<MenuSectionStatus {...base} isEmpty />);
    expect(screen.getByText('No items in Grills')).toBeInTheDocument();
  });

  it('shows no status message when there are items (success)', () => {
    render(<MenuSectionStatus {...base} />);
    expect(screen.queryByText('Loading items…')).not.toBeInTheDocument();
    expect(screen.queryByText('No items in Grills')).not.toBeInTheDocument();
  });
});
