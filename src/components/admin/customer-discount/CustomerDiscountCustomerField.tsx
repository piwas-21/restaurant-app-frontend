'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Search, UserCheck } from 'lucide-react';
import { UserDto } from '@/services/userService';
import styles from '../CustomerDiscountForm.module.css';

interface CustomerDiscountCustomerFieldProps {
  isEditMode: boolean;
  loading: boolean;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  // customer search
  selectedUser: UserDto | null;
  searchQuery: string;
  searchResults: UserDto[];
  searchLoading: boolean;
  showSearchResults: boolean;
  onSearchChange: (query: string) => void;
  onUserSelect: (user: UserDto) => void;
  onClearUser: () => void;
}

/**
 * The customer-search (or selected-customer card) + discount-name fields of
 * CustomerDiscountForm. Extracted verbatim from CustomerDiscountForm (Sprint 6 god-file decomposition).
 */
export default function CustomerDiscountCustomerField({
  isEditMode,
  loading,
  name,
  onChange,
  selectedUser,
  searchQuery,
  searchResults,
  searchLoading,
  showSearchResults,
  onSearchChange,
  onUserSelect,
  onClearUser,
}: CustomerDiscountCustomerFieldProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.formGrid}>
      <div className={styles.formGroup}>
        <label htmlFor="userSearch">
          {t('customer', 'Customer')} <span className={styles.required}>*</span>
        </label>

        {selectedUser ? (
          <div className={styles.selectedUserCard}>
            <div className={styles.selectedUserInfo}>
              <UserCheck size={20} />
              <div>
                <div className={styles.selectedUserName}>
                  {selectedUser.fullName || `${selectedUser.firstName} ${selectedUser.lastName}`}
                </div>
                <div className={styles.selectedUserEmail}>
                  {selectedUser.email || `${t('id', 'ID')}: ${selectedUser.id}`}
                </div>
              </div>
            </div>
            {!isEditMode && (
              <button type="button" onClick={onClearUser} className={styles.clearUserButton} disabled={loading}>
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                id="userSearch"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                disabled={loading}
                className={styles.searchInput}
                placeholder={t('search_by_name_or_email', 'Search by name or email...')}
                autoComplete="off"
              />
              {searchLoading && <Loader2 size={18} className={`${styles.searchIcon} ${styles.spinner}`} />}
            </div>

            {showSearchResults && searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => onUserSelect(user)}
                    className={styles.searchResultItem}
                  >
                    <div className={styles.searchResultInfo}>
                      <div className={styles.searchResultName}>
                        {user.fullName || `${user.firstName} ${user.lastName}`}
                      </div>
                      <div className={styles.searchResultEmail}>{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showSearchResults && searchResults.length === 0 && !searchLoading && (
              <div className={styles.searchNoResults}>
                {t('no_users_found_matching', 'No users found matching "{{query}}"', { query: searchQuery })}
              </div>
            )}
          </div>
        )}

        <small className={styles.help}>
          {selectedUser
            ? t('selected_customer_for_discount', 'Selected customer for this discount')
            : t('search_and_select_customer', 'Search and select a customer')}
        </small>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="name">
          {t('name', 'Name')} <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={onChange}
          disabled={loading}
          className={styles.input}
          placeholder={t('discount_name_placeholder', 'e.g., VIP 10% Discount')}
        />
      </div>
    </div>
  );
}
