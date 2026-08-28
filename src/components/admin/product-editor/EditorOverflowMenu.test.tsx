import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import EditorOverflowMenu, { type EditorOverflowAction } from './EditorOverflowMenu';

const onDelete = jest.fn();
const onDuplicate = jest.fn();

const actions: EditorOverflowAction[] = [
  { id: 'duplicate', label: 'Duplicate', onSelect: onDuplicate },
  { id: 'delete', label: 'Delete product', onSelect: onDelete, destructive: true },
];

/** `open()` focuses the first item on the next frame; jsdom needs the callback drained. */
const flushFrame = () => act(() => void jest.advanceTimersByTime(20));

beforeEach(() => {
  onDelete.mockClear();
  onDuplicate.mockClear();
});

const renderMenu = (given = actions) => render(<EditorOverflowMenu actions={given} label="More actions" />);

const trigger = () => screen.getByRole('button', { name: 'More actions' });

describe('EditorOverflowMenu — the ⋯ that holds Delete (frontend #574)', () => {
  it('renders nothing at all when it has no actions', () => {
    const { container } = renderMenu([]);

    // An empty `⋯` that opens an empty menu is worse than no `⋯`. A create route has nothing to delete.
    expect(container).toBeEmptyDOMElement();
  });

  it('names the trigger, because three dots name nothing', () => {
    renderMenu();

    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps every action out of the DOM until it is opened', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();

    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((node) => node.textContent)).toEqual(['Duplicate', 'Delete product']);
  });

  it('runs the action, closes, and hands focus back to the trigger', () => {
    renderMenu();
    fireEvent.click(trigger());

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete product' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('closes on Escape and returns focus, without running anything', () => {
    renderMenu();
    fireEvent.click(trigger());

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Duplicate' }), { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveFocus();
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it('closes when the pointer goes elsewhere', () => {
    render(
      <>
        <EditorOverflowMenu actions={actions} label="More actions" />
        <button type="button">outside</button>
      </>,
    );
    fireEvent.click(trigger());

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('wraps ArrowDown / ArrowUp around the item list', () => {
    renderMenu();
    fireEvent.click(trigger());
    const [first, last] = screen.getAllByRole('menuitem');

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(last).toHaveFocus();
  });
});

describe('EditorOverflowMenu — opening from the keyboard', () => {
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  // `requestAnimationFrame` under fake timers resolves on the next tick jsdom schedules.
  it('ArrowDown opens on the first item, ArrowUp on the last', () => {
    renderMenu();

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    flushFrame();
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();

    fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    flushFrame();
    expect(screen.getAllByRole('menuitem')[1]).toHaveFocus();
  });
});
