'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRoleHelpers } from '@/hooks/useRoleHelpers';
import { Phone, Calendar, CheckCircle, XCircle } from 'lucide-react';
import styles from '@/app/styles/AdminPage.module.css';
import tableStyles from './MembersTable.module.css';
import type { UserDto } from '@/types/user';

interface MembersTableProps {
  users: UserDto[];
  onEdit: (user: UserDto) => void;
  onDelete: (user: UserDto) => void;
  onReactivate?: (user: UserDto) => void;
  isLoading?: boolean;
}

const MembersTable: React.FC<MembersTableProps> = ({ users, onEdit, onDelete, onReactivate, isLoading = false }) => {
  const { t } = useTranslation();
  const { getRoleLabel, getRoleClassName } = useRoleHelpers();

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    // `toLocaleDateString()` with no arguments does not throw on an unparseable date — it returns
    // the literal STRING "Invalid Date". So the `try/catch` this replaces was dead code, and the
    // `-` it meant to render was unreachable: a malformed `createdAt` put "Invalid Date" in the
    // Created column instead. Same shape as `sessionService.isSessionExpired` (slice 2) — a catch
    // around something that cannot throw is a claim about the code, not a guard.
    const parsed = new Date(dateString);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className={styles.adminTableContainer}>
        <table className={styles.adminTable}>
          <thead>
            <tr>
              <th>{t('first_name')}</th>
              <th>{t('last_name')}</th>
              <th>{t('email_label')}</th>
              <th>{t('phone_label')}</th>
              <th>{t('role')}</th>
              <th>{t('status')}</th>
              <th>{t('created_at')}</th>
              <th>{t('actions_header')}</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, index) => (
              <tr key={index}>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
                <td>
                  <div className={tableStyles.skeleton} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.adminTableContainer}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>{t('first_name')}</th>
            <th>{t('last_name')}</th>
            <th>{t('email_label')}</th>
            <th>{t('phone_label')}</th>
            <th>{t('role')}</th>
            <th>{t('status')}</th>
            <th>{t('created_at')}</th>
            <th>{t('actions_header')}</th>
          </tr>
        </thead>
        <tbody>
          {users.length > 0 ? (
            users.map((user: UserDto) => (
              <tr key={user.id}>
                <td>{user.firstName}</td>
                <td>{user.lastName}</td>
                <td>{user.email}</td>
                <td>
                  <div className={tableStyles.phoneCell}>
                    {user.phoneNumber ? (
                      <>
                        <Phone size={14} />
                        <span>{user.phoneNumber}</span>
                      </>
                    ) : (
                      <span className={tableStyles.noData}>-</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`${tableStyles.roleBadge} ${tableStyles[getRoleClassName(user.role)]}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td>
                  {user.isDeleted ? (
                    <span className={`${tableStyles.statusBadge} ${tableStyles.deleted}`}>
                      <XCircle size={14} />
                      {t('deleted')}
                    </span>
                  ) : (
                    <span className={`${tableStyles.statusBadge} ${tableStyles.active}`}>
                      <CheckCircle size={14} />
                      {t('active')}
                    </span>
                  )}
                </td>
                <td>
                  <div className={tableStyles.dateCell}>
                    <Calendar size={14} />
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </td>
                <td className={styles.actionsCell}>
                  {user.isDeleted ? (
                    <button
                      className={`${styles.adminButton} ${styles.edit}`}
                      onClick={() => onReactivate && onReactivate(user)}
                      title={t('reactivate_user', 'Reactivate User')}
                    >
                      {t('reactivate', 'Restore')}
                    </button>
                  ) : (
                    <button
                      className={`${styles.adminButton} ${styles.edit}`}
                      onClick={() => onEdit(user)}
                      disabled={user.role === 'Customer'}
                      title={
                        user.role === 'Customer'
                          ? t('customers_edit_own_profile', 'Customers can only edit their own profile')
                          : t('edit')
                      }
                    >
                      {t('edit')}
                    </button>
                  )}
                  <button
                    className={`${styles.adminButton} ${styles.delete}`}
                    onClick={() => onDelete(user)}
                    title={user.isDeleted ? t('delete_permanently', 'Delete Permanently') : t('delete')}
                  >
                    {user.isDeleted ? t('delete_perm', 'Del Perm') : t('delete')}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8}>{t('no_users_found')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MembersTable;
