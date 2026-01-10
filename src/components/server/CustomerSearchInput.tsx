import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { searchUsers, UserDto } from '@/services/serverService';
import styles from './CustomerSearchInput.module.css';

interface CustomerSearchInputProps {
  value: string;
  selectedUser: UserDto | null;
  onValueChange: (value: string) => void;
  onUserSelect: (user: UserDto | null) => void;
  placeholder?: string;
}

export default function CustomerSearchInput({
  value,
  selectedUser,
  onValueChange,
  onUserSelect,
  placeholder,
}: CustomerSearchInputProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUsers([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchUsers(query);
      setUsers(results);
      setIsOpen(results.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('User search failed:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!selectedUser && value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, selectedUser, performSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onValueChange(newValue);
    if (selectedUser) {
      onUserSelect(null);
    }
  };

  const handleUserSelect = (user: UserDto) => {
    onUserSelect(user);
    onValueChange(user.fullName || `${user.firstName} ${user.lastName}`);
    setIsOpen(false);
    setUsers([]);
  };

  const handleClear = () => {
    onValueChange('');
    onUserSelect(null);
    setUsers([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || users.length <= 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, users.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < users.length) {
          handleUserSelect(users[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={`${styles.input} ${selectedUser ? styles.hasUser : ''}`}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => users.length > 0 && setIsOpen(true)}
          placeholder={placeholder || t('server.customer_name', 'Customer name (optional)')}
          autoComplete="off"
        />
        {isLoading && <span className={styles.spinner}>⏳</span>}
        {selectedUser && (
          <button className={styles.clearButton} onClick={handleClear} type="button">
            ✕
          </button>
        )}
      </div>

      {selectedUser && (
        <div className={styles.selectedBadge}>
          <span className={styles.checkIcon}>✓</span>
          <span>{t('server.registered_customer', 'Registered')}</span>
          {selectedUser.isDiscountActive && (
            <span className={styles.discountBadge}>
              {selectedUser.discountPercentage}% {t('server.discount', 'off')}
            </span>
          )}
        </div>
      )}

      {isOpen && users.length > 0 && (
        <div className={styles.dropdown}>
          {users.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={`${styles.dropdownItem} ${index === highlightedIndex ? styles.highlighted : ''}`}
              onClick={() => handleUserSelect(user)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.fullName || `${user.firstName} ${user.lastName}`}</span>
                <span className={styles.userEmail}>{user.email}</span>
              </div>
              {user.isDiscountActive && (
                <span className={styles.userDiscount}>
                  {user.discountPercentage}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
