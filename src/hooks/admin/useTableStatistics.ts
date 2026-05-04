'use client';

import { useEffect, useMemo, useState } from 'react';
import tableLayoutService from '@/services/tableLayoutService';
import { reservationService } from '@/services/reservationService';
import { ReservationDto, ReservationStatus, TableDto } from '@/types/reservation';

const RESERVATIONS_PAGE_SIZE = 1000;
const POPULAR_TABLES_LIMIT = 5;
const SMALL_TABLE_MAX = 2;
const MEDIUM_TABLE_MAX = 4;
const LARGE_TABLE_MAX = 6;

export interface TableReservationStats {
  tableId: string;
  tableNumber: string;
  totalReservations: number;
  confirmedReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
  averagePartySize: number;
}

/**
 * Fetches tables + reservations once on mount and derives every counter
 * the statistics page renders. Pure-derivation memos keep the page
 * component a thin layout layer.
 */
export function useTableStatistics() {
  const [tables, setTables] = useState<TableDto[]>([]);
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [tablesData, reservationsData] = await Promise.all([
          tableLayoutService.getAllTables(),
          reservationService.getReservations({ pageSize: RESERVATIONS_PAGE_SIZE }),
        ]);
        if (cancelled) return;
        setTables(tablesData);
        setReservations(reservationsData.items || []);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const totalTables = tables.length;
    const activeTables = tables.filter((t) => t.isActive).length;
    const inactiveTables = totalTables - activeTables;
    const indoorTables = tables.filter((t) => !t.isOutdoor).length;
    const outdoorTables = totalTables - indoorTables;
    const totalCapacity = tables.reduce((sum, t) => sum + t.maxGuests, 0);
    const activeCapacity = tables.filter((t) => t.isActive).reduce((sum, t) => sum + t.maxGuests, 0);

    const pct = (n: number) => (totalTables > 0 ? (n / totalTables) * 100 : 0);

    return {
      totalTables,
      activeTables,
      inactiveTables,
      indoorTables,
      outdoorTables,
      totalCapacity,
      activeCapacity,
      activePercentage: pct(activeTables),
      indoorPercentage: pct(indoorTables),
      outdoorPercentage: pct(outdoorTables),
      circularTables: tables.filter((t) => t.shape === 'circle').length,
      squareTables: tables.filter((t) => t.shape === 'square').length,
      rectangularTables: tables.filter((t) => t.shape === 'rectangle').length,
      smallTables: tables.filter((t) => t.maxGuests <= SMALL_TABLE_MAX).length,
      mediumTables: tables.filter((t) => t.maxGuests > SMALL_TABLE_MAX && t.maxGuests <= MEDIUM_TABLE_MAX).length,
      largeTables: tables.filter((t) => t.maxGuests > MEDIUM_TABLE_MAX && t.maxGuests <= LARGE_TABLE_MAX).length,
      extraLargeTables: tables.filter((t) => t.maxGuests > LARGE_TABLE_MAX).length,
    };
  }, [tables]);

  const reservationStats = useMemo(() => {
    const byStatus = (status: ReservationStatus) => reservations.filter((r) => r.status === status).length;
    return {
      total: reservations.length,
      confirmed: byStatus(ReservationStatus.Confirmed),
      completed: byStatus(ReservationStatus.Completed),
      cancelled: byStatus(ReservationStatus.Cancelled),
      noShow: byStatus(ReservationStatus.NoShow),
    };
  }, [reservations]);

  const tableReservationStats = useMemo<TableReservationStats[]>(
    () =>
      tables.map((table) => {
        const own = reservations.filter((r) => r.tableId === table.id);
        return {
          tableId: table.id,
          tableNumber: table.tableNumber,
          totalReservations: own.length,
          confirmedReservations: own.filter((r) => r.status === ReservationStatus.Confirmed).length,
          completedReservations: own.filter((r) => r.status === ReservationStatus.Completed).length,
          cancelledReservations: own.filter((r) => r.status === ReservationStatus.Cancelled).length,
          noShowReservations: own.filter((r) => r.status === ReservationStatus.NoShow).length,
          averagePartySize:
            own.length > 0 ? Math.round(own.reduce((sum, r) => sum + r.numberOfGuests, 0) / own.length) : 0,
        };
      }),
    [tables, reservations],
  );

  const mostPopularTables = useMemo(
    () =>
      [...tableReservationStats]
        .sort((a, b) => b.totalReservations - a.totalReservations)
        .slice(0, POPULAR_TABLES_LIMIT),
    [tableReservationStats],
  );

  return { tables, loading, stats, reservationStats, tableReservationStats, mostPopularTables };
}
