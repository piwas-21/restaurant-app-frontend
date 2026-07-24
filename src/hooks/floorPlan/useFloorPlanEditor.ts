'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEditorDocument } from './useEditorDocument';
import { usePlanViewport } from './usePlanViewport';
import { useEditorDrag } from './useEditorDrag';
import { useEditorKeyboard } from './useEditorKeyboard';
import { overlappingTableIds } from '@/lib/floorPlan/editorGeometry';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';

/** A stable placeholder so the hooks below run unconditionally while loading. */
const EMPTY_DOC: FloorPlanDocument = {
  id: '',
  name: '',
  widthMeters: 12,
  heightMeters: 8,
  gridSizeCm: 25,
  backgroundStyle: '',
  isDefault: true,
  displayOrder: 0,
  updatedAt: null,
  walls: [],
  items: [],
  tables: [],
};

interface UseFloorPlanEditorArgs {
  /** Open the delete-table modal (a /api/tables lifecycle op the page owns). */
  onDeleteSelected: () => void;
}

/**
 * The admin editor's composed state (FLOOR-PLAN-REVAMP §4.3). Glues the document
 * store (history + save), the shared zoom/pan viewport, pointer move-drag, and
 * keyboard control into one flat API for the editor components. `document` is
 * what the canvas renders — the live drag preview when dragging, else the
 * committed present — while `committed` is what logic/save use. Overlap warnings
 * are derived here so the overlay and the toolbar counter share one source.
 */
export function useFloorPlanEditor({ onDeleteSelected }: UseFloorPlanEditorArgs) {
  const store = useEditorDocument();
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const committed = store.document ?? EMPTY_DOC;
  const viewport = usePlanViewport(committed.widthMeters, committed.heightMeters, store.status === 'ready');

  const drag = useEditorDrag({
    stageRef: viewport.stageRef,
    viewBox: viewport.viewBox,
    document: committed,
    snapEnabled,
    onSelect: store.select,
    onCommit: store.apply,
    fallback: viewport.stageHandlers,
  });

  const renderDoc = drag.previewDoc ?? committed;

  useEditorKeyboard({
    enabled: store.status === 'ready',
    document: committed,
    selectedId: store.selectedId,
    apply: store.apply,
    undo: store.undo,
    redo: store.redo,
    onDeleteSelected,
  });

  // Warn the browser before a reload / tab-close while geometry edits are unsaved.
  const { dirty } = store;
  useEffect(() => {
    if (!dirty) {
      return;
    }
    // Calling preventDefault triggers the browser's unsaved-changes prompt (the
    // modern replacement for the deprecated `event.returnValue`).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const overlaps = useMemo(() => overlappingTableIds(renderDoc.tables), [renderDoc.tables]);
  const selectedTable: FloorPlanTableGeometry | null = renderDoc.tables.find((t) => t.id === store.selectedId) ?? null;

  return {
    ...store,
    document: renderDoc,
    committed,
    gridVisible,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    viewport,
    dragHandlers: drag.handlers,
    guides: drag.guides,
    dragging: drag.dragging,
    overlaps,
    overlapCount: overlaps.size,
    selectedTable,
  };
}

export type FloorPlanEditorApi = ReturnType<typeof useFloorPlanEditor>;
