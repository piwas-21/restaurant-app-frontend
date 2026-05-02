'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ZodType } from 'zod';
import { useRouter } from 'next/navigation';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useTableContext } from '@/contexts/TableContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { customerInfoSchema } from '@/schemas/customerInfo.schema';

const SAVED_INFO_KEY = 'rumi_saved_customer_info';

// Resolve a single field's value through its Zod schema and translate the
// first error key. Empty string == valid. Used for blur-driven validation
// (per-field, not whole-form).
function validateField(field: ZodType, value: string, t: TFunction): string {
  const result = field.safeParse(value);
  if (result.success) return '';
  const key = result.error.issues[0]?.message ?? 'invalid';
  return t(key, key);
}

export interface CustomerInfoFormState {
  name: string;
  email: string;
  phone: string;
  saveInfo: boolean;
  nameError: string;
  emailError: string;
  phoneError: string;
  isLoggedIn: boolean;
  isLoadingUser: boolean;
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setSaveInfo: (v: boolean) => void;
  handleNameBlur: () => void;
  handleEmailBlur: () => void;
  handlePhoneBlur: () => void;
  handleContinue: () => void;
  handleBack: () => void;
}

/**
 * Owns the customer-info form: name/email/phone state, blur-driven validation,
 * the prefill-from-server-or-localStorage effect, the auto-set-DineIn effect
 * for QR-scan landings, save-to-localStorage on submit, and the navigation
 * handlers. Page becomes a thin orchestrator.
 */
export function useCustomerInfoForm(): CustomerInfoFormState {
  const { t } = useTranslation();
  const router = useRouter();
  const { state: checkoutState, setCustomerInfo, setOrderType, setTableNumber } = useCheckout();
  const { tableContext, hasTableContext } = useTableContext();

  const [name, setName] = useState(checkoutState.customerInfo?.name || '');
  const [email, setEmail] = useState(checkoutState.customerInfo?.email || '');
  const [phone, setPhone] = useState(checkoutState.customerInfo?.phone || '');
  const [saveInfo, setSaveInfo] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // QR-scan landing → pin DineIn + the scanned table.
  useEffect(() => {
    if (hasTableContext && tableContext.tableNumber && !checkoutState.orderType) {
      setOrderType(OrderType.DineIn);
      setTableNumber(tableContext.tableNumber);
    }
  }, [hasTableContext, tableContext, checkoutState.orderType, setOrderType, setTableNumber]);

  // Prefill: logged-in user → /api/User/profile, else saved-info from localStorage.
  // Skip if CheckoutContext already has data (returning user mid-flow).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingUser(true);
      try {
        if (typeof window === 'undefined') return;
        const authToken = localStorage.getItem('auth_token');
        if (authToken && !checkoutState.customerInfo) {
          try {
            const user = await getCurrentUser();
            if (cancelled) return;
            if (user) {
              setName(user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email);
              setEmail(user.email || '');
              setPhone(user.phoneNumber || '');
              setIsLoggedIn(true);
              return;
            }
          } catch (err) {
            console.error('Failed to fetch user profile:', err);
          }
        }
        if (cancelled) return;
        setIsLoggedIn(false);
        const saved = localStorage.getItem(SAVED_INFO_KEY);
        if (saved && !checkoutState.customerInfo) {
          try {
            const parsed = JSON.parse(saved);
            setName(parsed.name || '');
            setEmail(parsed.email || '');
            setPhone(parsed.phone || '');
          } catch {
            // Corrupted saved info — fall through with empty fields.
          }
        }
      } finally {
        if (!cancelled) setIsLoadingUser(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [checkoutState.customerInfo]);

  const validateName = (v: string) => {
    const e = validateField(customerInfoSchema.shape.name, v, t);
    setNameError(e);
    return !e;
  };
  const validateEmail = (v: string) => {
    const e = validateField(customerInfoSchema.shape.email, v, t);
    setEmailError(e);
    return !e;
  };
  const validatePhone = (v: string) => {
    const e = validateField(customerInfoSchema.shape.phone, v, t);
    setPhoneError(e);
    return !e;
  };

  const handleContinue = () => {
    const ok = [validateName(name), validateEmail(email), validatePhone(phone)].every(Boolean);
    if (!ok) return;
    const customerInfo = { name: name.trim(), email: email.trim(), phone: phone.trim() };
    setCustomerInfo(customerInfo);
    if (saveInfo && typeof window !== 'undefined') {
      localStorage.setItem(SAVED_INFO_KEY, JSON.stringify(customerInfo));
    }
    router.push('/checkout/review');
  };

  const handleBack = () => router.push(hasTableContext ? '/cart' : '/checkout/order-type');

  // Setters that also clear the field's error on next keystroke.
  const wrapSetter =
    <T>(set: (v: T) => void, err: string, clearErr: (s: string) => void) =>
    (v: T) => {
      set(v);
      if (err) clearErr('');
    };

  return {
    name,
    email,
    phone,
    saveInfo,
    nameError,
    emailError,
    phoneError,
    isLoggedIn,
    isLoadingUser,
    setName: wrapSetter(setName, nameError, setNameError),
    setEmail: wrapSetter(setEmail, emailError, setEmailError),
    setPhone: wrapSetter(setPhone, phoneError, setPhoneError),
    setSaveInfo,
    handleNameBlur: () => validateName(name),
    handleEmailBlur: () => validateEmail(email),
    handlePhoneBlur: () => validatePhone(phone),
    handleContinue,
    handleBack,
  };
}
