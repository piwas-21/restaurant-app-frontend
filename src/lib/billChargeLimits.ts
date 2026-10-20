// Mirror the backend BillChargeRules contract; the server remains authoritative.
export const MAX_BILL_CHARGE_AMOUNT = 10_000;
export const MAX_BILL_CHARGE_FIELDS = 12;
export const BILL_CHARGE_KEY_MAX_LENGTH = 40;
export const BILL_CHARGE_LABEL_MAX_LENGTH = 60;
export const BILL_CHARGE_AMOUNT_STEP = 0.01;
export const BILL_CHARGE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

// Two-decimal entered values and minor-unit, half-up percentage rounding mirror the server contract.
export const BILL_CHARGE_PERCENTAGE_BASE = 100;
export const MAX_BILL_CHARGE_PERCENTAGE = BILL_CHARGE_PERCENTAGE_BASE;
export const BILL_CHARGE_DECIMAL_SCALE = 100;
export const BILL_CHARGE_PERCENTAGE_DIVISOR = BILL_CHARGE_PERCENTAGE_BASE * BILL_CHARGE_DECIMAL_SCALE;
export const BILL_CHARGE_PERCENTAGE_ROUNDING_OFFSET = BILL_CHARGE_PERCENTAGE_DIVISOR / 2;
