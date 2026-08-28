import React, { type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import NewProductRoutePage from './page';

// `mock`-prefixed so the factories may close over them (jest's out-of-scope-variable rule).
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockType: string | null = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({ get: () => mockType }),
}));
jest.mock('@/components/admin/AdminAuthGuard', () => ({
  AdminAuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/admin/product-editor/ProductEditorPage', () => ({
  __esModule: true,
  default: ({ isBundle }: { isBundle: boolean }) => <div data-testid="editor">{isBundle ? 'bundle' : 'item'}</div>,
}));

/**
 * The retirement of the item create page (MENU-ITEM-EDITOR-REDESIGN-PLAN, slice S3 / decision D3).
 *
 * `/admin/menu-management/new` was the one route both kinds created through, and it is where the
 * create/edit divergence lived: a staged image input that exists nowhere else, and a
 * `primaryCategoryId` required here but conditional on edit. An ITEM no longer resolves here at
 * all — it is three fields in a modal on the list. A BUNDLE still does, because its sections
 * editor is the whole screen and there is no three-field version of it (§9.5).
 *
 * The item arm redirects rather than 404s: the URL is two years old and may be bookmarked, and the
 * admin's intent ("create an item") is exactly what `?new=item` re-opens on the list.
 */
describe('/admin/menu-management/new — bundles only since S3', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  it('no longer resolves for an item — it re-opens the quick-add modal on the list', async () => {
    mockType = null;
    render(<NewProductRoutePage />);
    await act(async () => {});

    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/admin/menu-management?new=item');
  });

  it('still renders the bundle editor for ?type=menu', async () => {
    mockType = 'menu';
    render(<NewProductRoutePage />);
    await act(async () => {});

    expect(screen.getByTestId('editor')).toHaveTextContent('bundle');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // An unknown `?type=` is an item request by any other name, and must not fall through to a
  // bundle editor the backend cannot fill.
  it('treats an unrecognised type as an item request', async () => {
    mockType = 'mainItem';
    render(<NewProductRoutePage />);
    await act(async () => {});

    expect(screen.queryByTestId('editor')).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/admin/menu-management?new=item');
  });
});
