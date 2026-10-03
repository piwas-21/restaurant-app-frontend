import TableGuestAccountWorkspace from '@/components/table-service/TableGuestAccountWorkspace';
import TableGuestRouteRuntimeLoader from '@/contexts/TableGuestRouteRuntimeLoader';

export default function TableAccountPage() {
  return (
    <TableGuestRouteRuntimeLoader readPublicTableGuestFeature loadTableGuestLocaleForRoute>
      <TableGuestAccountWorkspace />
    </TableGuestRouteRuntimeLoader>
  );
}
