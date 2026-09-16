'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { STAFF_WORKSPACE_SPLIT_MIN_WIDTH_PX } from '@/lib/staffWorkspaceLayout';
import styles from './StaffWorkspaceLayout.module.css';

export interface OperationalSplitViewProps {
  master: ReactNode;
  detail: ReactNode;
  detailOpen?: boolean;
  onBack?: () => void;
  backLabel?: string;
  minSplitWidth?: number;
  forceSinglePane?: boolean;
  className?: string;
}

export default function OperationalSplitView({
  master,
  detail,
  detailOpen = false,
  onBack,
  backLabel,
  minSplitWidth = STAFF_WORKSPACE_SPLIT_MIN_WIDTH_PX,
  forceSinglePane = false,
  className,
}: Readonly<OperationalSplitViewProps>) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const update = () => setContainerWidth(container.getBoundingClientRect().width || container.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const isSinglePane = forceSinglePane || (containerWidth !== null && containerWidth < minSplitWidth);
  const layoutClass = isSinglePane ? styles.single : styles.split;

  return (
    <section
      ref={containerRef}
      className={[layoutClass, className].filter(Boolean).join(' ')}
      data-layout={isSinglePane ? 'single' : 'split'}
      aria-label={t('staff.workspace', 'Staff workspace')}
    >
      <div className={styles.splitMaster} data-hidden={isSinglePane && detailOpen ? 'true' : undefined}>
        {master}
      </div>
      <div className={styles.splitDetail} data-hidden={isSinglePane && !detailOpen ? 'true' : undefined}>
        {isSinglePane && detailOpen && onBack && (
          <button type="button" className={styles.backButton} onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" /> {backLabel ?? t('back', 'Back')}
          </button>
        )}
        {(!isSinglePane || detailOpen) && detail}
      </div>
    </section>
  );
}
