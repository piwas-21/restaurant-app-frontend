'use client';

import { useParams } from 'next/navigation';
import ServerOrderDetailWorkspace from '@/components/server/orders/ServerOrderDetailWorkspace';

export default function ServerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  return <ServerOrderDetailWorkspace orderId={decodeURIComponent(params.orderId ?? '')} />;
}
