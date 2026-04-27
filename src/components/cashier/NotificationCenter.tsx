'use client';

import React from 'react';
import { Notification } from '@/hooks/useNotification';
import { X } from 'lucide-react';
import styles from '@/app/styles/NotificationCenter.module.css';

interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export default function NotificationCenter({ notifications, onDismiss }: NotificationCenterProps) {
  return (
    <div className={styles.container}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${styles.notification} ${styles[notification.type]}`}
          role="alert"
          aria-live="assertive"
        >
          <div className={styles.content}>
            <div className={styles.titleWrapper}>
              <h3 className={styles.title}>{notification.title}</h3>
              <button
                className={styles.closeButton}
                onClick={() => onDismiss(notification.id)}
                aria-label="Dismiss notification"
              >
                <X size={18} />
              </button>
            </div>
            <p className={styles.message}>{notification.message}</p>
          </div>
          <div className={styles.progressBar} />
        </div>
      ))}
    </div>
  );
}
