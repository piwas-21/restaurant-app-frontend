'use client';

import React from 'react';
import { Controller } from 'react-hook-form';
import ProductOrderTypes from '@/components/admin/product/ProductOrderTypes';
import type { EditorSectionsContext } from './editorSectionTypes';

interface EditorOrderTypesFieldProps {
  // readonly: S6759 — component props are never mutated.
  readonly context: EditorSectionsContext;
}

/**
 * The `availableOrderTypes` mask, shared by both kinds since §9.2 — bundle commands accept and
 * store it, so the control no longer promises a save that silently does nothing. A bundle inherits
 * nothing in practice (this editor has no category control), which makes the field the ONLY way to
 * restrict a combo.
 *
 * Its own component since S2, because it is now one control INSIDE `Service & availability` for an
 * item and the whole of that section for a bundle. The inherited-value shape with an Override
 * switch that the approved screen draws is D6, i.e. slice S5.
 */
export default function EditorOrderTypesField({ context }: EditorOrderTypesFieldProps) {
  const { editor, isBundle } = context;
  const { form } = editor;

  return (
    <Controller
      name="availableOrderTypes"
      control={form.control}
      render={({ field }) => (
        <ProductOrderTypes
          value={(field.value as number | null | undefined) ?? null}
          onChange={field.onChange}
          categories={editor.categories}
          primaryCategoryId={editor.primaryCategoryId}
          isBundle={isBundle}
          error={form.formState.errors.availableOrderTypes?.message as string | undefined}
        />
      )}
    />
  );
}
