'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import styles from '@/app/styles/AdminPage.module.css';
import PageHeader from '@/components/admin/PageHeader';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import UserGroupsTable from '@/components/admin/user-groups/UserGroupsTable';
import UserGroupModal from '@/components/admin/user-groups/UserGroupModal';
import QRCodeModal from '@/components/admin/user-groups/QRCodeModal';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ResultModal from '@/components/common/ResultModal';
import { UserGroupDto, CreateUserGroupDto, UpdateUserGroupDto } from '@/types/userGroupTypes';
import { useUserGroups } from '@/hooks/useUserGroups';

const UserGroupsPage = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const { groups, isLoading, hasLoadError, isSubmitting, refetch, createGroup, updateGroup, deleteGroup } =
    useUserGroups();

  // Modal toggle state — page-local UI orchestration, separate from data layer.
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroupDto | null>(null);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ data: string; title: string } | null>(null);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<UserGroupDto | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isResultModalSuccess, setIsResultModalSuccess] = useState(false);

  const showResult = (success: boolean, successKey: string) => {
    setIsResultModalSuccess(success);
    setResultModalMessage(success ? t(successKey) : t('error'));
    setIsResultModalOpen(true);
  };

  const buildCreateDto = (data: any): CreateUserGroupDto => {
    const dto: CreateUserGroupDto = {
      name: data.name,
      description: data.description || '',
      validFrom: data.validFrom || undefined,
      validUntil: data.validUntil || undefined,
    };
    if (data.hasInitialDiscount) {
      dto.initialDiscount = {
        name: data.discountName,
        type: data.discountType,
        value: data.discountValue,
        minimumOrderAmount: data.minOrderAmount,
        maximumDiscountAmount: data.maxDiscountAmount,
      };
    }
    return dto;
  };

  const handleCreate = async (data: any) => {
    const result = await createGroup(buildCreateDto(data));
    if (result.success) setIsCreateModalOpen(false);
    showResult(result.success, 'user_group_created_success');
  };

  const handleUpdate = async (data: any) => {
    if (!selectedGroup) return;
    const updateDto: UpdateUserGroupDto = {
      id: selectedGroup.id,
      name: data.name,
      description: data.description || '',
      isActive: data.isActive,
      validFrom: data.validFrom || undefined,
      validUntil: data.validUntil || undefined,
    };
    const result = await updateGroup(selectedGroup.id, updateDto);
    if (result.success) setIsEditModalOpen(false);
    showResult(result.success, 'user_group_updated_success');
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    const result = await deleteGroup(groupToDelete.id);
    setIsConfirmationModalOpen(false);
    setGroupToDelete(null);
    showResult(result.success, 'user_group_deleted_success');
  };

  const handleViewQRCode = (group: UserGroupDto) => {
    setQrCodeData({ data: group.qrCodeData, title: group.name });
    setIsQRCodeModalOpen(true);
  };

  return (
    <AdminAuthGuard>
      <div className={styles.adminContainer}>
        <PageHeader title={t('admin_user_groups_title')}>
          <button className={`${styles.adminButton} ${styles.add}`} onClick={() => setIsCreateModalOpen(true)}>
            {t('create_user_group')}
          </button>
        </PageHeader>

        <div className={styles.adminContent}>
          {hasLoadError && !isLoading && (
            <div className={styles.errorBanner} role="alert">
              <span>{t('failed_to_load_user_groups')}</span>
              <button type="button" className={`${styles.adminButton} ${styles.add}`} onClick={refetch}>
                {t('retry')}
              </button>
            </div>
          )}
          <UserGroupsTable
            groups={groups}
            isLoading={isLoading}
            onEdit={(group) => {
              setSelectedGroup(group);
              setIsEditModalOpen(true);
            }}
            onDelete={(group) => {
              setGroupToDelete(group);
              setIsConfirmationModalOpen(true);
            }}
            onManageMembers={(group) => router.push(`/admin/user-groups/${group.id}`)}
            onViewQRCode={handleViewQRCode}
          />
        </div>
      </div>

      <UserGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      <UserGroupModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdate}
        initialData={selectedGroup}
        isSubmitting={isSubmitting}
      />

      <QRCodeModal
        isOpen={isQRCodeModalOpen}
        onClose={() => setIsQRCodeModalOpen(false)}
        qrCodeData={qrCodeData?.data || ''}
        title={qrCodeData?.title || ''}
      />

      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={handleConfirmDelete}
        message={t('delete_user_group_confirmation')}
      />

      <ResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        message={resultModalMessage}
        isSuccess={isResultModalSuccess}
      />
    </AdminAuthGuard>
  );
};

export default UserGroupsPage;
