import type { CustomerStepDescriptor, CustomerStepManifest, MenuSection, MenuSectionItem } from '@/types/menu';
import {
  changeBundleSectionParent,
  changeCustomerScreenLabel,
  changeCustomerScreenRole,
  completeCustomerManifestForEditor,
  reorderCustomerScreens,
} from './customerStepEditor';
import { groupCustomerStepScreens } from './customerStepManifest';
import { isCustomerScreenOrderValid } from './customerStepDependencies';

const item = (id: string, productName: string): MenuSectionItem => ({
  id,
  productId: 'shared-product',
  productName,
  additionalPrice: 0,
  displayOrder: 0,
  isDefault: false,
});

const sections: MenuSection[] = [
  {
    id: 'dishes',
    name: 'Tacos',
    displayOrder: 0,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [item('dish-row', 'Tacos'), item('same-name-row', 'Tacos')],
  },
  {
    id: 'meats',
    name: 'Viandes',
    displayOrder: 1,
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    items: [item('meat-row', 'Viandes')],
  },
];

const manifest: CustomerStepManifest = {
  schemaVersion: 1,
  revision: 6,
  steps: [
    { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Dish', presentationOrder: 0 },
    {
      kind: 'BundleSection',
      targetId: 'meats',
      compositionRole: 'RequiredChoice',
      parentComponentId: 'dish-row',
      presentationOrder: 1,
    },
    {
      kind: 'BundleComponentIngredient',
      sectionId: 'dishes',
      sectionItemId: 'dish-row',
      productId: 'shared-product',
      scopeId: 'ing-a',
      compositionRole: 'Extra',
      presentationOrder: 2,
    },
    {
      kind: 'BundleComponentIngredient',
      sectionId: 'dishes',
      sectionItemId: 'dish-row',
      productId: 'shared-product',
      scopeId: 'ing-b',
      compositionRole: 'Extra',
      presentationOrder: 2,
    },
  ].map((step) => step as CustomerStepDescriptor),
};

describe('customer step editor', () => {
  it('binds dependent sections to stable component IDs even when names repeat', () => {
    const next = changeBundleSectionParent(manifest, 'meats', 'same-name-row', sections);
    const parent = next?.steps.find((step) => step.kind === 'BundleSection' && step.targetId === 'meats');

    expect(parent).toMatchObject({ kind: 'BundleSection', parentComponentId: 'same-name-row' });
    expect(changeBundleSectionParent(manifest, 'meats', 'meat-row', sections)).toBeNull();
  });

  it('refuses an order that puts the dependent required-choice screen before its parent', () => {
    const screens = groupCustomerStepScreens(manifest);
    const child = screens.find((screen) =>
      screen.refs.some((ref) => ref.kind === 'BundleSection' && ref.targetId === 'meats'),
    );

    expect(child).toBeDefined();
    expect(reorderCustomerScreens(manifest, child!.id, 0, sections)).toBeNull();
  });

  it('keeps one variation picker per owner and does not append a third split picker', () => {
    const oldVariation = {
      kind: 'ProductVariation' as const,
      targetId: 'regular',
      compositionRole: 'RequiredChoice' as const,
      presentationOrder: 0,
    };
    const addedVariation = {
      kind: 'ProductVariation' as const,
      targetId: 'large',
      compositionRole: 'Dish' as const,
      presentationOrder: 0,
    };
    const compatible = completeCustomerManifestForEditor({ schemaVersion: 1, revision: 0, steps: [oldVariation] }, [
      oldVariation,
      addedVariation,
    ]);
    const compatibleScreens = groupCustomerStepScreens(compatible);
    expect(compatibleScreens).toHaveLength(1);
    expect(compatibleScreens[0].refs.flatMap((ref) => ('targetId' in ref ? [ref.targetId] : []))).toEqual([
      'regular',
      'large',
    ]);
    expect(compatibleScreens[0].presentationOrder).toBe(0);
    expect(compatible.steps.map((step) => step.compositionRole)).toEqual(['RequiredChoice', 'RequiredChoice']);

    const split = completeCustomerManifestForEditor(
      {
        schemaVersion: 1,
        revision: 0,
        steps: [oldVariation, { ...oldVariation, targetId: 'halfway', presentationOrder: 1 }],
      },
      [oldVariation, { ...addedVariation, targetId: 'halfway' }, { ...addedVariation, targetId: 'large' }],
    );
    const splitScreens = groupCustomerStepScreens(split);
    expect(splitScreens.map((screen) => screen.presentationOrder)).toEqual([0, 1]);
    expect(isCustomerScreenOrderValid(splitScreens, [])).toBe(false);
  });

  it('copies an authored Dish label onto new variation refs joined to that picker', () => {
    const existing = {
      kind: 'ProductVariation' as const,
      targetId: 'regular',
      compositionRole: 'Dish' as const,
      presentationLabel: 'Tacos',
      presentationOrder: 2,
    };
    const added = {
      kind: 'ProductVariation' as const,
      targetId: 'large',
      compositionRole: 'RequiredChoice' as const,
      presentationOrder: 0,
    };
    const complete = completeCustomerManifestForEditor({ schemaVersion: 1, revision: 0, steps: [existing] }, [
      existing,
      added,
    ]);

    expect(groupCustomerStepScreens(complete)).toHaveLength(1);
    expect(complete.steps).toEqual([
      existing,
      { ...added, compositionRole: 'Dish', presentationLabel: 'Tacos', presentationOrder: 2 },
    ]);
  });

  it('joins newly added sauce refs to the owner-wide picker and preserves its authored role', () => {
    const oldSauce = {
      kind: 'ProductSauce' as const,
      targetId: 'mild',
      compositionRole: 'Extra' as const,
      presentationOrder: 3,
    };
    const newSauce = {
      kind: 'ProductSauce' as const,
      targetId: 'hot',
      compositionRole: 'Sauce' as const,
      presentationOrder: 1,
    };
    const complete = completeCustomerManifestForEditor({ schemaVersion: 1, revision: 0, steps: [oldSauce] }, [
      newSauce,
      oldSauce,
    ]);

    expect(groupCustomerStepScreens(complete)).toHaveLength(1);
    expect(complete.steps.map((step) => step.presentationOrder)).toEqual([3, 3]);
    expect(complete.steps.map((step) => step.compositionRole)).toEqual(['Extra', 'Extra']);
  });

  it('rejects split component-variation pickers for one selected menu row', () => {
    const componentManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 0,
      steps: [
        { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Menu', presentationOrder: 0 },
        {
          kind: 'BundleComponentVariation',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'shared-product',
          scopeId: 'small',
          compositionRole: 'Dish',
          presentationOrder: 1,
        },
        {
          kind: 'BundleComponentVariation',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'shared-product',
          scopeId: 'large',
          compositionRole: 'RequiredChoice',
          presentationOrder: 2,
        },
      ],
    };

    expect(isCustomerScreenOrderValid(groupCustomerStepScreens(componentManifest), sections)).toBe(false);
  });

  it('rejects split component-sauce pickers that would each apply the same global min/max', () => {
    const componentManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 0,
      steps: [
        { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Menu', presentationOrder: 0 },
        {
          kind: 'BundleComponentSauce',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'shared-product',
          scopeId: 'sauce-a',
          compositionRole: 'Sauce',
          presentationOrder: 1,
        },
        {
          kind: 'BundleComponentSauce',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'shared-product',
          scopeId: 'sauce-b',
          compositionRole: 'Sauce',
          presentationOrder: 2,
        },
      ],
    };

    expect(isCustomerScreenOrderValid(groupCustomerStepScreens(componentManifest), sections)).toBe(false);
  });

  it('refuses moving a product Extra screen before its RequiredChoice screen', () => {
    const productManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 0,
      steps: [
        { kind: 'ProductVariation', targetId: 'variation', compositionRole: 'RequiredChoice', presentationOrder: 0 },
        { kind: 'ProductCustomizationGroup', targetId: 'extra', compositionRole: 'Extra', presentationOrder: 1 },
      ],
    };
    const required = groupCustomerStepScreens(productManifest).find(
      (screen) => screen.compositionRole === 'RequiredChoice',
    );

    expect(required).toBeDefined();
    expect(reorderCustomerScreens(productManifest, required!.id, 1, [])).toBeNull();
  });

  it('refuses moving a component Extra screen before a required group on that same row', () => {
    const componentManifest: CustomerStepManifest = {
      schemaVersion: 1,
      revision: 0,
      steps: [
        { kind: 'BundleSection', targetId: 'dishes', compositionRole: 'Menu', presentationOrder: 0 },
        {
          kind: 'BundleComponentCustomizationGroup',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'shared-product',
          scopeId: 'required',
          compositionRole: 'RequiredChoice',
          presentationOrder: 1,
        },
        {
          kind: 'BundleComponentCustomizationGroup',
          sectionId: 'dishes',
          sectionItemId: 'dish-row',
          productId: 'shared-product',
          scopeId: 'extra',
          compositionRole: 'Extra',
          presentationOrder: 2,
        },
      ],
    };
    const required = groupCustomerStepScreens(componentManifest).find(
      (screen) => screen.compositionRole === 'RequiredChoice',
    );

    expect(required).toBeDefined();
    expect(reorderCustomerScreens(componentManifest, required!.id, 2, sections)).toBeNull();
  });

  it('changes the role and explicit dish label for every ref grouped on the same screen', () => {
    const screens = groupCustomerStepScreens(manifest);
    const extras = screens.find((screen) => screen.kind === 'BundleComponentIngredient');
    expect(extras?.refs).toHaveLength(2);

    const roleChanged = changeCustomerScreenRole(manifest, extras!, 'RequiredChoice', sections);
    expect(
      roleChanged?.steps
        .filter((step) => step.kind === 'BundleComponentIngredient')
        .map((step) => step.compositionRole),
    ).toEqual(['RequiredChoice', 'RequiredChoice']);

    const dish = screens.find(
      (screen) =>
        screen.kind === 'BundleSection' &&
        screen.refs.some((step) => step.kind === 'BundleSection' && step.targetId === 'dishes'),
    );
    const labelled = changeCustomerScreenLabel(manifest, dish!, 'Choose a taco');
    expect(
      labelled.steps.find((step) => step.kind === 'BundleSection' && step.targetId === 'dishes')?.presentationLabel,
    ).toBe('Choose a taco');
    const dishScreen = groupCustomerStepScreens(labelled).find(
      (screen) => screen.presentationLabel === 'Choose a taco',
    );
    expect(changeCustomerScreenRole(labelled, dishScreen!, 'Extra', sections)).toBeNull();

    const unbound = changeBundleSectionParent(labelled, 'meats', null, sections);
    const unboundDish = groupCustomerStepScreens(unbound!).find(
      (screen) =>
        screen.kind === 'BundleSection' &&
        screen.refs.some((step) => step.kind === 'BundleSection' && step.targetId === 'dishes'),
    );
    const changedAwayFromDish = changeCustomerScreenRole(unbound!, unboundDish!, 'Extra', sections);
    expect(
      changedAwayFromDish?.steps.find((step) => step.kind === 'BundleSection' && step.targetId === 'dishes')
        ?.presentationLabel,
    ).toBeUndefined();
  });
});
