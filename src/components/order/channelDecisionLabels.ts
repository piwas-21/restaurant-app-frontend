import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type { ChannelDecisionAction, ChannelDecisionState } from '@/types/order/channelDecision';

export const decisionStateLabels: Record<ChannelDecisionState, string> = {
  Pending: 'delivery_channels.decision_pending',
  Leased: 'delivery_channels.decision_leased',
  Unknown: 'delivery_channels.decision_unknown',
  Succeeded: 'delivery_channels.decision_succeeded',
  Failed: 'delivery_channels.decision_failed',
};
export const decisionActionLabels: Record<ChannelDecisionAction, string> = {
  accept: 'delivery_channels.decision_action_accept',
  deny: 'delivery_channels.decision_action_deny',
};
export const decisionConfirmationLabels: Record<ChannelDecisionAction, string> = {
  accept: 'delivery_channels.decision_confirm_accept',
  deny: 'delivery_channels.decision_confirm_deny',
};

export const decisionStateTones: Record<ChannelDecisionState, StatusBadgeTone> = {
  Pending: 'warning',
  Leased: 'warning',
  Unknown: 'warning',
  Succeeded: 'success',
  Failed: 'danger',
};
