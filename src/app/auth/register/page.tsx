// src/app/auth/register/page.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import styles from "../../styles/AuthPage.module.css";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const firstNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      // Consider setting focus to the password field or confirm password field
      return;
    }
    // TODO: Implement actual registration logic (e.g., API call)
    console.log('Registration attempt:', { firstName, lastName, email });
    alert('Registration functionality to be implemented. Check console.');
    // On success, redirect or update auth state (e.g., to login page)
  };

  return (
    <main className={styles.authContainer}>
      <div className={styles.authForm} role="form" aria-labelledby="register-heading">
        <h1 id="register-heading">Register</h1>
        <form onSubmit={handleSubmit} noValidate>
          {error && <p className={styles.errorMessage} role="alert">{error}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              aria-required="true"
              ref={firstNameInputRef}
              autoComplete="given-name"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              aria-required="true"
              autoComplete="family-name"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              autoComplete="email"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-describedby="password-requirements" // Add if there are specific requirements
              autoComplete="new-password"
            />
            {/* <p id="password-requirements" className="sr-only">Password must be at least 8 characters long.</p> */}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              aria-required="true"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className={styles.submitButton}>Register</button>
        </form>
        <p className={styles.switchFormText}>
          Already have an account? <Link href="/auth/login">Login here</Link>
        </p>
      </div>
    </main>
  );
}

