"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import styles from "@/AuthPage.module.css";
import { useRouter } from 'next/navigation';
import { customerRegistrationSchema } from '@/schemas/auth.schema';
import { registerCustomer } from '@/authService';
import { useAuth } from '@/components/AuthContext';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationResult = customerRegistrationSchema.safeParse(formData);
    if (!validationResult.success) {
      setError(validationResult.error.issues.map(issue => issue.message).join(", "));
      return;
    }

    try {
      const response = await registerCustomer(formData);
      if (response?.success) {
        // Auto-login in context and redirect home
        if (response.data) {
          login(response.data);
        }
        router.push('/');
      } else {
        const apiErrors = Array.isArray(response?.errors) ? response.errors.join(', ') : '';
        setError(apiErrors || response?.message || "Failed to register.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    }
  };

  return (
    <div className={styles.authContainer}>
      <form className={styles.authForm} onSubmit={handleSubmit}>
        <h1>Register</h1>
        {error && <p className={styles.errorMessage}>{error}</p>}
        <div className={styles.formGroup}>
          <label htmlFor="firstName">First Name</label>
          <input
            type="text"
            id="firstName"
            ref={firstNameInputRef}
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="lastName">Last Name</label>
          <input
            type="text"
            id="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="password">{t('password_label', 'Password')}</label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword">{t('confirm_password_label', 'Confirm Password')}</label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className={styles.submitButton}>{t('register_button', 'Register')}</button>
        <p className={styles.switchFormText}>
          Already have an account? <Link href="/auth/login">{t('login_button', 'Login')}</Link>
        </p>
      </form>
    </div>
  );
}
