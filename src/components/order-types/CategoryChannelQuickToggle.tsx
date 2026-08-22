'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useCategoryChannelQuickToggle } from '@/hooks/orderTypes/useCategoryChannelQuickToggle';
import { quickToggleSummary } from '@/utils/categoryChannelStatus';
import styles from './CategoryChannelQuickToggle.module.css';

/**
 * The panel is code-split. It is mounted on the admin dashboard, the cashier screen and the server
 * screen, and on all three the SUMMARY is what earns its place — the panel itself is opened rarely.
 * Statically imported it pulled `BaseModal` and its portal into `/admin/dashboard`'s first load and
 * tripped the bundle-size gate (+11% on a page whose whole job is three headings).
 */
const ChannelQuickToggleModal = dynamic(() => import('./ChannelQuickToggleModal'), { ssr: false });

interface CategoryChannelQuickToggleProps {
  /** Extra class for the host surface to place the control in its own header. */
  readonly className?: string;
}

/**
 * The pinned order-type control, mounted on all three staff surfaces (admin, cashier, server).
 *
 * WHY IT EXISTS: closing a category to Dine-In at 12:15 on a Saturday has always been possible —
 * Restaurant settings → Order types → untick. Three menus deep, it never happens. This is the same
 * capability and the same writer, one tap from a screen the floor already has open.
 *
 * WHO SEES IT: `PUT /api/Categories/{id}` is `[RequireAdmin]`, so a Cashier or Server token gets a
 * 403 from the only endpoint that can do this. Rendering a control that always fails is worse than
 * rendering none, so the gate is the role, and it lives HERE rather than at each of the three
 * mounts — a fourth mount cannot forget it. Giving the floor roles their own write is an
 * authorisation decision (ORDER-TYPE-AVAILABILITY-PLAN §10), not a UI placement, so it is not made
 * here; until it is, a manager signed in on the till is the reach this buys.
 */
export default function CategoryChannelQuickToggle({ className }: CategoryChannelQuickToggleProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const allowed = user?.role?.toLowerCase() === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCategoryChannelQuickToggle(allowed);

  if (!allowed) return null;

  const restricted = toggle.statuses.some((status) => status.closed.length > 0);
  const summary = toggle.loading
    ? t('common.loading', 'Loading...')
    : quickToggleSummary(toggle.statuses, t, i18n.language || 'en');

  return (
    <div className={className}>
      <button
        type="button"
        className={`${styles.trigger} ${restricted ? styles.triggerRestricted : ''}`}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
      >
        <UtensilsCrossed size={16} aria-hidden="true" />
        <span className={styles.label}>
          {/* The label states the CATEGORY, not the channel. "Dine-In: off" is meaningless in the
              middle of a service — "Dürüm: closed to Dine In · 25 min" is the whole point. */}
          <span className={styles.caption}>{t('quick_channels_title', 'Order type availability')}</span>
          <span className={styles.summary}>{summary}</span>
        </span>
      </button>

      {/* Mounted only once opened: `dynamic` fetches the chunk on the first tap, and an unmounted
          modal is also one fewer subscriber to the same state. */}
      {isOpen && <ChannelQuickToggleModal isOpen onClose={() => setIsOpen(false)} toggle={toggle} />}
    </div>
  );
}
