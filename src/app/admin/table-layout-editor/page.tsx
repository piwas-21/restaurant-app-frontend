import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import FloorPlanEditor from '@/components/floor-plan/editor/FloorPlanEditor';

/**
 * Admin floor-plan editor route (FLOOR-PLAN-REVAMP §4.3). The page is a thin
 * shell: the auth guard plus the metre-scale `FloorPlanEditor`, which renders the
 * same `FloorPlanScene` the guest map uses. (Replaced the pixel-canvas
 * `TableCanvas` + `useTableLayout` editor in S6.)
 */
export default function TableLayoutEditorPage() {
  return (
    <AdminAuthGuard>
      <FloorPlanEditor />
    </AdminAuthGuard>
  );
}
