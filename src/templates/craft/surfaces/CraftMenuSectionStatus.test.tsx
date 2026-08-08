import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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
  emptyHeading: 'No dishes here yet',
  errorHeading: 'Unable to load menu',
  retryLabel: 'Retry',
  browseLabel: 'Browse full menu',
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

  /**
   * Craft gets the retry too (S10).
   *
   * The shared props grew four strings and two handlers, and a surface override that destructures a
   * subset silently drops whatever it does not name — so craft would have kept a `role="alert"`
   * ending "Please try again." with nothing to press, which is the exact defect this slice exists
   * to close, surviving on the other template. Pinned rather than assumed, because a dropped prop
   * type-checks perfectly.
   */
  it('offers a retry on error, in craft chrome', () => {
    const onRetry = jest.fn();
    render(<CraftMenuSectionStatus {...base} errorMessage="Something broke" onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers a way out of an empty category', () => {
    const onBrowseFullMenu = jest.fn();
    render(<CraftMenuSectionStatus {...base} isEmpty onBrowseFullMenu={onBrowseFullMenu} />);

    fireEvent.click(screen.getByRole('button', { name: 'Browse full menu' }));
    expect(onBrowseFullMenu).toHaveBeenCalledTimes(1);
  });

  /**
   * The two-line anatomy is classic's, deliberately: craft's states are one hand-written line
   * (craft-stitch-prompts.md Prompt 4). Same information, different skin — the surface-slot
   * contract. Asserted so the omission reads as a decision rather than a forgotten prop.
   */
  it('renders the shared headings nowhere — craft states are one line by design', () => {
    render(<CraftMenuSectionStatus {...base} isEmpty />);
    expect(screen.queryByText('No dishes here yet')).not.toBeInTheDocument();
  });

  it('renders no dead buttons when the host wired no handlers', () => {
    render(<CraftMenuSectionStatus {...base} errorMessage="Something broke" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
