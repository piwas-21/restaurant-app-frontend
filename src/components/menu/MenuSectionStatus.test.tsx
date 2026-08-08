import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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
  emptyHeading: 'No dishes here yet',
  errorHeading: 'Unable to load menu',
  retryLabel: 'Retry',
  browseLabel: 'Browse full menu',
};

describe('MenuSectionStatus (shared default)', () => {
  it('always renders the heading with the given id and title', () => {
    render(<MenuSectionStatus {...base} />);
    expect(screen.getByRole('heading', { name: 'Grills' })).toHaveAttribute('id', 'category-heading-all');
  });

  /**
   * The message stays where a screen reader can reach it — inside the `<output>` (role="status"),
   * not merely on the page. The skeleton bars beside it are `aria-hidden`, so if the sentence ever
   * moved out of the live region the loading state would announce nothing at all while looking
   * completely fine. That is the failure this asserts against, hence `getByRole` over `getByText`.
   */
  it('announces the loading message from a live region, only when loading', () => {
    render(<MenuSectionStatus {...base} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading items…');
  });

  /**
   * Skeleton ROWS, not a spinner, per the governing screen — and every bar hidden from assistive
   * tech. Counted rather than merely present: a single bar is a spinner by another name, and the
   * three-row shape is what makes the wait read as the list it becomes.
   */
  it('draws decorative skeleton rows while loading', () => {
    const { container } = render(<MenuSectionStatus {...base} isLoading />);
    const skeleton = container.querySelector('[aria-hidden="true"].skeletonList');

    expect(skeleton).toBeInTheDocument();
    expect(skeleton?.querySelectorAll('.skeletonRow')).toHaveLength(3);
  });

  it('shows the error message and NOT the empty message when an error is present', () => {
    render(<MenuSectionStatus {...base} errorMessage="Something broke" isEmpty />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
    expect(screen.queryByText('No items in Grills')).not.toBeInTheDocument();
  });

  /**
   * The slice's reason for existing: `en.json` has promised "Please try again." since long before
   * any control existed to do it, and there was no retry anywhere on the page.
   */
  it('offers a retry that calls back, and pairs the message with a generic heading', () => {
    const onRetry = jest.fn();
    render(<MenuSectionStatus {...base} errorMessage="Something broke" onRetry={onRetry} />);

    expect(screen.getByText('Unable to load menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  /**
   * No handler ⇒ no button, rather than a button that does nothing. The same rule the blocked card
   * (`showAdd={!isBlocked}`) and the locked price editor already follow: a dead control explains
   * less than its absence, and it is still in the tab order.
   */
  it.each([
    ['retry', { errorMessage: 'Something broke' }, /Retry/],
    ['browse', { isEmpty: true }, /Browse full menu/],
  ])('renders no %s button when the host wired no handler', (_label, props, name) => {
    render(<MenuSectionStatus {...base} {...props} />);
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('shows the empty message only when not loading, no error, and empty', () => {
    render(<MenuSectionStatus {...base} isEmpty />);
    expect(screen.getByText('No items in Grills')).toBeInTheDocument();
  });

  /**
   * D5: the button is the only escape from an empty category, "which on RUMI prod is every Combos
   * tab". The generic heading sits above the category-specific sentence rather than replacing it —
   * the screen's two-line anatomy, without discarding the context the existing copy carries.
   */
  it('offers a way out of an empty category, above the category-specific sentence', () => {
    const onBrowseFullMenu = jest.fn();
    render(<MenuSectionStatus {...base} isEmpty onBrowseFullMenu={onBrowseFullMenu} />);

    expect(screen.getByText('No dishes here yet')).toBeInTheDocument();
    expect(screen.getByText('No items in Grills')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Browse full menu/ }));
    expect(onBrowseFullMenu).toHaveBeenCalledTimes(1);
  });

  /**
   * The state's headline is subordinate to the section, not a sibling of it.
   *
   * The section already owns an <h2> (the category name) immediately above, so a second <h2> would
   * announce the empty state as its own section and put a phantom entry in the document outline for
   * every empty category. A <p> was the first fix and it is wrong in the other direction: a screen
   * reader user navigating by heading lands on "Grills" and hears nothing about why it is empty.
   * <h3> is the level that is both subordinate and reachable. The screen uses <h2> in both frames
   * and cannot settle this — those frames carry no section heading above the state.
   */
  it.each([
    ['empty', { isEmpty: true }, 'No dishes here yet'],
    ['error', { errorMessage: 'Something broke' }, 'Unable to load menu'],
  ])('gives the %s state a heading one level BELOW the section', (_label, props, headline) => {
    render(<MenuSectionStatus {...base} {...props} />);
    const headings = screen.getAllByRole('heading');

    expect(headings.map((h) => [h.tagName, h.textContent])).toEqual([
      ['H2', 'Grills'],
      ['H3', headline],
    ]);
  });

  it('shows no status message when there are items (success)', () => {
    render(<MenuSectionStatus {...base} />);
    expect(screen.queryByText('Loading items…')).not.toBeInTheDocument();
    expect(screen.queryByText('No items in Grills')).not.toBeInTheDocument();
  });
});
