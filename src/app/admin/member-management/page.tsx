'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchUsers, deleteStaff } from '@/services/userService';
import styles from '@/app/styles/AdminPage.module.css';
import RegisterStaffModal from '@/components/admin/RegisterStaffModal';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ResultModal from '@/components/common/ResultModal';

const MemberManagementPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('customers');
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isResultModalSuccess, setIsResultModalSuccess] = useState(false);


  const getUsers = async () => {
    setError(null);
    try {
      const role = activeTab === 'customers' ? 'Customer' : '';
      const token = localStorage.getItem('token');
      const data = await fetchUsers(
        role,
        showDeleted,
        searchTerm,
        page,
        pageSize
      );
      if (data.success) {
        const fetchedUsers = data.data.items;
        const usersToDisplay =
          activeTab === 'staff'
            ? fetchedUsers.filter((user: any) => user.role !== 'Customer')
            : fetchedUsers;

        setUsers(usersToDisplay);
        setTotalCount(data.data.totalCount);
      } else {
        setError('Failed to fetch users');
      }
    } catch (error) {
      setError('An error occurred while fetching users');
    }
  };

  useEffect(() => {
    getUsers();
  }, [activeTab, searchTerm, showDeleted, page, pageSize]);

  const handleEdit = (user: any) => {
    // Handle edit logic
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setIsConfirmationModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      setIsConfirmationModalOpen(false);
      try {
        const data = await deleteStaff(userToDelete.id);
        if (data.success) {
          setResultModalMessage(t('user_deleted_successfully'));
          setIsResultModalSuccess(true);
          getUsers(); // Refresh the list after deletion
        } else {
          setResultModalMessage(data.message || t('failed_to_delete_user'));
          setIsResultModalSuccess(false);
        }
      } catch (error) {
        setResultModalMessage(t('delete_user_error'));
        setIsResultModalSuccess(false);
      } finally {
        setIsResultModalOpen(true);
        setUserToDelete(null);
      }
    }
  };

  const handleCloseResultModal = () => {
    setIsResultModalOpen(false);
    setResultModalMessage('');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleStaffRegistered = () => {
    getUsers();
  }

  return (
    <div className={styles.adminContainer}>
      <div className={styles.adminHeader}>
        <h1>{t('admin_member_management_title')}</h1>
        <div>
          <button className={`${styles.adminButton} ${styles.add}`} onClick={() => setIsRegisterModalOpen(true)}>
            {t('register_staff')}
          </button>
          <button className={styles.adminButton}>
            Back to Dashboard
          </button>
        </div>
      </div>
      <div className={styles.adminContent}>
        <nav className={styles.adminNav}>
          <ul>
            <li>
              <a
                href="#"
                className={activeTab === 'customers' ? styles.activeLink : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('customers');
                }}
              >
                {t('customers')}
              </a>
            </li>
            <li>
              <a
                href="#"
                className={activeTab === 'staff' ? styles.activeLink : ''}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('staff');
                }}
              >
                {t('staff')}
              </a>
            </li>
          </ul>
        </nav>
        <div className={styles.filtersContainer}>
          <div className={styles.formGroup}>
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label>
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              {t('show_deleted')}
            </label>
          </div>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.adminTableContainer}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>{t('first_name')}</th>
                <th>{t('last_name')}</th>
                <th>{t('email_label')}</th>
                <th>{t('role')}</th>
                <th>{t('actions_header')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user: any) => (
                  <tr key={user.id}>
                    <td>{user.firstName}</td>
                    <td>{user.lastName}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <button
                        className={`${styles.adminButton} ${styles.edit}`}
                        onClick={() => handleEdit(user)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        className={`${styles.adminButton} ${styles.delete}`}
                        onClick={() => handleDeleteClick(user)}
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>{t('no_users_found')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <button onClick={() => setPage(page - 1)} disabled={page === 1}>
            {t('previous')}
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            {t('next')}
          </button>
        </div>
      </div>
      <RegisterStaffModal 
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onStaffRegistered={handleStaffRegistered}
      />
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={handleConfirmDelete}
        message={t('delete_user_confirmation_message', { name: userToDelete?.firstName + ' ' + userToDelete?.lastName })}
      />
      <ResultModal
        isOpen={isResultModalOpen}
        onClose={handleCloseResultModal}
        message={resultModalMessage}
        isSuccess={isResultModalSuccess}
      />
    </div>
  );
};

export default MemberManagementPage;
