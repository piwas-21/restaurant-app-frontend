'use client';

import { useState } from 'react';

export type DeliveryChannelWorkspaceSectionId =
  'overview' | 'connection' | 'menu' | 'publish' | 'availability' | 'exceptions';

export function useDeliveryChannelWorkspaceSection() {
  const [activeSection, setActiveSection] = useState<DeliveryChannelWorkspaceSectionId>('overview');
  return { activeSection, setActiveSection };
}
