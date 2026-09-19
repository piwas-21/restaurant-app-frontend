'use client';

import { useNotification } from '@/hooks/useNotification';
import { useCashierAutoPrint } from '@/hooks/cashier/useCashierAutoPrint';
import AutoPrintSettingsModal from './AutoPrintSettingsModal';
import SoundSelector from './SoundSelector';
import ZReportModal from './ZReportModal';

export type CashierMorePanel = 'zreport' | 'sound' | 'autoprint';

interface CashierMoreMenuPanelsProps {
  readonly panel: CashierMorePanel;
  readonly onClose: () => void;
}

/**
 * The modal subtree behind the workspace More menu. Loaded dynamically so the audio engine
 * and the three modals stay out of the route bundle until a cashier actually opens one
 * (the bundle gate noticed when they rode along eagerly).
 */
export default function CashierMoreMenuPanels({ panel, onClose }: CashierMoreMenuPanelsProps) {
  const notif = useNotification();
  const autoPrint = useCashierAutoPrint();

  return (
    <>
      <ZReportModal isOpen={panel === 'zreport'} onClose={onClose} />
      <SoundSelector
        isOpen={panel === 'sound'}
        onClose={onClose}
        soundType={notif.soundType}
        onSoundTypeChange={notif.changeSoundType}
        onTestSound={notif.playSoundByType}
        repeatUntilMouseMoves={notif.repeatUntilMouseMoves}
        onToggleRepeat={notif.toggleRepeatSound}
      />
      <AutoPrintSettingsModal
        isOpen={panel === 'autoprint'}
        onClose={onClose}
        settings={autoPrint.settings}
        onSave={autoPrint.saveSettings}
      />
    </>
  );
}
