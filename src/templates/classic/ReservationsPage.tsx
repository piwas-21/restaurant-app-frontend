'use client';

// classic ReservationsPage (ADR-006 — reservations surface). The original RUMI
// /reservations page, relocated from src/app/reservations/page.tsx behind the
// `@active-template/ReservationsPage` re-export. The whole orchestration is the
// shared ReservationsPageLayout (also used by craft); this file only supplies
// the classic CSS modules for every area — the page chrome module (relocated
// to src/app/styles/, consolidated 2026-07-23 from 6 media blocks to a small
// fluid set with zero visual delta) plus each sub-component's existing
// colocated module — so the rendered page is unchanged.
import ReservationsPageLayout from '@/components/reservation/reservations-page/ReservationsPageLayout';
import chrome from '@/app/styles/ReservationsPage.module.css';
import panel from '@/app/styles/ReservationsBookingPanel.module.css';
import floorPlan from '@/components/reservation/VisualTableLayout.module.css';
import guests from '@/components/reservation/GuestSelector.module.css';
import dateTime from '@/components/reservation/DateTimeSelector.module.css';
import selectedTables from '@/components/reservation/SelectedTableInfo.module.css';
import capacity from '@/components/reservation/CapacityWarning.module.css';

// Chrome + panel are one logical module split for the 200-LOC limit; the
// shared layout expects a single `page` styles object (distinct keys — the
// spread cannot collide).
const page = { ...chrome, ...panel };

export default function ReservationsPage() {
  return <ReservationsPageLayout styles={{ page, floorPlan, guests, dateTime, selectedTables, capacity }} />;
}
