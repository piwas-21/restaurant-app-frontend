'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCategories } from '@/services/categoryService';
import { useApiError } from '@/hooks/useApiError';
import type { Category } from '@/components/admin/product/types';

/**
 * The product editor's category list, AND the sentence for when it does not arrive.
 *
 * Split out of `useProductEditorForm` because the failure had nowhere to go: the fetch was
 * `load().catch((err) => console.error(...))`, which is invisible to `scripts/check-bare-catch.mjs`
 * (the ratchet counts `catch {`/`catch (e) {` blocks, not `.catch()` callbacks) and invisible to the
 * admin. What they saw instead was an editor whose category chips and primary-category select were
 * simply EMPTY — indistinguishable from a tenant that has not created any category yet, on a screen
 * whose next action is Save.
 *
 * The E9 shape here is `useApiError` and not a toast: the editor is a surface that HOLDS its errors
 * (it already renders `errors.root` and a per-field message under every input), so the reason
 * belongs beside the control it explains — `ProductBasicInfo` renders it directly under the empty
 * chip group.
 *
 * Both failure shapes are captured, which is the second half of the defect. `/api/Categories`
 * THROWS `ApiError` on a non-2xx, but a handler refusal arrives INSIDE a 200
 * (`Ok(ApiResponse.Failure(...))`) and RESOLVES — the old code tested `response.success` and, on
 * false, fell out of the function without setting anything at all. `capture` reads both shapes
 * (`routeApiError` → `asResolvedFailure`), so neither path is silent now.
 */
export function useEditorCategories(isBundle: boolean) {
  const { t } = useTranslation();
  // `t` through a ref, and NOT in the dependency array below (the house pattern —
  // `useCategoryManagement` does the same). i18next hands back a fresh `t` whenever the language
  // changes, and a test's `useTranslation` stub hands back a fresh one on EVERY render: as a
  // dependency it turns this one-shot load into fetch → setState → re-render → fetch, which is a
  // hang rather than a failing assertion.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { message, capture, clear } = useApiError();

  useEffect(() => {
    // Bundles have no category control (MenuBundleDto carries none), so don't fetch for them.
    if (isBundle) return;

    // The editor can be unmounted mid-flight (the admin navigates back off a slow load). Without
    // this the late answer would write state on a dead component — and, worse for a failure, park
    // an error sentence on a screen that has moved on.
    let live = true;

    const load = async () => {
      const fallback = tRef.current('failed_to_load_categories', 'Failed to load categories');
      try {
        const response = await getCategories();
        if (!live) return;
        if (!response.success) {
          capture(response, { fallback });
          return;
        }
        setCategories(response.data?.items ?? []);
        clear();
      } catch (err) {
        if (live) capture(err, { fallback });
      }
    };

    void load();

    return () => {
      live = false;
    };
  }, [isBundle, capture, clear]);

  return { categories, categoriesError: message };
}

export default useEditorCategories;
