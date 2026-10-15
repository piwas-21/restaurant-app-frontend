import { useEffect, useState } from 'react';
import { workingHoursService } from '@/services/workingHoursService';

export function useGuestClosureReason(reason: string) {
  const [outsideHours, setOutsideHours] = useState(false);
  useEffect(() => {
    let active = true;
    setOutsideHours(false);
    if (reason === 'closed') {
      void workingHoursService
        .isOpenNow()
        .then((isOpen) => {
          if (active) setOutsideHours(isOpen === false);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [reason]);
  return reason === 'closed' && outsideHours;
}
