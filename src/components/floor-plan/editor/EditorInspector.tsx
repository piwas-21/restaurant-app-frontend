'use client';

import { useTranslation } from 'react-i18next';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import EditorAlignControls from './EditorAlignControls';
import EditorItemPanel from './EditorItemPanel';
import EditorTablePanel from './EditorTablePanel';
import styles from './EditorInspector.module.css';

/**
 * The inspector (FLOOR-PLAN-REVAMP §4.3) — exact, no-drag control of the
 * selection, and the router between the three things a selection can be: several
 * objects (align + distribute), one table, or one placed item. Whatever is
 * selected, every canvas gesture has an equivalent here (SC 2.5.7).
 */
interface EditorInspectorProps {
  editor: FloorPlanEditorApi;
  onEditDetails: () => void;
  onShowQR: () => void;
  onDelete: () => void;
}

export default function EditorInspector({ editor, onEditDetails, onShowQR, onDelete }: Readonly<EditorInspectorProps>) {
  const { t } = useTranslation();
  const count = editor.selectedIds.length;
  const table = editor.selectedTable;
  const item = editor.selectedItem;
  const itemId = item?.id;

  return (
    <aside className={styles.panel} aria-label={t('editor_properties', 'Properties')}>
      {count > 1 && (
        <>
          <h2 className={styles.heading}>{t('editor_selected_objects', '{{count}} objects selected', { count })}</h2>
          <EditorAlignControls
            count={count}
            onAlign={editor.alignSelection}
            onDistribute={editor.distributeSelection}
          />
          <p className={styles.empty}>
            {t('editor_multi_object_hint', 'Arrows nudge them together. Pick one to edit its size or details.')}
          </p>
        </>
      )}

      {count <= 1 && table && (
        <EditorTablePanel
          table={table}
          plan={editor.document}
          onPatch={(patch) => editor.mutateTable(table.id, patch)}
          onEditDetails={onEditDetails}
          onShowQR={onShowQR}
          onDelete={onDelete}
        />
      )}

      {count <= 1 && !table && item && itemId && (
        <EditorItemPanel
          item={item}
          plan={editor.document}
          onPatch={(patch) => editor.mutateItem(itemId, patch)}
          onDuplicate={editor.duplicateSelection}
          onDelete={editor.deleteSelectedItems}
        />
      )}

      {count === 0 && (
        <p className={styles.empty}>
          {t('editor_select_object_hint', 'Select a table or object to edit its position, size and rotation.')}
        </p>
      )}
    </aside>
  );
}
