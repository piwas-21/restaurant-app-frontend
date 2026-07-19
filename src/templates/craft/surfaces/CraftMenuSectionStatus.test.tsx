import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CraftMenuSectionStatus from './CraftMenuSectionStatus';
import type { MenuSectionStatusProps } from '@/components/menu/MenuSectionStatus';

const base: MenuSectionStatusProps = {
  headingId: 'category-heading-all',
  title: 'Grills',
  isLoading: false,
  errorMessage: null,
  isEmpty: false,
  loadingMessage: 'Loading items…',
  emptyMessage: 'No items in Grills',
};

describe('CraftMenuSectionStatus', () => {
  it('always renders the heading with the given id and title', () => {
    render(<CraftMenuSectionStatus {...base} />);
    expect(screen.getByRole('heading', { name: 'Grills' })).toHaveAttribute('id', 'category-heading-all');
  });

  it('renders a live status region with the loading text when loading', () => {
    render(<CraftMenuSectionStatus {...base} isLoading loadingMessage="Preparing sides…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Preparing sides…');
  });

  it('renders the error as an alert and NOT the empty state when an error is present', () => {
    render(<CraftMenuSectionStatus {...base} errorMessage="Something broke" isEmpty />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
    expect(screen.queryByText('No items in Grills')).not.toBeInTheDocument();
  });

  it('renders the empty message only when not loading, no error, and empty', () => {
    render(<CraftMenuSectionStatus {...base} isEmpty />);
    expect(screen.getByText('No items in Grills')).toBeInTheDocument();
  });

  it('renders neither a status nor an alert when there are items (success)', () => {
    render(<CraftMenuSectionStatus {...base} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No items in Grills')).not.toBeInTheDocument();
  });
});
