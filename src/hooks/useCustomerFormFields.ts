'use client';

import { useEffect, useState } from 'react';
import { formFieldConfigService } from '@/services/formFieldConfigService';
import { DEFAULT_FORM_FIELD_RULES, type FormKey, type FormFieldRules } from '@/types/formFieldConfig';

/**
 * Modest module-scope cache (pattern: useRestaurantInfo) so the reservation
 * form, checkout contact and delivery address don't each issue their own
 * request. Failures are NOT cached — a later mount retries.
 */
const CACHE_TTL_MS = 60_000;

interface CacheState {
  data: Record<string, FormFieldRules> | null;
  fetchedAt: number;
  /** Single in-flight promise so concurrent first reads don't all hit the API. */
  inflight: Promise<Record<string, FormFieldRules> | null> | null;
}

const cache: CacheState = { data: null, fetchedAt: 0, inflight: null };

/** Force the next read to bypass the cache. Called after an admin save. */
export const invalidateFormFieldConfigCache = () => {
  cache.data = null;
  cache.fetchedAt = 0;
};

const isFresh = () => cache.data !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

const loadAllRules = async (): Promise<Record<string, FormFieldRules> | null> => {
  if (isFresh()) return cache.data;
  if (cache.inflight) return cache.inflight;
  cache.inflight = (async () => {
    try {
      const forms = await formFieldConfigService.getAll();
      if (!forms || forms.length === 0) return null; // empty config → caller falls back
      const grouped: Record<string, FormFieldRules> = {};
      for (const form of forms) {
        grouped[form.formKey] = Object.fromEntries(
          form.fields.map((f) => [f.fieldKey, { isVisible: f.isVisible, isRequired: f.isRequired }]),
        );
      }
      cache.data = grouped;
      cache.fetchedAt = Date.now();
      return grouped;
    } catch (error) {
      console.error('Error fetching form field configuration:', error);
      return null;
    } finally {
      cache.inflight = null;
    }
  })();
  return cache.inflight;
};

/**
 * The admin-configured visibility/required rules for one customer-facing form
 * (safe-fallback pattern: useEnabledOrderTypes). Fetch failure OR an empty
 * configuration falls back to {@link DEFAULT_FORM_FIELD_RULES} — which mirror
 * the backend registry defaults, i.e. today's behaviour — so a broken config
 * endpoint never breaks a customer form. Fetched rules are merged over the
 * defaults so a field the API doesn't know keeps its default rule.
 */
export function useCustomerFormFields(formKey: FormKey) {
  const [rules, setRules] = useState<FormFieldRules>(DEFAULT_FORM_FIELD_RULES[formKey]);
  const [loading, setLoading] = useState(!isFresh());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await loadAllRules();
      if (cancelled) return;
      const fetched = all?.[formKey];
      setRules(fetched ? { ...DEFAULT_FORM_FIELD_RULES[formKey], ...fetched } : DEFAULT_FORM_FIELD_RULES[formKey]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [formKey]);

  return { rules, loading };
}
