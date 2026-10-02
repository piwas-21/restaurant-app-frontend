'use client';

import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import DeliveryChannelManagement from '@/components/admin/delivery-channels/DeliveryChannelManagement';

export default function DeliveryChannelsPage() {
  return (
    <AdminAuthGuard requiredRoles={['Admin']}>
      <DeliveryChannelManagement />
    </AdminAuthGuard>
  );
}
