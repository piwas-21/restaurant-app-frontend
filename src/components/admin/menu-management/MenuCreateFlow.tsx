'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { MENU_BUNDLE_TYPE } from '@/utils/productTypeFilter';
import NewProductTypeModal from './NewProductTypeModal';
import styles from '@/app/styles/AdminPage.module.css';

/**
 * Code-split, and the bundle gate is why. The modal reaches the whole product write path —
 * react-hook-form, the Zod create schema, `productFormUtils` and four services — which is ~33 kB
 * of First Load JS for a LIST page, on a screen whose main job is reading. `next/dynamic` moves it
 * behind the click that needs it. `ssr: false` because it is behind a click either way.
 */
const QuickAddItemModal = dynamic(() => import('./QuickAddItemModal'), { ssr: false });

const LIST_ROUTE = '/admin/menu-management';

type CreateStep = 'closed' | 'type' | 'quickAdd';

interface MenuCreateFlowProps {
  // readonly: S6759 — component props are never mutated.
  /** A visitor sent here by the retired `/new` item route already asked for the modal. */
  readonly autoOpenQuickAdd?: boolean;
  /** A row now exists behind the modal, so the list is stale. */
  readonly onCreated: () => void;
}

/**
 * The list page's whole "New product" flow (MENU-ITEM-EDITOR-REDESIGN-PLAN, slice S3).
 *
 * It is a component and not four more `useState`s on the page because the page is a 200-LOC
 * orchestrator sitting exactly on its limit (frontend CLAUDE.md §4), and because the two kinds now
 * create through genuinely different surfaces:
 *
 * - an **item** opens the quick-add modal (D3) — three fields, then its own edit page;
 * - a **bundle** still opens a page. `MenuBundleDto` has no categories and its sections editor is
 *   the whole screen, so there is nothing to quick-add; §9.5 of the plan says a combo is not
 *   re-grouped, and it is not re-created either.
 *
 * The type chooser therefore stays: the backend has no item↔bundle migration, so the kind is still
 * picked once, before anything is typed.
 */
export default function MenuCreateFlow({ autoOpenQuickAdd = false, onCreated }: MenuCreateFlowProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<CreateStep>(autoOpenQuickAdd ? 'quickAdd' : 'closed');

  const handleTypeSelect = (isBundle: boolean) => {
    if (isBundle) {
      router.push(`${LIST_ROUTE}/new?type=${MENU_BUNDLE_TYPE}`);
      return;
    }
    setStep('quickAdd');
  };

  return (
    <>
      {/* One "New product" entry → a type choice (owner call, slice 7 PR2e). The filter is a
          VIEW, not a mode, so create is a single action regardless of the active chip. */}
      <button type="button" className={`${styles.adminButton} ${styles.add}`} onClick={() => setStep('type')}>
        {t('create_new_product')}
      </button>

      <NewProductTypeModal isOpen={step === 'type'} onClose={() => setStep('closed')} onSelect={handleTypeSelect} />

      {/* Mounted only while open, so every opening starts from an empty form and no category
          fetch runs for an admin who never creates anything. */}
      {step === 'quickAdd' && (
        <QuickAddItemModal
          isOpen
          onClose={() => setStep('closed')}
          onCreated={(productId) => router.push(`${LIST_ROUTE}/${productId}`)}
          onAddedAnother={onCreated}
        />
      )}
    </>
  );
}
