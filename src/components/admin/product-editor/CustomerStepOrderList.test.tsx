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

  it('locks dependency-breaking moves and announces an invalid drop without saving it', () => {
    const bundleManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 2,
      steps: [
        { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Dish', presentationOrder: 0 },
        {
          kind: 'BundleSection',
          targetId: 'meats',
          compositionRole: 'Side',
          parentComponentId: 'dish-row',
          presentationOrder: 1,
        },
      ],
    };
    const onMove = jest.fn();
    const dependentScreenId = groupCustomerStepScreens(bundleManifest)[1].id;
    const view = render(
      <CustomerStepOrderList
        manifest={bundleManifest}
        sections={boundSections}
        product={product}
        isBundle
        disabled={false}
        invalid={false}
        onMove={onMove}
        onRoleChange={jest.fn()}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'customer_move_down' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'customer_move_up' })[1]).toBeDisabled();
    expect(screen.getAllByText('customer_order_dependency_blocked')).toHaveLength(2);

    const dataTransfer = { getData: jest.fn().mockReturnValue(dependentScreenId) };
    fireEvent.drop(view.container.querySelector('li')!, { dataTransfer });

    expect(onMove).not.toHaveBeenCalled();
    expect(view.container.querySelector('[aria-live="polite"]')).toHaveTextContent('customer_order_dependency_blocked');
    expect(screen.queryByText('customer_order_updated')).not.toBeInTheDocument();
  });

  it('reports a rejected move as blocked when the editor declines an otherwise valid drop', () => {
    const onMove = jest.fn().mockReturnValue(null);
    const sourceScreenId = groupCustomerStepScreens(manifest)[1].id;
    const view = render(
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

    fireEvent.click(screen.getAllByRole('button', { name: 'customer_move_up' })[1]);

    expect(onMove).toHaveBeenCalledWith(sourceScreenId, 0);
    expect(view.container.querySelector('[aria-live="polite"]')).toHaveTextContent('customer_order_dependency_blocked');
    expect(screen.queryByText('customer_order_updated')).not.toBeInTheDocument();
  });

  it('offers Side for an explicit bundle section such as fries', () => {
    const sectionManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 1,
      steps: [{ kind: 'BundleSection', targetId: 'fries', compositionRole: 'Extra', presentationOrder: 0 }],
    };
    const onRoleChange = jest.fn();
    render(
      <CustomerStepOrderList
        manifest={sectionManifest}
        sections={[
          {
            id: 'fries',
            name: 'Fries',
            displayOrder: 0,
            isRequired: false,
            minSelection: 0,
            maxSelection: 1,
            items: [],
          },
        ]}
        product={product}
        isBundle
        disabled={false}
        invalid={false}
        onMove={jest.fn()}
        onRoleChange={onRoleChange}
        onLabelChange={jest.fn()}
        onSectionParentChange={jest.fn()}
        t={t}
      />,
    );

    const role = screen.getByRole('combobox', { name: 'customer_step_role' });
    expect(within(role).getByRole('option', { name: 'customer_role_side' })).toBeEnabled();
    fireEvent.change(role, { target: { value: 'Side' } });
    expect(onRoleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'BundleSection',
        refs: expect.arrayContaining([expect.objectContaining({ targetId: 'fries' })]),
      }),
      'Side',
    );
  });
});
