'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { List, Map, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import FormField from '@/components/design-system/FormField';
import styles from './StaffTableTools.module.css';

interface Props {
  readonly view: 'map' | 'list';
  readonly onViewChange: (view: 'map' | 'list') => void;
  readonly onRefresh: () => void;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly zones?: readonly { readonly id: string; readonly name: string }[];
  readonly zoneId?: string | null;
  readonly onZoneChange?: (id: string | null) => void;
}

export default function StaffTableTools({
  view,
  onViewChange,
  onRefresh,
  disabled = false,
  isLoading = false,
  searchQuery,
  onSearchChange,
  zones = [],
  zoneId,
  onZoneChange,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className={styles.tools} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('staff_table_tools', 'Table tools')}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={21} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className={styles.panel} aria-label={t('staff_table_tools', 'Table tools')}>
          <fieldset disabled={disabled} className={styles.view}>
            <legend>{t('cashier.tables.view_toggle', 'Table view')}</legend>
            <StaffButton
              variant={view === 'map' ? 'primary' : 'secondary'}
              aria-pressed={view === 'map'}
              onClick={() => onViewChange('map')}
            >
              <Map size={18} aria-hidden="true" />
              {t('map', 'Map')}
            </StaffButton>
            <StaffButton
              variant={view === 'list' ? 'primary' : 'secondary'}
              aria-pressed={view === 'list'}
              onClick={() => onViewChange('list')}
            >
              <List size={18} aria-hidden="true" />
              {t('list', 'List')}
            </StaffButton>
          </fieldset>
          <FormField label={t('staff_table_search', 'Search tables')}>
            <input
              type="search"
              value={searchQuery}
              disabled={disabled}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </FormField>
          {onZoneChange && zones.length > 0 && (
            <FormField label={t('floor_plan', 'Floor plan')}>
              <select
                value={zoneId ?? ''}
                disabled={disabled}
                onChange={(event) => onZoneChange(event.target.value || null)}
              >
                <option value="">{t('everywhere', 'Everywhere')}</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <StaffButton onClick={onRefresh} disabled={disabled || isLoading}>
            <RefreshCw size={18} aria-hidden="true" />
            {t('cashier.workspace.refresh')}
          </StaffButton>
        </div>
      )}
    </div>
  );
}
