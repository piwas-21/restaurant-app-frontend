'use client';

import { useState } from 'react';

interface ConfirmState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
}

interface ResultState {
  isOpen: boolean;
  message: string;
  isSuccess: boolean;
}

const closedConfirm: ConfirmState = { isOpen: false, message: '', onConfirm: () => {} };
const closedResult: ResultState = { isOpen: false, message: '', isSuccess: false };

/**
 * Shared confirm-modal + result-modal state. Replaces the
 * `setConfirmModal({...})` / `setResultModal({...})` pattern that was
 * duplicated five+ times on the admin reservations page. Each mutation
 * calls `requestConfirm({message, onConfirm})`; on success or failure it
 * calls `showResult({message, isSuccess})` and the result modal pops.
 */
export function useConfirmAndResultModals() {
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(closedConfirm);
  const [resultModal, setResultModal] = useState<ResultState>(closedResult);

  const requestConfirm = (message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({
      isOpen: true,
      message,
      onConfirm: async () => {
        setConfirmModal(closedConfirm);
        await onConfirm();
      },
    });
  };

  const showResult = (message: string, isSuccess: boolean) => {
    setResultModal({ isOpen: true, message, isSuccess });
  };

  const closeConfirm = () => setConfirmModal(closedConfirm);
  const closeResult = () => setResultModal(closedResult);

  return { confirmModal, resultModal, requestConfirm, showResult, closeConfirm, closeResult };
}
