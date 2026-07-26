import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductOrderTypes from './ProductOrderTypes';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const values = (typeof fallback === 'string' ? options : fallback) as Record<string, unknown> | undefined;
      const text = typeof fallback === 'string' ? fallback : key;
      if (!values) return text;
      return Object.entries(values).reduce((acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)), text);
    },
  }),
}));

const DURUM = { id: 'c1', name: 'Dürüm Wraps', availableOrderTypes: 6 };
const GRILLS = { id: 'c2', name: 'Grills', availableOrderTypes: null };

const renderControl = (props: Partial<React.ComponentProps<typeof ProductOrderTypes>> = {}) => {
  const onChange = jest.fn();
  render(
    <ProductOrderTypes
      value={null}
      onChange={onChange}
      categories={[DURUM, GRILLS]}
      primaryCategoryId="c1"
      {...props}
    />,
  );
  return { onChange };
};

const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe('ProductOrderTypes', () => {
  it('names the primary category and the channels an inheriting item would get', () => {
    renderControl();

    expect(screen.getByText('Inherit from category (Dürüm Wraps: Takeaway, Delivery)')).toBeInTheDocument();
  });

  it('previews the inherited set on disabled boxes so switching to Custom starts from it', () => {
    renderControl();

    expect(box('Takeaway').checked).toBe(true);
    expect(box('Delivery').checked).toBe(true);
    expect(box('Dine In').checked).toBe(false);
    expect(box('Dine In').disabled).toBe(true);
  });

  it('seeds Custom with the inherited mask rather than an empty selection', () => {
    const { onChange } = renderControl();

    fireEvent.click(screen.getByLabelText('Custom', { selector: 'input' }));

    // 6 = takeaway|delivery, the set that was already in force.
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('sends an explicit all-three override as 7, NOT as null', () => {
    // The trap: `maskFromOrderTypes` collapses a full set to null, which on a product means
    // "inherit" — silently handing the item back to its takeaway-only category.
    const { onChange } = renderControl({ value: 6 });

    fireEvent.click(box('Dine In'));

    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('switching back to Inherit clears the mask', () => {
    const { onChange } = renderControl({ value: 2 });

    fireEvent.click(screen.getByLabelText('Inherit from category (Dürüm Wraps: Takeaway, Delivery)'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('warns when there is no primary category to inherit from', () => {
    renderControl({ primaryCategoryId: '' });

    expect(screen.getByText(/No primary category selected/)).toBeInTheDocument();
    // Nothing to inherit ⇒ permissive, matching the server's fallback.
    expect(box('Dine In').checked).toBe(true);
  });

  it('renders the validation error for an empty custom selection', () => {
    const { onChange } = renderControl({ value: 1, error: 'Choose at least one order type' });

    fireEvent.click(box('Dine In'));

    expect(onChange).toHaveBeenCalledWith(0);
    expect(screen.getByText('Choose at least one order type')).toBeInTheDocument();
  });
});
