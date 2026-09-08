'use client';

import QRScannerDialog from './QRScannerDialog';
import AutoPrintSettingsModal from './AutoPrintSettingsModal';
import ZReportModal from './ZReportModal';
import CashierDiagnostics from './CashierDiagnostics';
import { AutoPrintSettings } from '@/types/cashier';
import { QRCodeValidationResult } from '@/types/userGroupTypes';
import styles from '@/app/styles/CashierPage.module.css';
import { ConnectionState } from '@/hooks/cashier/useCashierOrdersStream';
import dynamic from 'next/dynamic';
import type { useTableBill } from '@/hooks/cashier/useTableBill';

// next/dynamic + the isOpen guard below are load-bearing (LibraryPickerShell's pattern):
// the dialog is click-gated, and next/dynamic fetches at first RENDER — a static import
// tipped /cashier over its First Load JS budget.
const TableBillModal = dynamic(() => import('./TableBillModal'), { ssr: false });

interface CashierAuxiliaryDialogsProps {
  /** One-bill-per-table dialog state; mounts the click-gated TableBillModal. */
  billState: ReturnType<typeof useTableBill>;
  /** Fired after a bill tender commits — the page toasts and refreshes the order list. */
  onBillPaymentSuccess: (message: string) => void;
  showQRScanner: boolean;
  showAutoPrint: boolean;
  showZReport: boolean;
  showDiagnostics: boolean;
  autoPrintSettings: AutoPrintSettings;
  diagnostics: {
    sseConnected: boolean;
    sseConnectionState: ConnectionState;
    sseLastEventTime: Date | null;
    sseError: string | null;
    audioEnabled: boolean;
    audioReady: boolean;
    audioBlockedByPolicy: boolean;
  };
  onCloseQRScanner: () => void;
  onCloseAutoPrint: () => void;
  onCloseZReport: () => void;
  onCloseDiagnostics: () => void;
  onApplyDiscount: (result: QRCodeValidationResult) => void;
  onSaveAutoPrint: (settings: AutoPrintSettings) => void;
  onTestSound: () => void;
  onEnableAudio: () => void;
  onRefreshConnection: () => void;
}

/**
 * Renders the QR scanner, auto-print settings, Z-report, and diagnostics
 * overlays. Pure JSX wiring — extracted so `cashier/page.tsx` stays under
 * the page-level LOC limit.
 */
export default function CashierAuxiliaryDialogs(props: CashierAuxiliaryDialogsProps) {
  return (
    <>
      {props.billState.isOpen && (
        <TableBillModal
          isOpen={props.billState.isOpen}
          onClose={props.billState.close}
          billState={props.billState}
          onSuccess={props.onBillPaymentSuccess}
        />
      )}
      <QRScannerDialog
        isOpen={props.showQRScanner}
        onClose={props.onCloseQRScanner}
        onApplyDiscount={props.onApplyDiscount}
      />
      <AutoPrintSettingsModal
        isOpen={props.showAutoPrint}
        onClose={props.onCloseAutoPrint}
        settings={props.autoPrintSettings}
        onSave={props.onSaveAutoPrint}
      />
      <ZReportModal isOpen={props.showZReport} onClose={props.onCloseZReport} />
      {props.showDiagnostics && (
        <div className={styles.diagnosticsOverlay}>
          <CashierDiagnostics
            sseConnected={props.diagnostics.sseConnected}
            sseConnectionState={props.diagnostics.sseConnectionState}
            sseLastEventTime={props.diagnostics.sseLastEventTime}
            sseError={props.diagnostics.sseError}
            audioEnabled={props.diagnostics.audioEnabled}
            audioReady={props.diagnostics.audioReady}
            audioBlockedByPolicy={props.diagnostics.audioBlockedByPolicy}
            onTestSound={props.onTestSound}
            onEnableAudio={props.onEnableAudio}
            onRefreshConnection={props.onRefreshConnection}
            onClose={props.onCloseDiagnostics}
          />
        </div>
      )}
    </>
  );
}
