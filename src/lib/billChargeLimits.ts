// Mirror the backend BillChargeRules contract; the server remains authoritative.
export const MAX_BILL_CHARGE_AMOUNT = 10_000;
export const MAX_BILL_CHARGE_FIELDS = 12;
export const BILL_CHARGE_KEY_MAX_LENGTH = 40;
export const BILL_CHARGE_LABEL_MAX_LENGTH = 60;
export const BILL_CHARGE_AMOUNT_STEP = 0.01;
export const BILL_CHARGE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
