'use client';

// craft /my-reservations — the docket-card stack (craft-stitch-prompts
// Prompt 7c). The whole orchestration is the shared MyReservationsLayout;
// this file only supplies the craft modules: transparent-canvas page chrome
// with a saffron tape label + Amatic heading, tilted warm-white docket cards
// with Amatic date/time, soft stamped Caveat status badges, a handwritten
// details footnote, the terracotta outline "Cancel" pill, and the hand-drawn
// empty-table state with a "Book a table" CTA. The edit dialog reuses the
// craft booking-page party-size and date/time skins.
import MyReservationsLayout from '@/components/reservation/my-reservations/MyReservationsLayout';
import page from './my-reservations/MyReservationsPage.module.css';
import docket from './my-reservations/ReservationDocket.module.css';
// The docket module is at its LOC limit, so the self-service edit action's own
// craft skin is a second module spread over it (the classic ReservationsPage
// chrome+panel pattern) — the keys are disjoint, so the spread cannot collide.
import editSkin from './my-reservations/ReservationEdit.module.css';
import guests from './reservations/PartySize.module.css';
import dateTime from './reservations/DateTimePicker.module.css';

const card = { ...docket, ...editSkin };

export default function MyReservationsPage() {
  return <MyReservationsLayout styles={{ page, card, guests, dateTime }} />;
}
