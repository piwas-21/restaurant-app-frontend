import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProductsTable from './ProductsTable';
import { Product } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const bundleRow: Product = {
  id: 'bundle-1',
  name: 'Pizza Combo',
  description: '',
  basePrice: 20,
  isActive: true,
  isAvailable: true,
  type: 'menu',
  imageUrl: null,
  images: [],
};

const itemRow: Product = { ...bundleRow, id: 'item-1', name: 'Margherita', type: 'mainItem' };

function renderTable(products: Product[], typeFilter?: 'all' | 'items' | 'bundles') {
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  render(
    <ProductsTable
      products={products}
      isLoading={false}
      error={null}
      onEdit={onEdit}
      onDelete={onDelete}
      typeFilter={typeFilter}
    />,
  );
  return { onEdit, onDelete };
}

describe('ProductsTable — a row carries its own kind', () => {
  // The defect this pins: the old table took an `activeTab` prop and used it to build
  // every row's Details link, and the page inferred delete/edit from the same view
  // state. Under the new "All" chip a mixed list is the NORMAL case, so a row's kind
  // can only come from the row. These assertions are made with the filter set to the
  // WRONG value on purpose — the row must win.

  it('hands the whole row to onEdit, not just an id', () => {
    const { onEdit } = renderTable([bundleRow], 'items');
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    // The page needs `type` to pick the endpoint + editor; an id alone forced it to
    // re-find the row, which is what could silently miss and fall back to the item branch.
    expect(onEdit).toHaveBeenCalledWith(bundleRow);
  });

  it('hands the whole row to onDelete, so the kind is known at CLICK time', () => {
    const { onDelete } = renderTable([bundleRow], 'items');
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(onDelete).toHaveBeenCalledWith(bundleRow);
  });

  it('links a bundle row to ?type=menu even while the "items" filter is active', () => {
    renderTable([bundleRow], 'items');
    expect(screen.getByRole('link', { name: 'details' })).toHaveAttribute(
      'href',
      '/admin/menu-management/bundle-1?type=menu',
    );
  });

  it('links an item row to ?type=product even while the "bundles" filter is active', () => {
    renderTable([itemRow], 'bundles');
    expect(screen.getByRole('link', { name: 'details' })).toHaveAttribute(
      'href',
      '/admin/menu-management/item-1?type=product',
    );
  });

  it('gives each row of a MIXED list its own type — the case the old tabs could not express', () => {
    renderTable([bundleRow, itemRow], 'all');
    const links = screen.getAllByRole('link', { name: 'details' });
    expect(links[0]).toHaveAttribute('href', '/admin/menu-management/bundle-1?type=menu');
    expect(links[1]).toHaveAttribute('href', '/admin/menu-management/item-1?type=product');
  });
});

describe('ProductsTable — filter only picks the wording', () => {
  it('uses bundle wording when the bundles chip is active', () => {
    render(
      <ProductsTable
        products={[]}
        isLoading={false}
        error={null}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        typeFilter="bundles"
      />,
    );
    expect(screen.getByText('no_menu_bundles_found')).toBeInTheDocument();
  });

  it('uses product wording on a mixed "all" list', () => {
    render(
      <ProductsTable
        products={[]}
        isLoading={false}
        error={null}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        typeFilter="all"
      />,
    );
    expect(screen.getByText('no_products_found')).toBeInTheDocument();
  });
});

/**
 * The "still to add" chips (MENU-ITEM-EDITOR-REDESIGN-PLAN, S10).
 *
 * Same rule module as the editor's side-rail meter, so a chip and the page it opens cannot disagree.
 * These assertions are about what the admin is TOLD, and one of them — the `imageUrl` case — is
 * about a fact of the API rather than of this component.
 */
describe('ProductsTable — what a row still needs', () => {
  const bare: Product = { ...itemRow, description: '', images: [] };
  const withPhoto: Product = {
    ...bare,
    images: [{ id: 'img-1', url: '/u/x.jpg', altText: '', isPrimary: true, sortOrder: 0 }],
  };

  it('names both gaps on an item with no photo and no description', () => {
    renderTable([bare]);
    expect(screen.getByText('product_needs_photo')).toBeInTheDocument();
    expect(screen.getByText('product_needs_description')).toBeInTheDocument();
  });

  it('drops a chip as soon as the field is filled', () => {
    renderTable([{ ...withPhoto, description: 'Tomato, mozzarella, basil' }]);
    expect(screen.queryByText('product_needs_photo')).not.toBeInTheDocument();
    expect(screen.queryByText('product_needs_description')).not.toBeInTheDocument();
    // No empty container either: a complete row renders nothing at all rather than an empty list.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps "needs photo" on a row that has an imageUrl but no images', () => {
    // NOT a hypothetical. `GetProductsQuery` projects through `ProductSummaryMapper`, which fills
    // `Images` and NEVER assigns `ImageUrl` — so every row on this page arrives with
    // `imageUrl: null`, and a chip driven off that field would have accused the whole menu. This is
    // the inverse fixture: read `imageUrl` and this row wrongly looks complete.
    renderTable([{ ...bare, description: 'x', imageUrl: '/uploads/margherita.jpg' }]);
    expect(screen.getByText('product_needs_photo')).toBeInTheDocument();
  });

  it('gives a BUNDLE no chips, because it has no gallery to fix them with', () => {
    renderTable([{ ...bundleRow, description: '', images: [] }]);
    expect(screen.queryByText('product_needs_photo')).not.toBeInTheDocument();
    expect(screen.queryByText('product_needs_description')).not.toBeInTheDocument();
  });

  it('never says anything about allergens', () => {
    // The §14 decision, asserted where it is easiest to break: an empty `allergens` array cannot
    // tell "checked, nothing to declare" from "nobody has looked", so no wording of that chip is
    // true. If one is ever added, this test is the place that argues with it.
    renderTable([bare]);
    expect(screen.queryByText(/allergen/i)).not.toBeInTheDocument();
  });

  it('scopes the chips to their own row in a mixed list', () => {
    renderTable([bare, { ...withPhoto, id: 'item-2', description: 'Described' }]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('product_needs_photo')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('product_needs_photo')).not.toBeInTheDocument();
  });
});
