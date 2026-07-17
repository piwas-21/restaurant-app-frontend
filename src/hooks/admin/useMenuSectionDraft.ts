'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MenuSection, MenuSectionItem } from '@/types/menu';

/**
 * How a draft reaches its parent.
 *
 * - `explicit` — the draft is held locally until `commit()`. What the bundle modals
 *   do today: the section editor renders its own Save/Cancel pair.
 * - `live` — every mutation propagates immediately. What the unified editor page
 *   needs, since it owns a single page-level Save (owner call, slice 7 PR2c) and a
 *   nested second Save would be two competing commit points on one screen.
 *
 * Both modes ship because PR2c leaves the modals alive — PR2d deletes them, and this
 * flag goes with them. Same shape as slice 3's `preferProvidedQuantities`: preserve
 * the divergent behaviour behind a documented flag rather than reconcile it mid-move.
 */
export type MenuSectionCommitMode = 'explicit' | 'live';

interface UseMenuSectionDraftOptions {
  sections: MenuSection[];
  onChange: (sections: MenuSection[]) => void;
  commitMode?: MenuSectionCommitMode;
}

/**
 * Owns the menu-section draft: the local copy, its dirty flag, which rows are open,
 * and the drag/delete interaction state. Extracted verbatim from `MenuSectionEditor`
 * (redesign #176, slice 7) — the fuller half of the split `utils/menuSectionDraft.ts`
 * (PR1) promised, so the component is left rendering only.
 */
export function useMenuSectionDraft({ sections, onChange, commitMode = 'explicit' }: UseMenuSectionDraftOptions) {
  const [localSections, setLocalSections] = useState<MenuSection[]>(sections);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sectionToDelete, setSectionToDelete] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Reset local state when sections prop changes
  useEffect(() => {
    setLocalSections(sections);
    setHasChanges(false);
  }, [sections]);

  /**
   * The one write point. In `live` mode it also pushes upward, so the page's form
   * state is always the draft — there is no way to leave an edit stranded in here.
   */
  const applySections = useCallback(
    (next: MenuSection[]) => {
      setLocalSections(next);
      setHasChanges(true);
      if (commitMode === 'live') {
        onChange(next);
      }
    },
    [commitMode, onChange],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const addSection = useCallback(() => {
    const newSection: MenuSection = {
      id: `temp-${Date.now()}`,
      name: '',
      description: '',
      displayOrder: 0, // New section goes to top
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [],
    };

    // Update display orders for existing sections
    const updatedSections = localSections.map((s) => ({ ...s, displayOrder: s.displayOrder + 1 }));

    applySections([newSection, ...updatedSections]);
    setExpandedSections((current) => new Set([...current, newSection.id]));
  }, [localSections, applySections]);

  const updateSection = useCallback(
    (index: number, updates: Partial<MenuSection>) => {
      const newSections = [...localSections];
      newSections[index] = { ...newSections[index], ...updates };
      applySections(newSections);
    },
    [localSections, applySections],
  );

  const updateSectionItems = useCallback(
    (index: number, items: MenuSectionItem[]) => {
      updateSection(index, { items });
    },
    [updateSection],
  );

  const confirmRemoveSection = useCallback((index: number) => setSectionToDelete(index), []);
  const cancelRemoveSection = useCallback(() => setSectionToDelete(null), []);

  const handleRemoveSection = useCallback(() => {
    if (sectionToDelete !== null) {
      applySections(localSections.filter((_, i) => i !== sectionToDelete));
      setSectionToDelete(null);
    }
  }, [sectionToDelete, localSections, applySections]);

  const moveSection = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === localSections.length - 1)) {
        return;
      }

      const newSections = [...localSections];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
      newSections.forEach((section, i) => {
        section.displayOrder = i;
      });

      applySections(newSections);
    },
    [localSections, applySections],
  );

  const handleDragStart = useCallback((index: number) => setDraggedIndex(index), []);
  const handleDragEnd = useCallback(() => setDraggedIndex(null), []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      const newSections = [...localSections];
      const [draggedSection] = newSections.splice(draggedIndex, 1);
      newSections.splice(index, 0, draggedSection);
      newSections.forEach((section, i) => {
        section.displayOrder = i;
      });

      applySections(newSections);
      setDraggedIndex(index);
    },
    [draggedIndex, localSections, applySections],
  );

  /** No-op in `live` mode — every mutation has already propagated. */
  const commit = useCallback(() => {
    onChange(localSections);
    setHasChanges(false);
  }, [onChange, localSections]);

  const reset = useCallback(() => {
    setLocalSections(sections);
    setHasChanges(false);
  }, [sections]);

  return {
    localSections,
    // `live` drafts have no separate commit step, so there is never a pending state
    // for a Save/Cancel pair to act on — the page's own Save is the only one.
    hasChanges: commitMode === 'live' ? false : hasChanges,
    expandedSections,
    sectionToDelete,
    draggedIndex,
    toggleSection,
    addSection,
    updateSection,
    updateSectionItems,
    confirmRemoveSection,
    cancelRemoveSection,
    handleRemoveSection,
    moveSection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    commit,
    reset,
  };
}
