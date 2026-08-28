'use client';

import React from 'react';
import type { TFunction } from 'i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { EditorOverflowAction } from './EditorOverflowMenu';

interface HeaderContext {
  readonly t: TFunction;
  readonly isBundle: boolean;
  readonly isCreate: boolean;
}

/**
 * The two badges the approved editor screens draw beside the title — `[Item] [Active]` (frontend
 * #574) — and the contents of the `⋯` beside them.
 *
 * They live here rather than inline in `ProductEditorPage` because that page is an ORCHESTRATOR:
 * three ternaries of header chrome pushed it over the `sonarjs/cognitive-complexity` gate, and a
 * page that has to reason about badge tone is a page that has started doing UI again.
 */
export function productHeaderBadges({
  t,
  isBundle,
  isCreate,
  typeLabel,
  isLive,
}: HeaderContext & { readonly typeLabel: string; readonly isLive: boolean }): React.ReactNode {
  return (
    <>
      <span data-testid="product-type-badge">
        <StatusBadge tone={isBundle ? 'info' : 'neutral'}>{typeLabel}</StatusBadge>
      </span>
      {/* Read from the FORM, not from the loaded product: the switch that changes it is in the rail
          two columns away, so a badge sourced from `product.isActive` would contradict the control
          the admin just used until the next save. Suppressed on create — nothing is live yet, and a
          green `Active` on an unsaved draft is a lie. */}
      {!isCreate && (
        <span data-testid="product-active-badge">
          <StatusBadge tone={isLive ? 'success' : 'neutral'}>{isLive ? t('active') : t('inactive')}</StatusBadge>
        </span>
      )}
    </>
  );
}

/**
 * `Delete` moves off the header row and into the overflow (#574): a destructive button beside
 * `Save` is one mis-click from deleting the product the admin came to edit, and it was the one
 * place where the shipped chrome was riskier than the approved one.
 *
 * Empty on the create route, and `EditorOverflowMenu` then renders no `⋯` at all.
 */
export function productHeaderMenuActions({
  t,
  isBundle,
  isCreate,
  onDelete,
}: HeaderContext & { readonly onDelete?: () => void }): EditorOverflowAction[] {
  if (isCreate || !onDelete) return [];
  return [
    {
      id: 'delete',
      label: isBundle ? t('delete_menu_bundle') : t('delete_product'),
      onSelect: onDelete,
      destructive: true,
    },
  ];
}
