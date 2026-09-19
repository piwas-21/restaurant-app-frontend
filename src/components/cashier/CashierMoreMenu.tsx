'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Ellipsis } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './CashierMoreMenu.module.css';

const MoreMenuPanels = dynamic(() => import('./CashierMoreMenuPanels'));

type MorePanel = 'zreport' | 'sound' | 'autoprint' | null;

/**
 * The workspace "More" menu (POS plan §5.1): the occasional, non-order-specific operations —
 * Z report, notification sound, auto-print settings — that the legacy cashier header carried
 * as permanent buttons. Pilot feedback: the workspace destinations shipped without any of
 * them. Diagnostics stays on the legacy page until the shell owns the SSE internals it reads.
 */
export default function CashierMoreMenu() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<MorePanel>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const open = (next: Exclude<MorePanel, null>) => {
    setIsOpen(false);
    setPanel(next);
  };

  const items: ReadonlyArray<{ key: Exclude<MorePanel, null>; label: string }> = [
    { key: 'zreport', label: t('cashier.workspace.more_zreport') },
    { key: 'sound', label: t('cashier.workspace.more_sound') },
    { key: 'autoprint', label: t('cashier.workspace.more_autoprint') },
  ];

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t('cashier.workspace.more')}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Ellipsis size={20} aria-hidden="true" />
        <span>{t('cashier.workspace.more')}</span>
      </button>
      {isOpen && (
        <menu className={styles.menu} aria-label={t('cashier.workspace.more')}>
          {items.map((item) => (
            <li key={item.key}>
              <button type="button" className={styles.item} role="menuitem" onClick={() => open(item.key)}>
                {item.label}
              </button>
            </li>
          ))}
        </menu>
      )}
      {panel !== null && <MoreMenuPanels panel={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
