'use client';

// craft /reservations — the hand-drawn seating chart + booking docket
// (craft-stitch-prompts Prompt 7a/7b; decided deviations 2026-07-23: one
// uniform table marker, details in the "Your Tables" docket, party pills 1-8
// + custom input, no bottom tab bar). The whole orchestration is the shared
// ReservationsPageLayout; this file only supplies the craft modules: a kraft
// chart plate with a masking-tape label + stamped markers and a hand-drawn
// legend, tear-off date leaves + letterpress time chips, stamped party pills,
// a handwritten tables docket with a saffron sticky-note capacity banner, and
// the terracotta letterpress "Book Now" pill from the primitives layer.
import ReservationsPageLayout from '@/components/reservation/reservations-page/ReservationsPageLayout';
import page from './reservations/ReservationsPage.module.css';
// The floor plan is now the shared FloorPlanGuestMap (self-styled from semantic
// tokens); the template only supplies the scene's craft skin scalars.
import scene from './floor-plan/FloorPlanScene.module.css';
import guests from './reservations/PartySize.module.css';
import dateTime from './reservations/DateTimePicker.module.css';
// One module serves both docket areas (selected tables + capacity note) —
// their class keys are disjoint, so no collisions.
import docket from './reservations/TablesDocket.module.css';

export default function ReservationsPage() {
  return (
    <ReservationsPageLayout
      styles={{ page, floorPlanSkin: scene.skin, guests, dateTime, selectedTables: docket, capacity: docket }}
    />
  );
}
