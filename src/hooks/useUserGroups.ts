'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUserGroups, createUserGroup, updateUserGroup, deleteUserGroup } from '@/services/userGroupService';
import type { UserGroupDto, CreateUserGroupDto, UpdateUserGroupDto } from '@/types/userGroupTypes';

export interface UserGroupActionResult {
  success: boolean;
  message?: string;
}

export interface UseUserGroupsReturn {
  groups: UserGroupDto[];
  isLoading: boolean;
  hasLoadError: boolean;
  isSubmitting: boolean;
  refetch: () => Promise<void>;
  createGroup: (input: CreateUserGroupDto) => Promise<UserGroupActionResult>;
  updateGroup: (id: string, input: UpdateUserGroupDto) => Promise<UserGroupActionResult>;
  deleteGroup: (id: string) => Promise<UserGroupActionResult>;
}

export function useUserGroups(): UseUserGroupsReturn {
  const [groups, setGroups] = useState<UserGroupDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getUserGroups();
      if (response.success && response.data) {
        setGroups(response.data);
        setHasLoadError(false);
      } else {
        // API responded with { success: false } envelope (no HTTP error thrown).
        // Treat as a load failure so the banner surfaces instead of an empty list.
        console.error('Failed to fetch user groups:', response.message);
        setGroups([]);
        setHasLoadError(true);
      }
    } catch (err) {
      console.error('Failed to fetch user groups:', err);
      setGroups([]);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // refetch has its own try/catch (sets hasLoadError); fire-and-forget.
    void refetch();
  }, [refetch]);

  const createGroup = useCallback(
    async (input: CreateUserGroupDto): Promise<UserGroupActionResult> => {
      setIsSubmitting(true);
      try {
        const response = await createUserGroup(input);
        if (!response.success) {
          return { success: false, message: response.message };
        }
        await refetch();
        return { success: true };
      } catch (err) {
        console.error('Error creating group:', err);
        return { success: false };
      } finally {
        setIsSubmitting(false);
      }
    },
    [refetch],
  );

  const updateGroup = useCallback(
    async (id: string, input: UpdateUserGroupDto): Promise<UserGroupActionResult> => {
      setIsSubmitting(true);
      try {
        const response = await updateUserGroup(id, input);
        if (!response.success) {
          return { success: false, message: response.message };
        }
        await refetch();
        return { success: true };
      } catch (err) {
        console.error('Error updating group:', err);
        return { success: false };
      } finally {
        setIsSubmitting(false);
      }
    },
    [refetch],
  );

  const deleteGroup = useCallback(
    async (id: string): Promise<UserGroupActionResult> => {
      try {
        const response = await deleteUserGroup(id);
        if (!response.success) {
          return { success: false, message: response.message };
        }
        await refetch();
        return { success: true };
      } catch (err) {
        console.error('Error deleting group:', err);
        return { success: false };
      }
    },
    [refetch],
  );

  return {
    groups,
    isLoading,
    hasLoadError,
    isSubmitting,
    refetch,
    createGroup,
    updateGroup,
    deleteGroup,
  };
}
