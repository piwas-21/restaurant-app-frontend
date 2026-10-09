import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
import { apiBaseUrl } from '../helpers/config';
import { getE2EDbPool } from '../helpers/db';

const TABLE_ALLOCATION_LOCK = 7_042_026;
const TABLE_NUMBER_FLOOR = 9_000;
const CREATED_BY = 'e2e-p11-table-account';

export interface TableAccountP11Fixture {
  readonly tableId: string;
  readonly tableNumber: string;
  readonly qrCodeData: string;
}

interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
}

interface GeneratedQr {
  readonly tableId: string;
  readonly tableNumber: string;
  readonly qrCodeData: string;
}

/** Creates one retained table record and asks the real Admin API for its table QR identity. */
export async function createTableAccountP11Fixture(adminAccessToken: string): Promise<TableAccountP11Fixture> {
  const table = await insertRunOwnedTable();
  const api = await request.newContext({
    baseURL: apiBaseUrl(),
    extraHTTPHeaders: { Authorization: `Bearer ${adminAccessToken}` },
  });

  try {
    const response = await api.post(`/api/Tables/${encodeURIComponent(table.tableId)}/generate-qr`);
    const body = (await response.json()) as ApiResponse<GeneratedQr>;
    const qr = body.data;
    const qrCodeData = qr?.qrCodeData ?? '';
    if (
      !response.ok() ||
      body.success !== true ||
      qr?.tableId?.toLowerCase() !== table.tableId.toLowerCase() ||
      qr?.tableNumber !== table.tableNumber ||
      !qrCodeData.startsWith(`table_${table.tableId}_`)
    ) {
      throw new Error('P11 Admin QR generation did not return the created table identity.');
    }
    return { ...table, qrCodeData };
  } finally {
    await api.dispose();
  }
}

async function insertRunOwnedTable(): Promise<Omit<TableAccountP11Fixture, 'qrCodeData'>> {
  const pool = getE2EDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [TABLE_ALLOCATION_LOCK]);
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
