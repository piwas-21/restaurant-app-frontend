'use client';

import React from 'react';

interface AuthFieldProps {
  /** The active template's auth CSS module (formGroup / inputError / fieldError). */
  styles: Readonly<Record<string, string>>;
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  name?: string;
  ariaRequired?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  autoComplete?: string;
  /** Register mode: render the error slot (an inputError class + a fieldError note). */
  withErrorSlot?: boolean;
  error?: string;
}

/**
 * One label + input (+ optional error note) — the shared auth form field used by
 * both the login and register forms across both templates. Reproduces the exact
 * classic markup (no error slot on login; a `class` + `fieldError` slot on
 * register), so the classic DOM is unchanged; craft differs only in its CSS
 * module. Login omits `withErrorSlot` → no className/error node, matching the
 * original login inputs.
 */
export default function AuthField({
  styles,
  id,
  label,
  type,
  value,
  onChange,
  required = true,
  name,
  ariaRequired,
  inputRef,
  autoComplete,
  withErrorSlot,
  error,
}: Readonly<AuthFieldProps>) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id}>{label}</label>
      <input
        type={type}
        id={id}
        name={name}
        ref={inputRef}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={ariaRequired ? 'true' : undefined}
        autoComplete={autoComplete}
        className={withErrorSlot ? (error ? styles.inputError : '') : undefined}
      />
      {withErrorSlot && error && <p className={styles.fieldError}>{error}</p>}
    </div>
  );
}
