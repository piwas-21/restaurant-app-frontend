'use client';

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiError } from '@/hooks/useApiError';

export function useDeliveryChannelCategoryLoadError() {
  const { t } = useTranslation();
  const fallback = useRef('');
  fallback.current = t('deliveryChannels.errors.load');
  const { capture, clear, message } = useApiError();
  const captureLoadError = useCallback((cause: unknown) => capture(cause, { fallback: fallback.current }), [capture]);
  return { captureLoadError, clear, message };
}
