'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { reservationService } from '@/services/reservationService';
import { TableDto, TimeSlotDto } from '@/types/reservation';
import {
  computeTableAvailability,
  getCapacityWarningMessage,
  getTimeSlotOptions,
  partyExceedsEveryTable,
} from '@/utils/reservationForm';

/**
 * Table / date / time / slot selection + availability for the reservations page: loads tables,
 * fetches time slots on date/guest changes, recomputes booked tables + capacity on time changes,
 * and gates selection of booked tables. Extracted from app/reservations/page.tsx (Sprint 4/6);
 * behaviour unchanged. Pure computation lives in utils/reservationForm.
 */
export function useReservationAvailability() {
  const { t } = useTranslation();

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [numberOfGuests, setNumberOfGuests] = useState<number>(2);

  const [allTables, setAllTables] = useState<TableDto[]>([]);
  const [bookedTableIds, setBookedTableIds] = useState<string[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlotDto[]>([]);
  const [loading, setLoading] = useState(false);
  /** Slot-specific capacity note: tables are free at this time, but none fit the party. */
  const [slotCapacityWarning, setSlotCapacityWarning] = useState<string>('');

  /**
   * The "no single table fits this party" notice is DERIVED from the guest count, not
   * stored. It used to be reachable only through `computeTableAvailability` — i.e.
   * after a date AND a time had been chosen — so a party of 12 learned nothing until
   * two more fields were filled in, which is the wrong moment to find out. It depends
   * on nothing but the table list and the party size, so it shows the instant the
   * count is raised.
   *
   * Deriving it (rather than syncing state in an effect) is deliberate: the two
   * notices would otherwise race, each clearing the other's message on unrelated
   * date/time/guest changes. The party-wide case wins when both apply — it is the
   * more fundamental fact, and its wording already covers the other.
   */
  const capacityWarning = partyExceedsEveryTable(allTables, numberOfGuests)
    ? getCapacityWarningMessage(t, numberOfGuests)
    : slotCapacityWarning;

  // Load all tables on mount (fire-and-forget; loadAllTables toasts on failure).
  useEffect(() => {
    void loadAllTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check availability when date or guests change.
  useEffect(() => {
    if (selectedDate) {
      void fetchTimeSlots();
    } else {
      setAvailableTimeSlots([]);
      setBookedTableIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, numberOfGuests]);

  // Update booked tables when the time changes or slots update.
  useEffect(() => {
    if (selectedDate && availableTimeSlots.length > 0) {
      if (selectedTime) {
        const slotExists = availableTimeSlots.some((s) => s.startTime.startsWith(selectedTime));
        if (!slotExists) {
          setSelectedTime('');
          setBookedTableIds([]);
          return;
        }
        updateTableAvailability();
      }
    } else {
      setBookedTableIds([]);
      setSlotCapacityWarning('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime, availableTimeSlots]);

  const loadAllTables = async () => {
    try {
      const tables = await reservationService.getTables(true); // Only active tables
      setAllTables(tables);
    } catch {
      enqueueSnackbar(t('failed_to_load_tables', 'Failed to load tables'), { variant: 'error' });
    }
  };

  const fetchTimeSlots = async () => {
    if (!selectedDate) return;

    setLoading(true);

    try {
      const result = await reservationService.getAvailableTimeSlots(selectedDate, numberOfGuests);

      if (result.error || !result.data) {
        setAvailableTimeSlots([]);
        return;
      }

      const timeSlots = result.data.timeSlots || [];
      setAvailableTimeSlots(timeSlots);

      // Restaurant closed on this day (no slots) — prompt the user to pick another date.
      if (timeSlots.length === 0) {
        const dateObj = new Date(selectedDate);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        enqueueSnackbar(
          t('restaurant_closed_on_date', 'Restaurant is closed on {{day}}, {{date}}. Please select another date.', {
            day: dayName,
            date: dateObj.toLocaleDateString(),
          }),
          { variant: 'warning', autoHideDuration: 5000 },
        );
        setSelectedDate('');
      }
    } catch {
      setAvailableTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const updateTableAvailability = () => {
    const { bookedTableIds: booked, capacityWarning: warning } = computeTableAvailability(
      selectedTime,
      availableTimeSlots,
      allTables,
      numberOfGuests,
      t,
    );
    setBookedTableIds(booked);
    if (warning !== null) setSlotCapacityWarning(warning);
  };

  const handleTableSelect = (table: TableDto) => {
    const isBooked = bookedTableIds.includes(table.id);
    const isSelected = selectedTableIds.includes(table.id);

    // Booked tables can't be selected (their markers are disabled; this guards direct calls).
    if (isBooked && !isSelected) {
      return;
    }

    setSelectedTableIds((prev) =>
      prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id],
    );
  };

  const selectedTables = allTables.filter((tbl) => selectedTableIds.includes(tbl.id));
  const timeSlotOptions = getTimeSlotOptions(selectedTableIds, availableTimeSlots);

  return {
    allTables,
    selectedTableIds,
    setSelectedTableIds,
    bookedTableIds,
    selectedTables,
    timeSlotOptions,
    capacityWarning,
    handleTableSelect,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    numberOfGuests,
    setNumberOfGuests,
    loading,
  };
}
