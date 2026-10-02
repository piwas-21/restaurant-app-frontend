'use client';

import { useEffect, useRef, useState } from 'react';
import type { DeliveryChannelStepId } from '@/types/deliveryChannelManagement';

export function useDeliveryChannelStep(connected: boolean) {
  const [activeStep, setActiveStep] = useState<DeliveryChannelStepId>('connect');
  const wasConnected = useRef(false);

  useEffect(() => {
    if (!connected) {
      wasConnected.current = false;
      setActiveStep('connect');
      return;
    }
    if (!wasConnected.current) {
      wasConnected.current = true;
      setActiveStep('menu');
    }
  }, [connected]);

  return { activeStep, setActiveStep };
}
