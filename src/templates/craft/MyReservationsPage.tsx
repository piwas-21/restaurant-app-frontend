'use client';

// craft /my-reservations — the docket-card stack (craft-stitch-prompts
// Prompt 7c). The whole orchestration is the shared MyReservationsLayout;
// this file only supplies the craft modules: transparent-canvas page chrome
// with a saffron tape label + Amatic heading, tilted warm-white docket cards
// with Amatic date/time, soft stamped Caveat status badges, a handwritten
// details footnote, the terracotta outline "Cancel" pill, and the hand-drawn
// empty-table state with a "Book a table" CTA.
import MyReservationsLayout from '@/components/reservation/my-reservations/MyReservationsLayout';
import page from './my-reservations/MyReservationsPage.module.css';
import card from './my-reservations/ReservationDocket.module.css';

export default function MyReservationsPage() {
  return <MyReservationsLayout styles={{ page, card }} />;
}
