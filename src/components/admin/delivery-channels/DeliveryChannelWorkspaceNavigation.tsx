'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeliveryChannelWorkspaceSectionId } from '@/hooks/admin/useDeliveryChannelWorkspaceSection';
import styles from './DeliveryChannelWorkspaceNavigation.module.css';

interface Props {
  readonly activeSection: DeliveryChannelWorkspaceSectionId;
  readonly onChange: (section: DeliveryChannelWorkspaceSectionId) => void;
}

const SECTIONS: readonly DeliveryChannelWorkspaceSectionId[] = [
  'overview',
  'connection',
  'menu',
  'publish',
  'availability',
  'exceptions',
];

/** @t-keys-table */
const SECTION_LABEL_KEYS: Record<DeliveryChannelWorkspaceSectionId, string> = {
  overview: 'deliveryChannels.workspace.overview',
  connection: 'deliveryChannels.workspace.connection',
  menu: 'deliveryChannels.workspace.menu',
  publish: 'deliveryChannels.workspace.publish',
  availability: 'deliveryChannels.workspace.availability',
  exceptions: 'deliveryChannels.workspace.exceptions',
};

export default function DeliveryChannelWorkspaceNavigation({ activeSection, onChange }: Readonly<Props>) {
  const { t } = useTranslation();
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('vertical');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const idPrefix = 'delivery-channel-workspace';

  useEffect(() => {
    const update = () => setOrientation(window.innerWidth <= 820 ? 'horizontal' : 'vertical');
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    let forwardKey = 'ArrowDown';
    let backwardKey = 'ArrowUp';
    if (orientation === 'horizontal') {
      const isRtl = document.documentElement.dir === 'rtl';
      forwardKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
      backwardKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
    }
    const current = SECTIONS.indexOf(activeSection);
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SECTIONS.length - 1;
    else if (event.key === forwardKey) next = (current + 1) % SECTIONS.length;
    else if (event.key === backwardKey) next = (current - 1 + SECTIONS.length) % SECTIONS.length;
    else return;

    event.preventDefault();
    const section = SECTIONS[next];
    onChange(section);
    tabRefs.current[section]?.focus();
  };

  return (
    <div
      className={styles.nav}
      role="tablist"
      aria-label={t('deliveryChannels.workspace.navigation')}
      aria-orientation={orientation}
    >
      {SECTIONS.map((section) => (
        <button
          key={section}
          id={`${idPrefix}-section-tab-${section}`}
          ref={(node) => {
            tabRefs.current[section] = node;
          }}
          type="button"
          role="tab"
          aria-selected={activeSection === section}
          aria-controls={`${idPrefix}-section-panel-${section}`}
          tabIndex={activeSection === section ? 0 : -1}
          className={`${styles.tab} ${activeSection === section ? styles.tabActive : ''}`}
          onClick={() => onChange(section)}
          onKeyDown={moveFocus}
        >
          {t(SECTION_LABEL_KEYS[section])}
        </button>
      ))}
    </div>
  );
}
