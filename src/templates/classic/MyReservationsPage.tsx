'use client';

// classic MyReservationsPage (ADR-006 — my-reservations surface). The original
// RUMI /my-reservations look, relocated from the former MyReservations
// component behind the `@active-template/MyReservationsPage` re-export. The
// whole orchestration is the shared MyReservationsLayout (also used by craft);
// this file only supplies the classic CSS module — the component's existing
// colocated module serves both the page chrome and the cards (its keys are
// disjoint per area), so the rendered page keeps the classic look.
import MyReservationsLayout from '@/components/reservation/my-reservations/MyReservationsLayout';
import styles from '@/components/reservation/MyReservations.module.css';

export default function MyReservationsPage() {
  return <MyReservationsLayout styles={{ page: styles, card: styles }} />;
}
