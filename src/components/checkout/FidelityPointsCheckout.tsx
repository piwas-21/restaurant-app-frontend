'use client';

import { TENANT_CURRENCY } from '@/utils/currency';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fidelityPointsService } from '@/services/fidelityPointsService';
import { getErrorMessage, isAuthError } from '@/utils/apiClient';
import type { FidelityPointBalance } from '@/types/fidelity';
import { Gift, Coins, Percent } from 'lucide-react';
import styles from './FidelityPointsCheckout.module.css';

interface FidelityPointsCheckoutProps {
  orderSubtotal: number;
  onPointsRedemption?: (points: number, discountAmount: number) => void;
}

export default function FidelityPointsCheckout({ orderSubtotal, onPointsRedemption }: FidelityPointsCheckoutProps) {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<FidelityPointBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointsToEarn, setPointsToEarn] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [maxRedeemablePoints, setMaxRedeemablePoints] = useState(0);
  const [showRedemption, setShowRedemption] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBalanceAndCalculate = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      // Load user's current balance
      const balanceData = await fidelityPointsService.getBalance();
      setBalance(balanceData);

      // Calculate points that will be earned (approximate - backend will calculate exact)
      // Simple calculation: For every $20-50, earn 15 points (Silver tier example)
      // This should match backend logic, but we'll show estimated points
      const estimatedPoints = Math.floor(orderSubtotal / 10) * 5; // Rough estimate
      setPointsToEarn(estimatedPoints);

      // Calculate max redeemable points (can't exceed current balance or order total)
      const maxPointsBasedOnOrder = orderSubtotal * 100; // 100 points = $1
      const maxPoints = Math.min(balanceData.currentPoints, maxPointsBasedOnOrder);
      setMaxRedeemablePoints(maxPoints);
    } catch (err) {
      // Bound and BRANCHED, because the two failures here are not the same failure.
      //
      // A 401 is the expected outcome for a GUEST — `/fidelity/balance` needs a bearer token and
      // this component renders on every checkout, including the ones with no account behind them.
      // `balance` staying null makes the whole section return null (below), which is the correct
      // screen for someone with no points programme: nothing to report, nothing to offer. Saying
      // "Failed to load your points" there would invent a feature the guest does not have.
      //
      // Anything else is a signed-in customer's problem. Swallowing it made the redemption panel
      // vanish mid-checkout with no explanation, so someone with a balance they can see in their
      // account simply could not spend it and had no idea why. `fidelityPointsService` does
      // `console.error` those (gated on the STATUS, not on the message) — but there is no browser
      // error reporting wired up, so that record reaches nobody, and it was never the user's
      // answer anyway. A single line above the total is enough: it says the points are still
      // theirs and the order can go ahead without them.
      //
      // `setBalance(null)` alongside it, and that is not belt-and-braces. The effect runs TWICE on
      // a normal checkout — `orderSubtotal` arrives as 0 while the basket is still null, then as
      // the real figure — so "first load succeeded, second failed" is the ordinary sequence, not
      // an exotic one. Leaving the stale balance up rendered the full redemption panel with
      // `maxRedeemablePoints` computed from the OLD subtotal, and wrote the notice into state that
      // only renders when there is no balance: a dead slider, a "Use Max" that does nothing, and
      // no explanation anywhere.
      if (isAuthError(err)) {
        setLoadError(null);
      } else {
        setLoadError(getErrorMessage(err) ?? t('fidelity_balance_unavailable'));
      }
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // loadBalanceAndCalculate has its own try/catch (silently handles auth errors); fire-and-forget.
    void loadBalanceAndCalculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSubtotal]);

  const handleRedeemPoints = async () => {
    if (pointsToRedeem > 0 && pointsToRedeem <= maxRedeemablePoints) {
      try {
        const discountAmount = await fidelityPointsService.calculateDiscount(pointsToRedeem);
        if (onPointsRedemption) {
          onPointsRedemption(pointsToRedeem, discountAmount);
        }
      } catch (err) {
        console.error('Error calculating discount:', err);
      }
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setPointsToRedeem(value);
  };

  const handleMaxPoints = () => {
    setPointsToRedeem(maxRedeemablePoints);
  };

  const discountAmount = pointsToRedeem / 100; // 100 points = $1

  if (loading) return null;

  // Only reached when the customer IS signed in — a guest's 401 leaves `loadError` null, so the
  // section still disappears for them exactly as before.
  if (!balance) {
    return loadError ? (
      <div className={styles.container}>
        <p className={styles.loadError} role="status">
          {loadError}
        </p>
      </div>
    ) : null;
  }

  return (
    <div className={styles.container}>
      {/* Points to be Earned */}
      <div className={styles.earnSection}>
        <div className={styles.iconWrapper}>
          <Coins size={20} />
        </div>
        <div className={styles.content}>
          <h3 className={styles.title}>{t('earn_points_with_order', 'Earn Points with this Order')}</h3>
          <p className={styles.earnPoints}>
            +{pointsToEarn} {t('points', 'points')}
            <span className={styles.earnValue}>
              (≈ {TENANT_CURRENCY}
              {(pointsToEarn / 100).toFixed(2)} {t('future_discount', 'future discount')})
            </span>
          </p>
        </div>
      </div>

      {/* Current Balance Display */}
      <div className={styles.balanceSection}>
        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>{t('your_current_balance', 'Your Current Balance')}:</span>
          <span className={styles.balanceValue}>
            {balance.currentPoints.toLocaleString()} {t('points', 'points')}
            <span className={styles.balanceValueCurrency}>(${balance.currentPointsValue.toFixed(2)})</span>
          </span>
        </div>
      </div>

      {/* Points Redemption Section */}
      {balance.currentPoints > 0 && (
        <div className={styles.redemptionSection}>
          <button onClick={() => setShowRedemption(!showRedemption)} className={styles.toggleButton}>
            <Gift size={18} />
            {showRedemption
              ? t('hide_redemption', 'Hide Point Redemption')
              : t('use_points', 'Use Points for Discount')}
          </button>

          {showRedemption && (
            <div className={styles.redemptionPanel}>
              <p className={styles.redemptionInfo}>
                {t('redemption_info', 'Redeem your points for an instant discount. 100 points = $1.00')}
              </p>

              {/* Slider for points selection */}
              <div className={styles.sliderContainer}>
                <div className={styles.sliderHeader}>
                  <label htmlFor="pointsSlider" className={styles.sliderLabel}>
                    {t('points_to_redeem', 'Points to Redeem')}:
                  </label>
                  <button onClick={handleMaxPoints} className={styles.maxButton}>
                    {t('use_max', 'Use Max')}
                  </button>
                </div>

                <input
                  id="pointsSlider"
                  type="range"
                  min="0"
                  max={maxRedeemablePoints}
                  step="100"
                  value={pointsToRedeem}
                  onChange={handleSliderChange}
                  className={styles.slider}
                />

                <div className={styles.sliderValues}>
                  <span className={styles.pointsSelected}>
                    {pointsToRedeem.toLocaleString()} {t('points', 'points')}
                  </span>
                  <span className={styles.discountAmount}>
                    <Percent size={16} />${discountAmount.toFixed(2)} {t('discount', 'discount')}
                  </span>
                </div>

                <div className={styles.sliderLimits}>
                  <span>0</span>
                  <span>{maxRedeemablePoints.toLocaleString()}</span>
                </div>
              </div>

              {/* Apply Button */}
              <button onClick={handleRedeemPoints} disabled={pointsToRedeem === 0} className={styles.applyButton}>
                {t('apply_discount', 'Apply Discount')}
              </button>

              <p className={styles.balanceAfterRedemption}>
                {t('balance_after_redemption', 'Balance after redemption')}:{' '}
                {(balance.currentPoints - pointsToRedeem).toLocaleString()} {t('points', 'points')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
