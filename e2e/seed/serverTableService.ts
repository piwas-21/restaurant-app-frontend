import { randomUUID } from 'node:crypto';
import { getE2EDbPool } from '../helpers/db';

const TABLE_ALLOCATION_LOCK = 7_042_026;
const TABLE_NUMBER_FLOOR = 9_000;
const CREATED_BY = 'e2e-server-table-service';

export interface ServerTableFixture {
  tableId: string;
  tableNumber: string;
}

/** Allocate an isolated numeric table identity for one parallel Server flow. */
export async function createServerTableFixture(): Promise<ServerTableFixture> {
  const pool = getE2EDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [TABLE_ALLOCATION_LOCK]);
    const retired = await client.query<{ id: string; table_number: string }>(
      `SELECT id, table_number
       FROM "Tables"
       WHERE created_by = $1 AND is_active = FALSE
       ORDER BY created_at, id
       LIMIT 1
       FOR UPDATE`,
      [CREATED_BY],
    );
    const reusable = retired.rows[0];
    if (reusable) {
      await client.query(
        `UPDATE "Tables"
         SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = $2
         WHERE id = $1`,
        [reusable.id, CREATED_BY],
      );
      await client.query('COMMIT');
      return { tableId: reusable.id, tableNumber: reusable.table_number };
    }

    const next = await client.query<{ table_number: number }>(
      `SELECT GREATEST(
         $1,
         COALESCE(MAX(table_number::integer) + 1, $1)
       ) AS table_number
       FROM "Tables"
       WHERE table_number ~ '^[0-9]+$'`,
      [TABLE_NUMBER_FLOOR],
    );
    const tableNumber = String(next.rows[0]?.table_number ?? TABLE_NUMBER_FLOOR);
    const tableId = randomUUID();
    await client.query(
      `INSERT INTO "Tables" (
         id, table_number, max_guests, is_active, is_outdoor,
         position_x, position_y, width, height, shape, rotation, created_by
       ) VALUES ($1, $2, 4, TRUE, FALSE, 0, 0, 80, 80, 'rectangle', 0, $3)`,
      [tableId, tableNumber, CREATED_BY],
    );
    await client.query('COMMIT');
    return { tableId, tableNumber };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Kitchen and printer-app are outside this browser test. Move the round to the
 * exact persisted state their real acknowledgements produce so the Server task
 * feed can exercise its real delivery mutation.
 */
export async function makeServerRoundDeliverable(orderId: string): Promise<void> {
  const pool = getE2EDbPool();
  const order = await pool.query(
    `UPDATE orders
     SET status = 'Ready', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND service_session_id IS NOT NULL`,
    [orderId],
  );
  if (order.rowCount !== 1) {
    throw new Error(`Expected one table-service order to become Ready; updated ${order.rowCount ?? 0}`);
  }

  const routing = await pool.query(
    `UPDATE "OrderRoutingStates"
     SET status = 'Printed', failure_reason = NULL,
         last_acknowledged_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP, version = version + 1
     WHERE order_id = $1 AND is_required = TRUE`,
    [orderId],
  );
  if ((routing.rowCount ?? 0) < 1) {
    throw new Error('The created round has no required routing state to acknowledge');
  }
}

/**
 * Retire one generated E2E table for reuse without breaking the durable
 * order-change journal, whose FK intentionally forbids hard-deleting orders.
 */
export async function cleanupServerTableFixture(tableId: string): Promise<void> {
  const pool = getE2EDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query<{ id: string }>(
      'SELECT id FROM "Tables" WHERE id = $1 AND created_by = $2 FOR UPDATE',
      [tableId, CREATED_BY],
    );
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return;
    }
    await client.query(
      `DELETE FROM table_service_payment_handoffs
       WHERE service_session_id IN (SELECT id FROM table_service_sessions WHERE table_id = $1)`,
      [tableId],
    );
    await client.query(
      `DELETE FROM table_reservations
       WHERE table_id = $1 OR order_id IN (SELECT id FROM orders WHERE table_id = $1)`,
      [tableId],
    );
    await client.query(
      `UPDATE orders
       SET status = CASE WHEN status IN ('Completed', 'Cancelled') THEN status ELSE 'Cancelled' END,
           updated_at = CURRENT_TIMESTAMP, updated_by = $2
       WHERE table_id = $1`,
      [tableId, CREATED_BY],
    );
    await client.query(
      `UPDATE table_service_sessions
       SET status = 'Closed', closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP, updated_by = $2
       WHERE table_id = $1 AND status = 'Open'`,
      [tableId, CREATED_BY],
    );
    await client.query(
      `UPDATE "Tables"
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = $2
       WHERE id = $1 AND created_by = $2`,
      [tableId, CREATED_BY],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
