'use client';

import React from 'react';
import { CircleHelp } from 'lucide-react';
import styles from './EditorHelpDisclosure.module.css';

interface EditorHelpDisclosureProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

/** Native disclosure keeps contextual help available to pointer, keyboard and touch users. */
export default function EditorHelpDisclosure({ label, children }: EditorHelpDisclosureProps) {
  return (
    <details className={styles.help}>
      <summary aria-label={label}>
        <CircleHelp size={16} aria-hidden="true" />
        <span className={styles.label}>{label}</span>
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
