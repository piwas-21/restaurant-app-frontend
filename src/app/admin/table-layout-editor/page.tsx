'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import type { TableDto } from '@/types/reservation';
import { generateTableQRCode } from '@/services/tableQRService';
import styles from './TableLayoutEditor.module.css';

export default function TableLayoutEditorPage() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [showActionsPopup, setShowActionsPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [filters, setFilters] = useState({
    showIndoor: true,
    showOutdoor: true,
    showActive: true,
    showInactive: true,
  });
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrModalTable, setQRModalTable] = useState<TableDto | null>(null);
  const [rotatingTable, setRotatingTable] = useState<string | null>(null);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);

  const {
    tables,
    setTables,
    selectedTable,
    setSelectedTable,
    draggingTable,
    setDraggingTable,
    draggingEntrance,
    setDraggingEntrance,
    entrancePosition,
    setEntrancePosition,
    dragOffset,
    setDragOffset,
    loading,
    saving,
    message,
    showDeleteModal,
    setShowDeleteModal,
    deleteModalData,
    showMessage,
    loadTables,
    loadEntrancePosition,
    saveEntrancePosition,
    updateSelectedTable,
    handleCreateTable,
    confirmDeleteTable,
    handleSaveLayout,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
  } = useTableLayout();

  useEffect(() => {
    loadTables();
    loadEntrancePosition();
  }, [loadTables, loadEntrancePosition]);

  const handleMouseDown = (e: React.MouseEvent, table: TableDto) => {
    e.stopPropagation();
    setSelectedTable(table);
    setHasDragged(false); // Reset drag flag

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const tablePercentX = (table.positionX / CANVAS_WIDTH) * 100;
    const tablePercentY = (table.positionY / CANVAS_HEIGHT) * 100;
    const tableX = (tablePercentX / 100) * rect.width;
    const tableY = (tablePercentY / 100) * rect.height;

    setDragOffset({
      x: e.clientX - rect.left - tableX,
      y: e.clientY - rect.top - tableY,
    });
    setDraggingTable(table.id);
  };

  const handleEntranceMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const entranceX = (entrancePosition.x / 100) * rect.width;
    const entranceY = (entrancePosition.y / 100) * rect.height;

    setDragOffset({
      x: e.clientX - rect.left - entranceX,
      y: e.clientY - rect.top - entranceY,
    });
    setDraggingEntrance(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggingTable) {
      setHasDragged(true); // Mark that we've actually dragged
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      const percentX = (x / rect.width) * 100;
      const percentY = (y / rect.height) * 100;

      const pixelX = (percentX / 100) * CANVAS_WIDTH;
      const pixelY = (percentY / 100) * CANVAS_HEIGHT;

      const clampedX = Math.max(0, Math.min(CANVAS_WIDTH, pixelX));
      const clampedY = Math.max(0, Math.min(CANVAS_HEIGHT, pixelY));

      setTables((prev) =>
        prev.map((t) => (t.id === draggingTable ? { ...t, positionX: clampedX, positionY: clampedY } : t)),
      );
      setSelectedTable((prev) =>
        prev && prev.id === draggingTable ? { ...prev, positionX: clampedX, positionY: clampedY } : prev,
      );
    } else if (draggingEntrance) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const percentY = Math.max(0, Math.min(100, (y / rect.height) * 100));

      setEntrancePosition({ x: percentX, y: percentY });
    }
  };

  const handleMouseUp = () => {
    if (draggingTable) {
      setDraggingTable(null);
      // If we didn't actually drag (just clicked), show the popup
      if (!hasDragged && selectedTable) {
        handleTableClickWithPopup(selectedTable);
      }
      setHasDragged(false); // Reset for next interaction
    }
    if (draggingEntrance) {
      setDraggingEntrance(false);
      saveEntrancePosition(entrancePosition);
    }
  };

  const handleTableClickWithPopup = (table: TableDto) => {
    // Set selected table
    setSelectedTable(table);

    // Calculate popup position as percentage
    // Convert from pixel position to percentage of canvas
    const CANVAS_WIDTH = 600;
    const CANVAS_HEIGHT = 500;

    // Position popup close to the table (slightly offset to the right and down)
    const xPercent = ((table.positionX + 15) / CANVAS_WIDTH) * 100; // Small 15px offset
    const yPercent = ((table.positionY + 15) / CANVAS_HEIGHT) * 100; // Small 15px offset

    setPopupPosition({ x: xPercent, y: yPercent });
    setShowActionsPopup(true);
  };

  const handleEditTable = () => {
    setShowActionsPopup(false);
    setShowPropertiesModal(true);
  };

  const handleViewQRCode = () => {
    if (selectedTable) {
      setShowActionsPopup(false);
      setQRModalTable(selectedTable);
      setShowQRModal(true);
    }
  };

  const handleRotationStart = (tableId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const canvas = canvasRef.current;
    const table = tables.find((t) => t.id === tableId);
    if (!canvas || !table) return;

    const rect = canvas.getBoundingClientRect();

    // Calculate table center position in pixels
    const tablePercentX = (table.positionX / CANVAS_WIDTH) * 100;
    const tablePercentY = (table.positionY / CANVAS_HEIGHT) * 100;
    const tableCenterX = (tablePercentX / 100) * rect.width;
    const tableCenterY = (tablePercentY / 100) * rect.height;

    // Calculate initial angle from center to mouse
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const angle = Math.atan2(mouseY - tableCenterY, mouseX - tableCenterX) * (180 / Math.PI);

    // Store the starting angle offset (current rotation - mouse angle)
    const currentRotation = table.rotation || 0;
    setRotationStartAngle(currentRotation - angle);
    setRotatingTable(tableId);
    setSelectedTable(table);
  };

  const handleRotationMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const table = tables.find((t) => t.id === rotatingTable);
    if (!canvas || !table || !rotatingTable) return;

    const rect = canvas.getBoundingClientRect();

    // Calculate table center position in pixels
    const tablePercentX = (table.positionX / CANVAS_WIDTH) * 100;
    const tablePercentY = (table.positionY / CANVAS_HEIGHT) * 100;
    const tableCenterX = (tablePercentX / 100) * rect.width;
    const tableCenterY = (tablePercentY / 100) * rect.height;

    // Calculate angle from center to mouse
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const angle = Math.atan2(mouseY - tableCenterY, mouseX - tableCenterX) * (180 / Math.PI);

    // Calculate new rotation (angle + offset)
    let newRotation = angle + rotationStartAngle;

    // Normalize to 0-360
    while (newRotation < 0) newRotation += 360;
    while (newRotation >= 360) newRotation -= 360;

    // Update table rotation
    setTables((prev) => prev.map((t) => (t.id === rotatingTable ? { ...t, rotation: Math.round(newRotation) } : t)));
    setSelectedTable((prev) =>
      prev && prev.id === rotatingTable ? { ...prev, rotation: Math.round(newRotation) } : prev,
    );
  };

  const handleRotationEnd = async () => {
    if (!rotatingTable) return;

    const table = tables.find((t) => t.id === rotatingTable);
    if (table) {
      try {
        // Save the final rotation to backend
        await handleSaveTableProperties(table.id, { rotation: table.rotation || 0 });
      } catch (error: any) {
        showMessage('error', error.message || t('failed_to_rotate_table', 'Failed to rotate table'));
        // Revert on error
        loadTables();
      }
    }

    setRotatingTable(null);
    setRotationStartAngle(0);
  };

  const handleSaveTableProperties = async (tableId: string, updates: Partial<TableDto>) => {
    try {
      const tableLayoutService = (await import('@/services/tableLayoutService')).tableLayoutService;

      // Find the current table to get all required fields
      const currentTable = tables.find((t) => t.id === tableId);
      if (!currentTable) {
        throw new Error(t('table_not_found', 'Table not found'));
      }

      // Create UpdateTableDto with all required fields
      const updateData: any = {
        tableNumber: updates.tableNumber ?? currentTable.tableNumber,
        maxGuests: updates.maxGuests ?? currentTable.maxGuests,
        isActive: updates.isActive ?? currentTable.isActive,
        isOutdoor: updates.isOutdoor ?? currentTable.isOutdoor,
        positionX: updates.positionX ?? currentTable.positionX,
        positionY: updates.positionY ?? currentTable.positionY,
        width: updates.width ?? currentTable.width,
        height: updates.height ?? currentTable.height,
        shape: updates.shape ?? currentTable.shape,
        rotation: updates.rotation ?? currentTable.rotation ?? 0,
        notes: updates.notes ?? currentTable.notes,
      };

      const updatedTable = await tableLayoutService.updateTable(tableId, updateData);

      // Update the table in the local state
      setTables((prev) => prev.map((table) => (table.id === tableId ? { ...table, ...updatedTable } : table)));

      showMessage('success', t('table_updated_successfully', 'Table updated successfully'));
    } catch (error: any) {
      throw new Error(error.message || t('failed_to_update_table', 'Failed to update table'));
    }
  };

  const handleDeleteFromPopup = () => {
    if (selectedTable) {
      setShowActionsPopup(false);
      setShowDeleteModal(true);
    }
  };

  const handleRegenerateQR = async () => {
    if (!qrModalTable) return;

    try {
      const result = await generateTableQRCode(qrModalTable.id);
      const updatedData = {
        qrCodeData: result.qrCodeData,
        qrCodeGeneratedAt: result.qrCodeGeneratedAt,
      };

      // Update tables array
      setTables((prev) => prev.map((t) => (t.id === qrModalTable.id ? { ...t, ...updatedData } : t)));

      // Update modal table
      setQRModalTable((prev) => (prev ? { ...prev, ...updatedData } : null));

      // Update selected table to keep it in sync
      setSelectedTable((prev) => (prev && prev.id === qrModalTable.id ? { ...prev, ...updatedData } : prev));

      showMessage('success', t('qr_code_generated_successfully', 'QR code generated successfully!'));
    } catch (error: any) {
      showMessage('error', error.message || t('failed_generate_qr_code', 'Failed to generate QR code'));
    }
  };

  if (loading) {
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
        {/* Message Toast */}
        {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

        {/* Header */}
        <TableLayoutHeader
          saving={saving}
          onCreateTable={() => setShowCreateModal(true)}
          onSaveLayout={handleSaveLayout}
        />

        {/* Filters - Inline */}
        <div className={styles.filtersRow}>
          <TableFilters filters={filters} onFilterChange={setFilters} />
        </div>

        {/* Main Content */}
        <div className={styles.content}>
          {/* Canvas */}
          <div className={styles.canvasContainer}>
            <TableCanvas
              canvasRef={canvasRef}
              tables={tables}
              selectedTable={selectedTable}
              selectedTableIds={new Set()}
              draggingTable={draggingTable}
              draggingEntrance={draggingEntrance}
              entrancePosition={entrancePosition}
              selectionMode={false}
              filters={filters}
              onTableMouseDown={handleMouseDown}
              onToggleTableSelection={() => {}}
              onEntranceMouseDown={handleEntranceMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onRotationStart={handleRotationStart}
              onRotationMove={handleRotationMove}
              onRotationEnd={handleRotationEnd}
              rotatingTable={rotatingTable}
            />

            {/* Actions Popup */}
            {showActionsPopup && selectedTable && (
              <TableActionsPopup
                table={selectedTable}
                position={popupPosition}
                onEdit={handleEditTable}
                onViewQR={handleViewQRCode}
                onDelete={handleDeleteFromPopup}
                onClose={() => setShowActionsPopup(false)}
              />
            )}
          </div>
        </div>

        {/* Table Properties Modal */}
        {showPropertiesModal && selectedTable && (
          <TablePropertiesModal
            isOpen={showPropertiesModal}
            table={selectedTable}
            onClose={() => setShowPropertiesModal(false)}
            onUpdateTable={updateSelectedTable}
            onSave={handleSaveTableProperties}
          />
        )}

        {/* QR Code Modal */}
        {showQRModal && qrModalTable && (
          <TableQRCodeModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            tableId={qrModalTable.id}
            tableNumber={qrModalTable.tableNumber}
            qrCodeData={qrModalTable.qrCodeData}
            qrCodeGeneratedAt={qrModalTable.qrCodeGeneratedAt}
            onRegenerate={handleRegenerateQR}
          />
        )}

        {/* Create Table Modal */}
        <CreateTableModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateTable={handleCreateTable}
          existingTableNumbers={tables.map((t) => t.tableNumber)}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={CANVAS_HEIGHT}
        />

        {/* Delete Table Modal */}
        <DeleteTableModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDeleteTable}
          tableNumber={deleteModalData.tableNumber}
          tableCount={deleteModalData.tableCount}
          isDeleting={saving}
        />
      </div>
    </AdminAuthGuard>
  );
}
