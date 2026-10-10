import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { CustomerStepManifest, MenuSection } from '@/types/menu';
import { groupCustomerStepScreens } from '@/utils/customerStepManifest';
import CustomerStepOrderList from './CustomerStepOrderList';

const product = {
  id: 'product',
  name: 'Taco',
  hideBaseProduct: true,
  variations: [{ id: 'v1', name: 'Large', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 0 }],
  suggestedSideItems: [],
  customizationGroups: [],
} as unknown as ProductDetails;
const manifest: CustomerStepManifest = {
  schemaVersion: 1,
  revision: 3,
  steps: [
    { kind: 'ProductVariation', targetId: 'v1', compositionRole: 'RequiredChoice', presentationOrder: 0 },
    { kind: 'ProductSauce', targetId: 'salsa', compositionRole: 'Sauce', presentationOrder: 1 },
  ],
};
const t = (key: string) => key;
const boundSections: MenuSection[] = [
  {
    id: 'dishes',
    name: 'Tacos',
    displayOrder: 0,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [
      { id: 'dish-row', productId: 'taco', productName: 'Tacos', additionalPrice: 0, displayOrder: 0, isDefault: true },
    ],
  },
  {
    id: 'meats',
    name: 'Viandes',
    displayOrder: 1,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [
      {
        id: 'meat-row',
        productId: 'meat',
        productName: 'Viandes',
        additionalPrice: 0,
        displayOrder: 0,
        isDefault: false,
      },
    ],
  },
];

describe('CustomerStepOrderList', () => {
  it('exposes required status, position, and native keyboard-operable up/down controls', () => {
    const onMove = jest.fn();
    const firstId = groupCustomerStepScreens(manifest)[0].id;
    render(
      <CustomerStepOrderList
        manifest={manifest}
        sections={[]}
        product={product}
        isBundle={false}
        disabled={false}
        invalid={false}
        onMove={onMove}
        onRoleChange={jest.fn()}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );

    expect(screen.getAllByText('customer_step_position')).toHaveLength(2);
    expect(screen.getByText('customer_step_required')).toBeInTheDocument();
    const moveDown = screen.getAllByRole('button', { name: 'customer_move_down' })[0];
    expect(moveDown).toHaveAttribute('type', 'button');
    expect(moveDown).toBeEnabled();
    fireEvent.click(moveDown);
    expect(onMove).toHaveBeenCalledWith(firstId, 1);
    expect(screen.getByText('customer_order_updated')).toBeInTheDocument();
  });

  it('shows a Dish label field only after the operator selects the Dish role', () => {
    const onRoleChange = jest.fn();
    const view = render(
      <CustomerStepOrderList
        manifest={manifest}
        sections={[]}
        product={product}
        isBundle={false}
        disabled={false}
        invalid={false}
        onMove={jest.fn()}
        onRoleChange={onRoleChange}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );

    expect(screen.queryByLabelText('customer_step_label')).not.toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox', { name: 'customer_step_role' })[0], { target: { value: 'Dish' } });
    expect(onRoleChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ProductVariation' }), 'Dish');
    view.rerender(
      <CustomerStepOrderList
        manifest={{
          ...manifest,
          steps: manifest.steps.map((step, index) => (index === 0 ? { ...step, compositionRole: 'Dish' } : step)),
        }}
        sections={[]}
        product={product}
        isBundle={false}
        disabled={false}
        invalid={false}
        onMove={jest.fn()}
        onRoleChange={onRoleChange}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );
    expect(screen.getByLabelText('customer_step_label')).toBeInTheDocument();
  });

  it('rejects native drop events while editing is disabled or the manifest is invalid', () => {
    const onMove = jest.fn();
    const view = render(
      <CustomerStepOrderList
        manifest={manifest}
        sections={[]}
        product={product}
        isBundle={false}
        disabled
        invalid
        onMove={onMove}
        onRoleChange={jest.fn()}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );

    const dataTransfer = { getData: jest.fn().mockReturnValue(groupCustomerStepScreens(manifest)[1].id) };
    fireEvent.drop(view.container.querySelector('li')!, { dataTransfer });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('offers only composition roles accepted for each typed step kind', () => {
    render(
      <CustomerStepOrderList
        manifest={manifest}
        sections={[]}
        product={product}
        isBundle={false}
        disabled={false}
        invalid={false}
        onMove={jest.fn()}
        onRoleChange={jest.fn()}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );
    const selectors = screen.getAllByRole('combobox', { name: 'customer_step_role' });

    expect(
      within(selectors[0])
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['Dish', 'RequiredChoice']);
    expect(
      within(selectors[1])
        .getAllByRole('option')
        .map((option) => option.getAttribute('value')),
    ).toEqual(['Sauce', 'Extra']);
  });

  it('keeps a Dish role when a dependent section is bound to one of its stable rows', () => {
    const bundleManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 2,
      steps: [
        { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Dish', presentationOrder: 0 },
        {
          kind: 'BundleSection',
          targetId: 'meats',
          compositionRole: 'RequiredChoice',
          parentComponentId: 'dish-row',
          presentationOrder: 1,
        },
      ],
    };
    render(
      <CustomerStepOrderList
        manifest={bundleManifest}
        sections={boundSections}
        product={product}
        isBundle
        disabled={false}
        invalid={false}
        onMove={jest.fn()}
        onRoleChange={jest.fn()}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );
    const dishRole = screen.getAllByRole('combobox', { name: 'customer_step_role' })[0];

    expect(within(dishRole).getByRole('option', { name: 'customer_role_dish' })).toBeEnabled();
    expect(within(dishRole).getByRole('option', { name: 'customer_role_extra' })).toBeDisabled();
  });
});
