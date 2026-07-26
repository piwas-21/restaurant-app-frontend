'use client';

import { useTranslation } from 'react-i18next';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import EditorAlignControls from './EditorAlignControls';
import EditorItemPanel from './EditorItemPanel';
import EditorTablePanel from './EditorTablePanel';
import EditorWallPanel from './EditorWallPanel';
import styles from './EditorInspector.module.css';

/**
 * The inspector (FLOOR-PLAN-REVAMP §4.3) — exact, no-drag control of the
 * selection, and the router between the four things a selection can be: several
 * objects (align + distribute), one table, one placed item, or one wall. Whatever
 * is selected, every canvas gesture has an equivalent here (SC 2.5.7).
 *
 * A wall is checked first because it is a *different* selection: picking one
 * clears the movable selection, so the two can never both be live and the branch
 * order simply states which subject wins.
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
  const wall = editor.selectedWall;
  const wallId = wall?.id;

  if (wall && wallId) {
    return (
      <aside className={styles.panel} aria-label={t('editor_properties', 'Properties')}>
        <EditorWallPanel
          wall={wall}
          plan={editor.document}
          selectedVertex={editor.selectedVertex}
          onPatch={(patch) => editor.patchWall(wallId, patch)}
          onDelete={() => editor.deleteWall(wallId)}
          onSelectVertex={editor.selectVertex}
          onMoveVertex={(index, x, y) => editor.moveVertex(wallId, index, x, y)}
          onRemoveVertex={(index) => editor.deleteVertex(wallId, index)}
          onAddOpening={(segmentIndex, kind) => editor.addOpening(wallId, segmentIndex, kind)}
          onPatchOpening={(openingId, patch) => editor.patchOpening(wallId, openingId, patch)}
          onRemoveOpening={(openingId) => editor.deleteOpening(wallId, openingId)}
        />
      </aside>
    );
  }

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

      {count === 0 && editor.activeTool === 'wall' && (
        <p className={styles.empty}>
          {t(
            'editor_wall_tool_hint',
            'Click the plan to place corners. Click the first corner again to close a room, Enter to finish an open wall, Esc to cancel.',
          )}
        </p>
      )}

      {count === 0 && editor.activeTool !== 'wall' && (
        <p className={styles.empty}>
          {t('editor_select_object_hint', 'Select a table, object or wall to edit it. Press W to draw a wall.')}
        </p>
      )}
    </aside>
  );
}
