'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import guestScene from '@active-template/floor-plan/FloorPlanScene.module.css';
import { useFloorPlanEditor } from '@/hooks/floorPlan/useFloorPlanEditor';
import { useEditorTables } from '@/hooks/floorPlan/useEditorTables';
import { CreateTableModal } from '@/components/admin/table-layout/CreateTableModal';
import { DeleteTableModal } from '@/components/admin/table-layout/DeleteTableModal';
import TablePropertiesModal from '@/components/admin/table-layout/TablePropertiesModal';
import TableQRCodeModal from '@/components/admin/tables/TableQRCodeModal';
import EditorToolbar from './EditorToolbar';
import EditorCanvas from './EditorCanvas';
import EditorInspector from './EditorInspector';
import EditorPreviewModal from './EditorPreviewModal';
import styles from './FloorPlanEditor.module.css';

/**
 * The metre-scale floor-plan editor (FLOOR-PLAN-REVAMP §4.3) — toolbar · canvas ·
 * inspector over the one `FloorPlanScene`. Table geometry is edited locally and
 * saved with a single whole-document PUT; a table's identity, details and QR
 * stay on /api/tables (create / delete / details / QR modals), which reload the
 * plan afterwards. Those lifecycle ops are locked while geometry is unsaved so a
 * reload never discards edits.
 */
export default function FloorPlanEditor() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const notify = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3000);
  }, []);

  const tables = useEditorTables(notify);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showProps, setShowProps] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const editor = useFloorPlanEditor({ onDeleteSelected: () => setShowDelete(true) });
  const selectedDto = editor.selectedId ? tables.tables.find((tt) => tt.id === editor.selectedId) : undefined;

  const afterTableChange = useCallback(() => {
    setShowCreate(false);
    setShowDelete(false);
    setShowProps(false);
    editor.reload();
  }, [editor]);

  const confirmDelete = async () => {
    if (!selectedDto || editor.dirty) {
      notify('error', t('editor_save_first', 'Save layout changes before editing table details.'));
      setShowDelete(false);
      return;
    }
    await tables.deleteTable(selectedDto.id, selectedDto.tableNumber);
    afterTableChange();
  };

  const banner = message ?? editor.message;

  if (editor.status === 'loading') {
    return <div className={styles.state}>{t('loading_tables', 'Loading tables...')}</div>;
  }
  if (editor.status === 'error') {
    return (
      <div className={styles.state} role="alert">
        {t('floor_plan_load_error', 'The floor plan could not load.')}{' '}
        <button type="button" className={styles.retry} onClick={editor.reload}>
          {t('retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      {banner && <div className={`${styles.message} ${styles[banner.type]}`}>{banner.text}</div>}

      <EditorToolbar
        editor={editor}
        addDisabled={editor.dirty}
        onAddTable={() => setShowCreate(true)}
        onPreview={() => setShowPreview(true)}
      />

      <div className={styles.workspace}>
        <EditorCanvas
          editor={editor}
          ariaLabel={t('editor_canvas_aria', 'Floor plan editor canvas')}
          formatTableLabel={(table) =>
            t('editor_table_aria', 'Table {{number}}, {{seats}} seats', {
              number: table.tableNumber,
              seats: table.maxGuests,
            })
          }
        />
        <EditorInspector
          editor={editor}
          metadataLocked={editor.dirty}
          onEditDetails={() => setShowProps(true)}
          onShowQR={() => selectedDto && tables.setQrTable(selectedDto)}
          onDelete={() => setShowDelete(true)}
        />
      </div>

      <CreateTableModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreateTable={async (dto) => {
          const created = await tables.createTable(dto);
          afterTableChange();
          return created;
        }}
        existingTableNumbers={tables.tables.map((tt) => tt.tableNumber)}
        canvasWidth={editor.committed.widthMeters}
        canvasHeight={editor.committed.heightMeters}
      />

      <DeleteTableModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
        tableNumber={selectedDto?.tableNumber}
        isDeleting={false}
      />

      {showProps && selectedDto && (
        <TablePropertiesModal
          isOpen={showProps}
          table={selectedDto}
          onClose={() => setShowProps(false)}
          onUpdateTable={(updates) => tables.patchLocal(selectedDto.id, updates)}
          onSave={async (id, updates) => {
            // Position is owned by the plan document — pass its authoritative
            // geometry so a metadata save never reverts a saved drag.
            const geo = editor.committed.tables.find((tt) => tt.id === id);
            await tables.saveProperties(id, updates, {
              x: geo?.positionX ?? selectedDto.positionX,
              y: geo?.positionY ?? selectedDto.positionY,
            });
            afterTableChange();
          }}
        />
      )}

      {tables.qrTable && (
        <TableQRCodeModal
          isOpen={Boolean(tables.qrTable)}
          onClose={() => tables.setQrTable(null)}
          tableId={tables.qrTable.id}
          tableNumber={tables.qrTable.tableNumber}
          qrCodeData={tables.qrTable.qrCodeData}
          qrCodeGeneratedAt={tables.qrTable.qrCodeGeneratedAt}
          onRegenerate={() => tables.regenerateQR(tables.qrTable!)}
        />
      )}

      <EditorPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        document={editor.document}
        skinClassName={guestScene.skin}
      />
    </div>
  );
}
