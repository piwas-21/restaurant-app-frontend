'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FloorPlanScene from '../FloorPlanScene';
import type { FloorPlanDocument } from '@/types/floorPlan';

/**
 * Preview-as-guest (FLOOR-PLAN-REVAMP §4.3) — the exact guest `FloorPlanScene`,
 * in the active template's skin, inside a BaseModal. Because it is the same
 * renderer the guest map uses, "does the edit look right to a guest?" is
 * answered without leaving the editor, and mirroring bugs die at the source.
 */
interface EditorPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: FloorPlanDocument;
  skinClassName?: string;
}

export default function EditorPreviewModal({
  isOpen,
  onClose,
  document,
  skinClassName,
}: Readonly<EditorPreviewModalProps>) {
  const { t } = useTranslation();
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('editor_preview_title', 'Preview as guest')} size="lg">
      <FloorPlanScene
        document={document}
        skinClassName={skinClassName}
        ariaLabel={t('restaurant_floor_plan', 'Restaurant floor plan')}
      />
    </BaseModal>
  );
}
