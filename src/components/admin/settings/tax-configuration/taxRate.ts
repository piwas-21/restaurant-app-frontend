// Strict validation for the tax-rate text input.
//
// `Number.parseFloat` alone silently accepts trailing junk ("8.1abc" → 8.1),
// and switching to `Number` would newly accept hex/scientific/binary literals
// ("0x10" → 16, "1e2" → 100). So gate the raw string on a plain-decimal
// pattern first, then apply the existing 0–100 bound. Empty input is treated
// as a valid 0 (the field's "clear to reset" behaviour). See issue #181.
//
// Backtracking-free by construction: an integer with an optional fractional
// part (`8`, `8.`, `8.1`) OR a bare fraction (`.5`) — no two unbounded `\d`
// runs sit adjacent, so there is no super-linear matching (Sonar S8786).
const RATE_PATTERN = /^\d+(\.\d*)?$|^\.\d+$/;

export interface RateValidation {
  valid: boolean;
  /** The rate to store — present only for valid input (0 for empty). */
  rate?: number;
}

export function validateRateInput(value: string): RateValidation {
  if (value === '') return { valid: true, rate: 0 };
  if (!RATE_PATTERN.test(value)) return { valid: false };
  const rate = Number.parseFloat(value);
  if (Number.isNaN(rate) || rate < 0 || rate > 100) return { valid: false };
  return { valid: true, rate };
}
