'use client';

import { useState, useCallback } from 'react';
import { fetchUsers, deleteStaff } from '@/services/userService';

export const useMemberManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getUsers = useCallback(async (role: string, showDeleted: boolean, searchTerm: string, page: number, pageSize: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUsers(role, showDeleted, searchTerm, page, pageSize) as { success: boolean; data?: { items: any[]; totalCount: number } };
      if (data.success && data.data) {
        const fetchedUsers = data.data.items;
        const usersToDisplay = role === '' ? fetchedUsers.filter((user: any) => user.role !== 'Customer') : fetchedUsers;
        setUsers(usersToDisplay);
        setTotalCount(data.data.totalCount);
      } else {
        setError('Failed to fetch users');
      }
    } catch {
      setError('An error occurred while fetching users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteUser = async (userId: string) => {
    try {
      const data = await deleteStaff(userId) as { success: boolean; message?: string };
      return { success: data.success, message: data.message };
    } catch {
      return { success: false, message: 'An unexpected error occurred.' };
    }
  };

  return {
    users,
    totalCount,
    isLoading,
    error,
    getUsers,
    handleDeleteUser,
  };
};
