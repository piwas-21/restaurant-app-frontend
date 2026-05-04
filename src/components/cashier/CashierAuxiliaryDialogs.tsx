'use client';

import QRScannerDialog from './QRScannerDialog';
import AutoPrintSettingsModal from './AutoPrintSettingsModal';
import ZReportModal from './ZReportModal';
import CashierDiagnostics from './CashierDiagnostics';
import { AutoPrintSettings } from '@/types/cashier';
import { QRCodeValidationResult } from '@/types/userGroupTypes';
import styles from '@/app/styles/CashierPage.module.css';
import { ConnectionState } from '@/hooks/cashier/useCashierOrdersStream';

interface CashierAuxiliaryDialogsProps {
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
