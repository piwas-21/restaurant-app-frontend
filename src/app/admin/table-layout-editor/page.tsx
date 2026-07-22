'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import TableLayoutHeader from '@/components/admin/table-layout/TableLayoutHeader';
import TableFilters from '@/components/admin/table-layout/TableFilters';
import TableCanvas from '@/components/admin/table-layout/TableCanvas';
import TableActionsPopup from '@/components/admin/table-layout/TableActionsPopup';
import TablePropertiesModal from '@/components/admin/table-layout/TablePropertiesModal';
import { CreateTableModal } from '@/components/admin/table-layout/CreateTableModal';
import { DeleteTableModal } from '@/components/admin/table-layout/DeleteTableModal';
import TableQRCodeModal from '@/components/admin/tables/TableQRCodeModal';
import { useTableLayout } from '@/hooks/useTableLayout';
import { useTableDragAndDrop } from '@/hooks/table-layout/useTableDragAndDrop';
import { useTableActionsPopup } from '@/hooks/table-layout/useTableActionsPopup';
import { useTableLayoutMutations } from '@/hooks/table-layout/useTableLayoutMutations';
import type { TableDto } from '@/types/reservation';
import styles from './TableLayoutEditor.module.css';

export default function TableLayoutEditorPage() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrModalTable, setQRModalTable] = useState<TableDto | null>(null);
  const [filters, setFilters] = useState({
    showIndoor: true,
    showOutdoor: true,
    showActive: true,
    showInactive: true,
  });

  const layout = useTableLayout();

  useEffect(() => {
    // Both have their own try/catch; fire-and-forget.
    void layout.loadTables();
    void layout.loadEntrancePosition();
  }, [layout]);

  const mutations = useTableLayoutMutations({
    tables: layout.tables,
    setTables: layout.setTables,
    setSelectedTable: layout.setSelectedTable,
    setQRModalTable,
    showMessage: layout.showMessage,
  });

  const popup = useTableActionsPopup({
    canvasWidth: layout.CANVAS_WIDTH,
    canvasHeight: layout.CANVAS_HEIGHT,
    openPropertiesModal: () => setShowPropertiesModal(true),
    openQRModal: (table) => {
      setQRModalTable(table);
      setShowQRModal(true);
    },
    openDeleteModal: () => layout.setShowDeleteModal(true),
  });

  const drag = useTableDragAndDrop({
    canvasRef,
    canvasWidth: layout.CANVAS_WIDTH,
    canvasHeight: layout.CANVAS_HEIGHT,
    draggingTable: layout.draggingTable,
    draggingEntrance: layout.draggingEntrance,
    setDraggingTable: layout.setDraggingTable,
    setDraggingEntrance: layout.setDraggingEntrance,
    entrancePosition: layout.entrancePosition,
    setEntrancePosition: layout.setEntrancePosition,
    saveEntrancePosition: layout.saveEntrancePosition,
    selectedTable: layout.selectedTable,
    setSelectedTable: layout.setSelectedTable,
    setTables: layout.setTables,
    onTableClick: popup.openForTable,
  });

  if (layout.loading) {
    return (
      <AdminAuthGuard>
        <div className={styles.container}>
          <div className={styles.loading}>{t('loading_tables', 'Loading tables...')}</div>
        </div>
      </AdminAuthGuard>
    );
  }

  return (
    <AdminAuthGuard>
      <div className={styles.container}>
        {layout.message && (
          <div className={`${styles.message} ${styles[layout.message.type]}`}>{layout.message.text}</div>
        )}

        <TableLayoutHeader
          saving={layout.saving}
          onCreateTable={() => setShowCreateModal(true)}
          onSaveLayout={layout.handleSaveLayout}
        />

        <div className={styles.filtersRow}>
          <TableFilters filters={filters} onFilterChange={setFilters} />
        </div>

        <div className={styles.content}>
          <div className={styles.canvasContainer}>
            <TableCanvas
              canvasRef={canvasRef}
              tables={layout.tables}
              selectedTable={layout.selectedTable}
              selectedTableIds={new Set()}
              draggingTable={layout.draggingTable}
              draggingEntrance={layout.draggingEntrance}
              entrancePosition={layout.entrancePosition}
              selectionMode={false}
              filters={filters}
              onTableMouseDown={drag.handleTableMouseDown}
              onToggleTableSelection={() => {}}
              onEntranceMouseDown={drag.handleEntranceMouseDown}
              onMouseMove={drag.handleMouseMove}
              onMouseUp={drag.handleMouseUp}
            />

            {popup.isOpen && layout.selectedTable && (
              <TableActionsPopup
                table={layout.selectedTable}
                position={popup.position}
                onEdit={popup.handleEdit}
                onViewQR={popup.handleViewQR}
                onDelete={popup.handleDelete}
                onClose={popup.close}
              />
            )}
          </div>
        </div>

        {showPropertiesModal && layout.selectedTable && (
          <TablePropertiesModal
            isOpen={showPropertiesModal}
            table={layout.selectedTable}
            onClose={() => setShowPropertiesModal(false)}
            onUpdateTable={layout.updateSelectedTable}
            onSave={mutations.saveTableProperties}
          />
        )}

        {showQRModal && qrModalTable && (
          <TableQRCodeModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            tableId={qrModalTable.id}
            tableNumber={qrModalTable.tableNumber}
            qrCodeData={qrModalTable.qrCodeData}
            qrCodeGeneratedAt={qrModalTable.qrCodeGeneratedAt}
            onRegenerate={() => mutations.regenerateQRCode(qrModalTable)}
          />
        )}

        <CreateTableModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateTable={layout.handleCreateTable}
          existingTableNumbers={layout.tables.map((tt) => tt.tableNumber)}
          canvasWidth={layout.CANVAS_WIDTH}
          canvasHeight={layout.CANVAS_HEIGHT}
        />

        <DeleteTableModal
          isOpen={layout.showDeleteModal}
          onClose={() => layout.setShowDeleteModal(false)}
          onConfirm={layout.confirmDeleteTable}
          tableNumber={layout.deleteModalData.tableNumber}
          tableCount={layout.deleteModalData.tableCount}
          isDeleting={layout.saving}
        />
      </div>
    </AdminAuthGuard>
  );
}
