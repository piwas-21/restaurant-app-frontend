import React from 'react';
import { useTranslation } from 'react-i18next';
import TableMarker from '@/components/table-layout/TableMarker';
import { CANVAS_ASPECT_PADDING_PCT } from '@/lib/tableCanvasGeometry';
import type { TableDto } from '@/types/reservation';
import styles from './TableCanvas.module.css';

interface TableCanvasProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  tables: TableDto[];
  selectedTable: TableDto | null;
  selectedTableIds: Set<string>;
  draggingTable: string | null;
  draggingEntrance: boolean;
  entrancePosition: { x: number; y: number };
  selectionMode: boolean;
  filters: {
    showIndoor: boolean;
    showOutdoor: boolean;
    showActive: boolean;
    showInactive: boolean;
  };
  onTableMouseDown: (e: React.MouseEvent, table: TableDto) => void;
  onToggleTableSelection: (tableId: string) => void;
  onEntranceMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

export default function TableCanvas({
  canvasRef,
  tables,
  selectedTable,
  selectedTableIds,
  draggingTable,
  draggingEntrance,
  entrancePosition,
  selectionMode,
  filters,
  onTableMouseDown,
  onToggleTableSelection,
  onEntranceMouseDown,
  onMouseMove,
  onMouseUp,
}: Readonly<TableCanvasProps>) {
  const { t } = useTranslation();

  const filteredTables = tables.filter((table) => {
    if (!filters.showIndoor && !table.isOutdoor) return false;
    if (!filters.showOutdoor && table.isOutdoor) return false;
    if (!filters.showActive && table.isActive) return false;
    if (!filters.showInactive && !table.isActive) return false;
    return true;
  });

  const getCursor = (tableId: string): string => {
    if (draggingTable === tableId) return 'grabbing';
    return selectionMode ? 'pointer' : 'grab';
  };

  const renderTable = (table: TableDto) => {
    const isSelected = selectedTable?.id === table.id;
    const isInSelectionSet = selectedTableIds.has(table.id);
    const stateClasses = [
      isSelected ? styles.selected : '',
      isInSelectionSet ? styles.inSelection : '',
      table.isActive ? '' : styles.inactive,
    ]
      .filter(Boolean)
      .join(' ');

    const handleMouseDown = (e: React.MouseEvent) => {
      if (selectionMode) {
        e.stopPropagation();
        onToggleTableSelection(table.id);
      } else {
        onTableMouseDown(e, table);
      }
    };

    return (
      <TableMarker
        key={table.id}
        tableNumber={table.tableNumber}
        maxGuests={table.maxGuests}
        positionX={table.positionX}
        positionY={table.positionY}
        className={stateClasses}
        cursor={getCursor(table.id)}
        ariaLabel={t('table_marker_aria', 'Table {{number}}, {{seats}} seats, {{status}}', {
          number: table.tableNumber,
          seats: table.maxGuests,
          status: table.isActive ? t('active', 'Active') : t('inactive', 'Inactive'),
        })}
        onMouseDown={handleMouseDown}
      >
        {table.isOutdoor && <span className={styles.outdoorBadge}>🌤️</span>}
        {!table.isActive && <span className={styles.inactiveBadge}>❌</span>}
        {isInSelectionSet && <span className={styles.checkmark}>✓</span>}
      </TableMarker>
    );
  };

  return (
    <div
      ref={canvasRef}
      className={styles.canvas}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        width: '100%',
        paddingBottom: `${CANVAS_ASPECT_PADDING_PCT}%`,
      }}
    >
      <div className={styles.canvasContent}>
        {/* Entrance */}
        <div
          className={`${styles.entrance} ${draggingEntrance ? styles.dragging : ''}`}
          style={{
            left: `${entrancePosition.x}%`,
            top: `${entrancePosition.y}%`,
          }}
          onMouseDown={onEntranceMouseDown}
        >
          🚪
        </div>

        {/* Tables */}
        {filteredTables.map(renderTable)}

        {/* Empty state */}
        {filteredTables.length === 0 && (
          <div className={styles.emptyState}>
            <p>No tables match the current filters</p>
            <p className={styles.emptyHint}>Adjust your filters or create a new table</p>
          </div>
        )}
      </div>
    </div>
  );
}
