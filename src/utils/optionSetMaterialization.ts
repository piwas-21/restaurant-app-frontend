import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { OptionSetAttachment, OptionSetKind } from '@/types/optionSet';
import type { OptionSetEntryOverride, OptionSetTargetSettings } from '@/types/optionSetMaterialization';

export interface OptionSetMaterializationTarget {
  readonly targetKey: string;
  readonly targetProductId: string;
  readonly targetProductName: string;
  readonly role: OptionSetAttachment['role'];
  readonly contextId?: string;
  readonly contextName?: string;
  readonly expectedMenuAuthoringVersion?: number;
  readonly expectedCustomizationGroupVersion?: number;
  readonly expectedAttachmentVersion: number | null;
  readonly attachment?: OptionSetAttachment;
  readonly selected: boolean;
  readonly conflictPolicy: 'preserveLocal' | 'useSetValues' | 'useOverrides';
  readonly settings: OptionSetTargetSettings;
  readonly overrides: Readonly<Record<string, OptionSetEntryOverride>>;
  readonly intentionalDifferenceReason: string;
}

function keyFor(role: OptionSetAttachment['role'], productId: string, contextId?: string): string {
  return `${role}:${productId}:${contextId ?? 'root'}`;
}

function settingsFromAttachment(attachment?: OptionSetAttachment): OptionSetTargetSettings {
  if (!attachment) return {};
  return {
    ...(attachment.minSelection !== undefined ? { minSelection: attachment.minSelection } : {}),
    ...(attachment.maxSelection !== undefined ? { maxSelection: attachment.maxSelection } : {}),
    ...(attachment.includedFree !== undefined ? { includedFree: attachment.includedFree } : {}),
    ...(attachment.role === 'bundleChoice' || attachment.role === 'productChoice'
      ? { displayOrder: attachment.displayOrder }
      : {}),
  };
}

export function targetsForProduct(product: ProductDetails, kind: OptionSetKind): OptionSetMaterializationTarget[] {
  if (kind !== 'bundleChoice') {
    return [
      {
        targetKey: keyFor(kind, product.id),
        targetProductId: product.id,
        targetProductName: product.name,
        role: kind,
        expectedAttachmentVersion: null,
        selected: true,
        conflictPolicy: 'preserveLocal',
        settings:
          kind === 'sauce'
            ? {
                ...(product.sauceMin !== undefined ? { minSelection: product.sauceMin } : {}),
                ...(product.sauceMax !== undefined && product.sauceMax !== null
                  ? { maxSelection: product.sauceMax }
                  : {}),
                ...(product.sauceIncludedFree !== undefined ? { includedFree: product.sauceIncludedFree } : {}),
              }
            : {},
        overrides: {},
        intentionalDifferenceReason: '',
      },
    ];
  }

  const menuTargets = (product.menuDefinition?.sections ?? []).map((section) => ({
    targetKey: keyFor('bundleChoice', product.id, section.id),
    targetProductId: product.id,
    targetProductName: product.name,
    role: 'bundleChoice' as const,
    contextId: section.id,
    contextName: section.name,
    expectedMenuAuthoringVersion: product.menuDefinition?.authoringVersion,
    expectedAttachmentVersion: null,
    selected: product.menuDefinition?.authoringVersion !== undefined,
    conflictPolicy: 'preserveLocal' as const,
    settings: {
      minSelection: section.minSelection,
      maxSelection: section.maxSelection,
      displayOrder: section.displayOrder,
    },
    overrides: {},
    intentionalDifferenceReason: '',
  }));
  const productTargets = (product.customizationGroups ?? []).map((group) => ({
    targetKey: keyFor('productChoice', product.id, group.id),
    targetProductId: product.id,
    targetProductName: product.name,
    role: 'productChoice' as const,
    contextId: group.id,
    contextName: group.name,
    expectedCustomizationGroupVersion: group.authoringVersion,
    expectedAttachmentVersion: null,
    selected: group.authoringVersion !== undefined,
    conflictPolicy: 'preserveLocal' as const,
    settings: {
      minSelection: group.minSelection,
      maxSelection: group.maxSelection,
      includedFree: group.includedFreeUnits,
      displayOrder: group.displayOrder,
    },
    overrides: {},
    intentionalDifferenceReason: '',
  }));
  return [...menuTargets, ...productTargets];
}

function contextForAttachment(
  attachment: OptionSetAttachment,
  product: ProductDetails,
): { id?: string; name?: string } {
  if (attachment.role === 'bundleChoice') {
    const id = attachment.targetMenuSectionId;
    return { id, name: product.menuDefinition?.sections.find((section) => section.id === id)?.name };
  }
  if (attachment.role === 'productChoice') {
    const id = attachment.targetCustomizationGroupId;
    return { id, name: product.customizationGroups?.find((group) => group.id === id)?.name };
  }
  return {};
}

function versionFieldsForAttachment(
  attachment: OptionSetAttachment,
  product: ProductDetails,
  contextId?: string,
): Pick<OptionSetMaterializationTarget, 'expectedMenuAuthoringVersion' | 'expectedCustomizationGroupVersion'> {
  if (attachment.role === 'bundleChoice') {
    const version = product.menuDefinition?.authoringVersion;
    return version === undefined ? {} : { expectedMenuAuthoringVersion: version };
  }
  if (attachment.role === 'productChoice') {
    const version = product.customizationGroups?.find((group) => group.id === contextId)?.authoringVersion;
    return version === undefined ? {} : { expectedCustomizationGroupVersion: version };
  }
  return {};
}

function attachmentCanBeSelected(
  attachment: OptionSetAttachment,
  versions: ReturnType<typeof versionFieldsForAttachment>,
) {
  if (attachment.role === 'bundleChoice') return versions.expectedMenuAuthoringVersion !== undefined;
  if (attachment.role === 'productChoice') return versions.expectedCustomizationGroupVersion !== undefined;
  return true;
}

export function targetFromAttachment(
  attachment: OptionSetAttachment,
  product: ProductDetails,
): OptionSetMaterializationTarget | null {
  const context = contextForAttachment(attachment, product);
  const needsContext = attachment.role === 'bundleChoice' || attachment.role === 'productChoice';
  if (needsContext && !context.id) return null;
  const versions = versionFieldsForAttachment(attachment, product, context.id);
  const settings =
    attachment.role === 'ingredient' || attachment.role === 'suggestedSide' ? {} : settingsFromAttachment(attachment);
  return {
    targetKey: keyFor(attachment.role, product.id, context.id),
    targetProductId: product.id,
    targetProductName: product.name,
    role: attachment.role,
    ...(context.id ? { contextId: context.id } : {}),
    ...(context.name ? { contextName: context.name } : {}),
    ...versions,
    expectedAttachmentVersion: attachment.version,
    attachment,
    selected: attachmentCanBeSelected(attachment, versions),
    conflictPolicy: 'preserveLocal',
    settings,
    overrides: {},
    intentionalDifferenceReason: attachment.intentionalDifferenceReason ?? '',
  };
}

export function targetsFromAttachments(
  attachments: readonly OptionSetAttachment[],
  products: Readonly<Record<string, ProductDetails>>,
): OptionSetMaterializationTarget[] {
  return attachments.flatMap((attachment) => {
    const product = products[attachment.targetProductId];
    if (!product) return [];
    const target = targetFromAttachment(attachment, product);
    return target ? [target] : [];
  });
}
